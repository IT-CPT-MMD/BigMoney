import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const PORT = Number(process.env.PORT || 8080);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Add them to backend/.env');
}

const supabase = createClient(SUPABASE_URL || 'http://localhost:54321', SUPABASE_SERVICE_ROLE_KEY || 'missing', {
  auth: { persistSession: false }
});

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

const TABLES = new Set(['users', 'platforms', 'transactions', 'riskReports', 'orderReservations']);
const DEFAULT_PLATFORM_ID = '4-2';
const MAX_API_LIMIT = 10000;
const DEFAULT_API_LIMIT = 5000;
const SUPABASE_MAX_RANGE = 1000;

function clampLimit(value, fallback = DEFAULT_API_LIMIT) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), 1), MAX_API_LIMIT);
}

function makePlatformSet(platforms = []) {
  return new Set(Array.isArray(platforms) ? platforms.map(normalizePlatform) : []);
}

function assertTable(table) {
  if (!TABLES.has(table)) {
    const err = new Error(`Table not allowed: ${table}`);
    err.status = 400;
    throw err;
  }
}
function cleanForSave(value) {
  if (value && value.__serverTimestamp) return new Date().toISOString();
  if (Array.isArray(value)) return value.map(cleanForSave);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = cleanForSave(v);
    return out;
  }
  return value;
}
function normalizeRole(role) {
  const r = String(role || 'qa').toLowerCase();
  return ['admin', 'editor', 'qa'].includes(r) ? r : 'qa';
}
function normalizePlatform(value) {
  return String(value || '').trim().replace(/^MD\s+/i, '');
}
function firstValue(...values) {
  return values.find(v => v !== undefined && v !== null && String(v).trim?.() !== '') ?? '';
}
function numberValue(...values) {
  const value = firstValue(...values);
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function datePart(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}
function rowData(row) {
  const json = row?.data && typeof row.data === 'object' ? row.data : {};
  const idPlatform = String(row?.id || '').includes('__') ? String(row.id).split('__')[0] : '';
  const platformId = normalizePlatform(firstValue(row?.platform_id, row?.platformId, row?.platform_code, row?.platformCode, row?.platform, json.platformId, json.platformCode, json.platform, idPlatform));
  const createdAt = firstValue(row?.created_at, row?.createdAt, json.createdAt);
  const amount = numberValue(row?.amount, json.amount);
  const paidAmount = numberValue(row?.paid_amount, row?.paidAmount, row?.total_paid, json.paidAmount, json.totalPaid);
  const pendingBalance = numberValue(row?.pending_balance, row?.pendingBalance, json.pendingBalance, Math.max(amount - paidAmount, 0));
  const overpaidAmount = numberValue(row?.overpaid_amount, row?.overpaidAmount, json.overpaidAmount, Math.max(paidAmount - amount, 0));
  return {
    id: row?.id,
    ...json,
    platformId: platformId || json.platformId,
    platformCode: platformId || json.platformCode,
    date: firstValue(row?.date, row?.created_date, json.date, datePart(createdAt)),
    amount: amount || json.amount || 0,
    paidAmount: paidAmount || json.paidAmount || 0,
    pendingBalance: pendingBalance || json.pendingBalance || 0,
    overpaidAmount: overpaidAmount || json.overpaidAmount || 0,
    status: String(firstValue(row?.status, json.status, pendingBalance > 0 ? 'PENDING' : paidAmount > amount ? 'OVERPAID' : 'DONE')).toUpperCase(),
    createdBy: firstValue(row?.created_by, json.createdBy),
    qaUser: firstValue(row?.qa_user, row?.qaUser, json.qaUser),
    deleted: row?.deleted === true || row?.is_deleted === true || json.deleted === true
  };
}

function userData(row) {
  const json = row?.data && typeof row.data === 'object' ? row.data : {};
  return {
    id: row?.id,
    ...json,
    username: json.username || row?.id,
    role: normalizeRole(json.role || row?.role),
    // Only treat the user as disabled when the user record explicitly says disabled/inactive.
    // Do not reuse transaction status logic here.
    status: json.status || row?.status || 'active',
    allowedPlatforms: Array.isArray(json.allowedPlatforms) ? json.allowedPlatforms : (Array.isArray(row?.allowedPlatforms) ? row.allowedPlatforms : []),
    password: json.password || row?.password || ''
  };
}

function publicUser(u) {
  return {
    username: u.username || u.id,
    role: normalizeRole(u.role),
    status: u.status || 'active',
    allowedPlatforms: Array.isArray(u.allowedPlatforms) ? u.allowedPlatforms : []
  };
}
function sign(user) {
  return jwt.sign({ username: user.username, role: normalizeRole(user.role), allowedPlatforms: user.allowedPlatforms || [] }, JWT_SECRET, { expiresIn: '12h' });
}
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Missing auth token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
function canAccessPlatform(user, platformId) {
  if (!platformId || platformId === 'all') return normalizeRole(user.role) !== 'qa' || (user.allowedPlatforms || []).includes('all');
  const allowed = user.allowedPlatforms || [];
  return normalizeRole(user.role) === 'admin' || allowed.includes('all') || allowed.includes(platformId);
}
function requireAdminOrEditor(req, res, next) {
  const role = normalizeRole(req.user?.role);
  if (!['admin', 'editor'].includes(role)) return res.status(403).json({ message: 'Admin or editor permission required' });
  next();
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'bm-core-backend' }));

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });
    const { data: row, error } = await supabase.from('users').select('*').eq('id', username).maybeSingle();
    if (error) throw error;
    if (!row) return res.status(401).json({ message: 'User not found' });
    const u = userData(row);
    if (String(u.status || 'active').toLowerCase() !== 'active') return res.status(403).json({ message: 'This user is disabled' });
    const stored = String(u.password || '');
    const ok = stored.startsWith('$2') ? await bcrypt.compare(password, stored) : stored === password;
    if (!ok) return res.status(401).json({ message: 'Wrong password' });
    const user = publicUser({ ...u, id: username });
    await supabase.from('users').upsert({ id: username, data: { ...u, online: true, lastSeenAt: new Date().toISOString(), lastSeenText: new Date().toLocaleString() }, updated_at: new Date().toISOString() });
    res.json({ user, token: sign(user) });
  } catch (err) { next(err); }
});

app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.user }));

app.get('/api/docs/:table/:id', requireAuth, async (req, res, next) => {
  try {
    const { table, id } = req.params;
    assertTable(table);
    const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

app.post('/api/docs/:table/:id', requireAuth, async (req, res, next) => {
  try {
    const { table, id } = req.params;
    assertTable(table);
    const finalData = cleanForSave(req.body.data || {});
    const { data, error } = await supabase.from(table).insert({ id, data: finalData, updated_at: new Date().toISOString() }).select('*').single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

app.put('/api/docs/:table/:id', requireAuth, async (req, res, next) => {
  try {
    const { table, id } = req.params;
    assertTable(table);
    const finalData = cleanForSave(req.body.data || {});
    const { data, error } = await supabase.from(table).upsert({ id, data: finalData, updated_at: new Date().toISOString() }).select('*').single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

app.patch('/api/docs/:table/:id', requireAuth, async (req, res, next) => {
  try {
    const { table, id } = req.params;
    assertTable(table);
    if (table === 'transactions' && !['admin', 'editor'].includes(normalizeRole(req.user.role))) return res.status(403).json({ message: 'Only admin/editor can edit transactions' });
    const incoming = cleanForSave(req.body.data || {});
    const { data: existing, error: getError } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
    if (getError) throw getError;
    const current = existing?.data && typeof existing.data === 'object' ? existing.data : {};
    const merged = { ...current, ...incoming };
    const { data, error } = await supabase.from(table).upsert({ id, data: merged, updated_at: new Date().toISOString() }).select('*').single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

app.delete('/api/docs/:table/:id', requireAuth, async (req, res, next) => {
  try {
    const { table, id } = req.params;
    assertTable(table);
    if (table === 'users' && normalizeRole(req.user.role) !== 'admin') return res.status(403).json({ message: 'Only admin can delete users' });
    if (table === 'transactions' && !['admin', 'editor'].includes(normalizeRole(req.user.role))) return res.status(403).json({ message: 'Only admin/editor can delete transactions' });
    if (table === 'riskReports' && normalizeRole(req.user.role) !== 'admin') return res.status(403).json({ message: 'Only admin can delete risk reports' });
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { next(err); }
});


async function fetchFilteredRows(table, { limit = DEFAULT_API_LIMIT, orderColumn = 'updated_at', pageSize = SUPABASE_MAX_RANGE, applyFilter = () => true, mapRow = null } = {}) {
  const maxLimit = clampLimit(limit);
  const batchSize = Math.min(clampLimit(pageSize, SUPABASE_MAX_RANGE), SUPABASE_MAX_RANGE);
  const out = [];
  let from = 0;

  while (out.length < maxLimit) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderColumn, { ascending: false })
      .range(from, from + batchSize - 1);
    if (error) throw error;

    const rows = data || [];
    for (const row of rows) {
      const mapped = mapRow ? mapRow(row) : row;
      if (applyFilter(mapped, row)) out.push(mapped);
      if (out.length >= maxLimit) break;
    }

    if (rows.length < batchSize) break;
    from += batchSize;
  }
  return out;
}

app.get('/api/collections/:table', requireAuth, async (req, res, next) => {
  try {
    const { table } = req.params;
    assertTable(table);
    const limit = clampLimit(req.query.limit);
    let query = supabase.from(table).select('*');
    if (table === 'transactions' || table === 'riskReports') {
      const platformId = normalizePlatform(req.query.platformId || 'all');
      const date = String(req.query.date || '');
      const dateFrom = String(req.query.dateFrom || '');
      const dateTo = String(req.query.dateTo || '');
      const statusFilter = String(req.query.status || '').toUpperCase();
      // Most migrated data is inside jsonb data, so filtering is finalized after query.
      // Fetch in batches so Dashboard/History are not cut at the first 100 records.
      const role = normalizeRole(req.user.role);
      const allowedSet = makePlatformSet(req.user.allowedPlatforms || []);
      const filtered = await fetchFilteredRows(table, {
        limit,
        applyFilter: (_row, rawRow) => {
          const d = rowData(rawRow);
          if (d.deleted) return false;
          const rowPlatform = normalizePlatform(d.platformId || d.platformCode);
          if (platformId && platformId !== 'all' && rowPlatform !== platformId) return false;
          if (date && d.date !== date) return false;
          if (dateFrom && (!d.date || d.date < dateFrom)) return false;
          if (dateTo && (!d.date || d.date > dateTo)) return false;
          if (statusFilter && String(d.status || '').toUpperCase() !== statusFilter) return false;
          if (role === 'qa') {
            if (!allowedSet.has('all') && !allowedSet.has(rowPlatform)) return false;
            if (table === 'transactions' && d.createdBy && d.createdBy !== req.user.username && d.qaUser !== req.user.username) return false;
          }
          return true;
        }
      });
      return res.json({ data: filtered });
    }
    query = query.order('updated_at', { ascending: false }).limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (err) { next(err); }
});

app.get('/api/dashboard', requireAuth, async (req, res, next) => {
  try {
    const platformId = normalizePlatform(req.query.platformId || DEFAULT_PLATFORM_ID);
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    const requestedLimit = clampLimit(req.query.limit);
    const role = normalizeRole(req.user.role);
    const rows = await fetchFilteredRows('transactions', {
      limit: requestedLimit,
      mapRow: rowData,
      applyFilter: (t) => {
        if (t.deleted) return false;
        if (platformId !== 'all' && normalizePlatform(t.platformId || t.platformCode) !== platformId) return false;
        if (date && t.date !== date) return false;
        if (role === 'qa' && t.createdBy && t.createdBy !== req.user.username && t.qaUser !== req.user.username) return false;
        return true;
      }
    });

    const summary = {
      date,
      platformId,
      totalPaid: 0,
      pendingBalance: 0,
      overpaidAmount: 0,
      records: rows.length,
      done: 0,
      pending: 0,
      overpaid: 0
    };

    for (const t of rows) {
      summary.totalPaid += Number(t.paidAmount || 0);
      summary.overpaidAmount += Number(t.overpaidAmount || 0);
      if (t.status === 'PENDING') {
        summary.pending += 1;
        summary.pendingBalance += Number(t.pendingBalance || 0);
      } else if (t.status === 'DONE') {
        summary.done += 1;
      } else if (t.status === 'OVERPAID') {
        summary.overpaid += 1;
      }
    }

    res.json({ summary, records: rows });
  } catch (err) { next(err); }
});

app.post('/api/admin/bulk-delete', requireAuth, requireAdminOrEditor, async (req, res, next) => {
  try {
    if (normalizeRole(req.user.role) !== 'admin') return res.status(403).json({ message: 'Only admin can bulk delete' });
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ message: 'No ids provided' });
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const { error } = await supabase.from('transactions').delete().in('id', chunk);
      if (error) throw error;
    }
    res.json({ ok: true, deleted: ids.length });
  } catch (err) { next(err); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || err.statusCode || (err.code === '23505' ? 409 : 500);
  res.status(status).json({ message: err.message || 'Server error', code: err.code });
});

app.listen(PORT, () => console.log(`BM Core backend running on http://localhost:${PORT}`));
