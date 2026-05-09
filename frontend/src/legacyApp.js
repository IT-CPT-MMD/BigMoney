// BM Core API client. Database access is now handled by the Node/Express backend.
const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "https://bigmoney-x3q7.onrender.com"
).replace(/\/$/, "");

console.log("API_BASE_URL =", API_BASE_URL);

function authToken() {
  return localStorage.getItem("bm_token") || "";
}

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const token = authToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const text = await res.text();

  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { message: text };
  }

  if (!res.ok) {
    const err = new Error(
      payload?.message ||
      payload?.error ||
      `API error ${res.status}`
    );

    err.status = res.status;
    err.payload = payload;

    throw err;
  }

  return payload;
}

const app = { apiBaseUrl: API_BASE_URL };
const db = app;

function configLooksMissing() { return false; }
function serverTimestamp() { return { __serverTimestamp: true }; }
function tableName(ref) { return ref?.collection || ref?.name || ref; }
function collection(_db, name) { return { name }; }
function doc(_db, collectionName, id) { return { collection: collectionName, id: String(id) }; }
function cleanForSave(value) {
  if (value && value.__serverTimestamp) return new Date().toISOString();
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(cleanForSave);
  if (value && typeof value === "object") {
    const out = {};
    Object.entries(value).forEach(([k, v]) => { out[k] = cleanForSave(v); });
    return out;
  }
  return value;
}
function timestampObject(iso) {
  return {
    toDate: () => new Date(iso),
    toMillis: () => new Date(iso).getTime()
  };
}
function hydrateFromSave(value, key = "") {
  if (Array.isArray(value)) return value.map(v => hydrateFromSave(v, key));
  if (value && typeof value === "object") {
    if (typeof value.toDate === "function") return value;
    const out = {};
    Object.entries(value).forEach(([k, v]) => { out[k] = hydrateFromSave(v, k); });
    return out;
  }
  if (typeof value === "string" && /(createdAt|updatedAt|modifiedAt|lastSeenAt|reservedAt|paidAt)$/i.test(key) && !Number.isNaN(Date.parse(value))) {
    return timestampObject(value);
  }
  return value;
}
function camelCaseKey(key) {
  return String(key || "").replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function normalizePlatformCode(value) {
  return String(value || "").trim().replace(/^MD\s+/i, "");
}
function firstValue(...values) {
  return values.find(v => v !== undefined && v !== null && String(v).trim?.() !== "") ?? "";
}
function numberValue(...values) {
  const value = firstValue(...values);
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function statusFromAmounts(status, amount, paidAmount, pendingBalance) {
  if (status) return String(status).toUpperCase();
  if (paidAmount > amount && amount > 0) return "OVERPAID";
  if (pendingBalance > 0 || (amount > paidAmount && amount > 0)) return "PENDING";
  return paidAmount > 0 ? "DONE" : "PENDING";
}
function datePart(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
function flatRowToData(row) {
  if (!row || typeof row !== "object") return {};
  const out = {};
  Object.entries(row).forEach(([key, value]) => {
    if (["data", "updated_at"].includes(key)) return;
    out[camelCaseKey(key)] = value;
  });

  const idPlatform = String(row.id || "").includes("__") ? String(row.id).split("__")[0] : "";
  const platformId = normalizePlatformCode(firstValue(row.platform_id, row.platformId, row.platform_code, row.platformCode, row.platform, row.platform_name, row.platformName, idPlatform));
  const orderId = firstValue(row.order_id, row.orderId, String(row.id || "").includes("__") ? String(row.id).split("__").slice(1).join("__") : "");
  const amount = numberValue(row.amount, row.total_amount, row.totalAmount, row.total, row.required_amount, row.requiredAmount, row.total_paid, row.totalPaid);
  const paidAmount = numberValue(row.paid_amount, row.paidAmount, row.total_paid, row.totalPaid, row.paid);
  const pendingBalance = numberValue(row.pending_balance, row.pendingBalance, row.pending_amount, row.pendingAmount, Math.max(amount - paidAmount, 0));
  const overpaidAmount = numberValue(row.overpaid_amount, row.overpaidAmount, Math.max(paidAmount - amount, 0));
  const createdAt = firstValue(row.created_at, row.createdAt);
  const updatedAt = firstValue(row.updated_at, row.updatedAt);

  return {
    ...out,
    orderId,
    platformId: platformId || out.platformId,
    platformCode: platformId || out.platformCode,
    platformName: platformId ? `MD ${platformId}` : out.platformName,
    clientId: firstValue(row.client_id, row.clientId, row.customer_id, row.customerId, row.account_id, row.accountId),
    clientName: firstValue(row.client_name, row.clientName, row.customer_name, row.customerName, row.name),
    phoneNumber: firstValue(row.phone_number, row.phoneNumber, row.client_account_number, row.clientAccountNumber, row.account_number, row.accountNumber),
    amount,
    paidAmount,
    pendingBalance,
    overpaidAmount,
    processedBank: firstValue(row.processed_bank, row.processedBank, row.bank_name, row.bankName, row.bank),
    bank: firstValue(row.bank, row.bank_name, row.bankName, row.processed_bank, row.processedBank),
    bankStatus: firstValue(row.bank_status, row.bankStatus),
    status: statusFromAmounts(firstValue(row.status), amount, paidAmount, pendingBalance),
    createdBy: firstValue(row.created_by, row.createdBy),
    updatedBy: firstValue(row.updated_by, row.updatedBy),
    editedBy: firstValue(row.edited_by, row.editedBy),
    editedNote: firstValue(row.edited_note, row.editedNote),
    remark: firstValue(row.remark, row.note, row.edited_note, row.editedNote),
    createdAt: createdAt ? timestampObject(createdAt) : out.createdAt,
    updatedAt: updatedAt ? timestampObject(updatedAt) : out.updatedAt,
    date: firstValue(row.date, row.created_date, row.createdDate, datePart(createdAt)),
    createdTimeText: firstValue(row.created_time_text, row.createdTimeText, createdAt),
    modifiedTimeText: firstValue(row.modified_time_text, row.modifiedTimeText, updatedAt),
    deleted: row.deleted === true || row.is_deleted === true
  };
}
function rowToDoc(row) {
  const flatData = hydrateFromSave(flatRowToData(row), "");
  const jsonData = hydrateFromSave(row?.data || {}, "");
  const data = { ...flatData, ...jsonData };
  return { id: row.id, data: () => data, exists: () => Boolean(row), _data: data };
}
async function getDoc(ref) {
  const payload = await apiRequest(`/api/docs/${encodeURIComponent(tableName(ref))}/${encodeURIComponent(ref.id)}`);
  if (!payload?.data) return { exists: () => false, data: () => null, id: ref.id };
  return rowToDoc(payload.data);
}
async function getDocs(colRef) {
  const name = tableName(colRef);
  const params = new URLSearchParams();
  if (name === "transactions") {
    params.set("platformId", selectedPlatformId || "all");
    if (currentPage === "dashboard") {
      params.set("date", $("dashboardDate")?.value || todayISO());
      params.set("limit", "5000");
    } else if (currentPage === "history") {
      const date = $("historyDate")?.value || "";
      if (date) params.set("date", date);
      params.set("limit", "500");
    } else if (currentPage === "limits") {
      // Limit box loads pending transactions from the past three days only.
      params.set("dateFrom", isoDaysAgo(2));
      params.set("dateTo", todayISO());
      params.set("status", "PENDING");
      params.set("limit", "200");
    } else {
      params.set("limit", "500");
    }
  }
  if (name === "riskReports") {
    params.set("platformId", selectedPlatformId || "all");
    const date = $("riskDate")?.value || ""; if (date) params.set("date", date);
    params.set("limit", "500");
  }
  if (name === "users") params.set("limit", "1000");
  const query = params.toString() ? `?${params.toString()}` : "";
  const payload = await apiRequest(`/api/collections/${encodeURIComponent(name)}${query}`);
  return { docs: (payload?.data || []).map(rowToDoc) };
}
async function insertDoc(ref, value) {
  await apiRequest(`/api/docs/${encodeURIComponent(tableName(ref))}/${encodeURIComponent(ref.id)}`, {
    method: "POST",
    body: JSON.stringify({ data: cleanForSave(value || {}) })
  });
}
async function setDoc(ref, value, options = {}) {
  await apiRequest(`/api/docs/${encodeURIComponent(tableName(ref))}/${encodeURIComponent(ref.id)}`, {
    method: options.merge ? "PATCH" : "PUT",
    body: JSON.stringify({ data: cleanForSave(value || {}) })
  });
}
async function updateDoc(ref, value) {
  await setDoc(ref, value, { merge: true });
}
async function deleteDoc(ref) {
  await apiRequest(`/api/docs/${encodeURIComponent(tableName(ref))}/${encodeURIComponent(ref.id)}`, { method: "DELETE" });
}
async function runTransaction(_db, callback) {
  const operations = [];
  const trx = {
    get: (ref) => getDoc(ref),
    set: (ref, value) => operations.push(() => insertDoc(ref, value)),
    update: (ref, value) => operations.push(() => updateDoc(ref, value)),
    delete: (ref) => operations.push(() => deleteDoc(ref))
  };
  await callback(trx);
  for (const op of operations) await op();
}
function onSnapshot(colRef, next, errorCb) {
  // Frontend realtime was removed to prevent heavy reads. It refreshes only when the tab logic asks for data.
  let stopped = false;
  const refresh = async () => {
    if (stopped) return;
    try { next(await getDocs(colRef)); } catch (err) { errorCb?.(err); }
  };
  refresh();
  return () => { stopped = true; };
}
const $ = (id) => document.getElementById(id);
const isApp = location.pathname.includes("app.html");
const MYANMAR_TZ = "Asia/Yangon";
const money = (n) => Number(n || 0).toLocaleString("en-US");
let currentUser = JSON.parse(localStorage.getItem("bm_user") || "null");
let allTransactions = [];
let allRisks = [];
let allUsers = [];
let activityChart = null;
let dashboardPage = 1;
let historyPage = 1;
let limitsPage = 1;
let usersPage = 1;
const USERS_PAGE_SIZE = 10;
const INACTIVITY_LIMIT_MS = 60 * 60 * 1000;
const ONLINE_STALE_MS = 60 * 60 * 1000;
const ONLINE_HEARTBEAT_MS = 5 * 60 * 1000;
let inactivityTimer = null;
let lastOnlineHeartbeat = 0;
let activePayTx = null;
let activeEditTx = null;
let currentMyanmarDay = null;
let orderCheckTimer = null;
let orderIdCheckState = "idle";
let lockedOrderReservation = null;
const ORDER_LOCK_TTL_MS = 15 * 60 * 1000;
const ORDER_SESSION_ID = (() => {
  const key = "bm_order_session_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
})();
let activeEditUserId = null;
let activeUserPlatformMode = "edit";
let pendingNewUser = null;
let currentPage = "dashboard";
let dashboardRefreshTimer = null;
let userRefreshTimer = null;
let riskLoadedForThisVisit = false;
let dataLoadInProgress = false;

const DEFAULT_PLATFORM_ID = "4-2";
const DEFAULT_PLATFORM_CODES = [
  "4-1", "4-2", "4-4", "4-3", "4-5", "4-6", "4-8", "4-9", "4-10", "4-11",
  "4-12", "4-14", "4-15", "4-16", "4-17", "4-18", "4-19", "4-20",
  "4-22", "4-23", "4-24", "4-25", "4-26", "4-27", "4-28", "4-29", "4-30", "4-31",
  "4-33", "4-34", "4-40002", "4-40003", "4-40001"
];
let PLATFORM_LIST = DEFAULT_PLATFORM_CODES.map(id => ({ id, name: `MD ${id}`, status: "active" }));
function activePlatforms() { return PLATFORM_LIST.filter(p => p.status !== "inactive" && p.active !== false); }
let selectedPlatformId = localStorage.getItem("bm_selected_platform") || DEFAULT_PLATFORM_ID;

function normalizeRole(role) { return role === "user" ? "qa" : String(role || "qa").toLowerCase(); }
function userRole() { return normalizeRole(currentUser?.role); }
function canManageUsers() { return ["admin", "editor"].includes(userRole()); }
function canSeeRisk() { return ["admin", "editor"].includes(userRole()); }
function canBulkDelete() { return userRole() === "admin"; }
function canDeleteRisk() { return userRole() === "admin"; }
function canDeleteRecord() { return ["admin", "editor"].includes(userRole()); }
function isAdminUser(u) { return normalizeRole(u?.role) === "admin" || u?.id === "admin" || u?.username === "admin"; }
function platformOf(t) { return normalizePlatformCode(t?.platformId || t?.platformCode || t?.platform || t?.platformName) || DEFAULT_PLATFORM_ID; }
function platformName(id) { return id === "all" ? "All Platforms" : (PLATFORM_LIST.find(p => p.id === id)?.name || id || "Unknown"); }
function availablePlatformIds() {
  const allowed = Array.isArray(currentUser?.allowedPlatforms) ? currentUser.allowedPlatforms : [];
  if (userRole() === "admin") return activePlatforms().map(p => p.id);
  // Editors and QA users are limited to only the platforms assigned in their user profile.
  // This prevents an editor from viewing or creating records for every platform.
  // If an editor/QA document accidentally has ["all"], ignore it and require explicit platforms.
  const explicit = allowed.filter(id => id !== "all" && activePlatforms().some(p => p.id === id));
  return explicit.length ? explicit : [DEFAULT_PLATFORM_ID];
}
function canAccessPlatform(id) { return id === "all" || availablePlatformIds().includes(id); }
function platformDocId(platformId, orderId) { return `${platformId}__${String(orderId || "").trim()}`.replace(/[^A-Za-z0-9_-]/g, "_"); }
function platformScope(arr = allTransactions) {
  const active = activeTx(arr);
  if (!selectedPlatformId || selectedPlatformId === "all") return active.filter(t => canAccessPlatform(platformOf(t)));
  return active.filter(t => platformOf(t) === selectedPlatformId && canAccessPlatform(platformOf(t)));
}
function assignablePlatformIds() {
  return userRole() === "admin" ? activePlatforms().map(p => p.id) : availablePlatformIds();
}
function platformCheckboxHtml(selectedIds = [], optionIds = assignablePlatformIds()) {
  const selected = new Set(selectedIds || []);
  return activePlatforms().filter(p => optionIds.includes(p.id)).map(p => {
    const checked = selected.has(p.id) ? "checked" : "";
    return `<label class="platform-check-card"><input type="checkbox" value="${attr(p.id)}" ${checked} /> <span>${safe(p.name)}</span></label>`;
  }).join("");
}
function setPlatformCheckboxes(selectedIds = [], optionIds = assignablePlatformIds()) {
  const box = $("editAllowedPlatforms");
  if (!box) return;
  box.innerHTML = platformCheckboxHtml(selectedIds, optionIds);
}
function getPlatformCheckboxValues() {
  return [...document.querySelectorAll("#editAllowedPlatforms input[type='checkbox']:checked")].map(x => x.value);
}
function setAllPlatformChecks(checked) {
  document.querySelectorAll("#editAllowedPlatforms input[type='checkbox']:not(:disabled)").forEach(cb => { cb.checked = checked; });
}
function populatePlatformSelects() {
  const allowed = availablePlatformIds();
  const platformOptions = activePlatforms().filter(p => allowed.includes(p.id));
  const allOption = userRole() === "admin" || allowed.length > 1;
  const globalOptions = `${allOption ? '<option value="all">All Platforms</option>' : ''}${platformOptions.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}`;
  const global = $("globalPlatformSelect");
  if (global) {
    global.innerHTML = globalOptions;
    global.value = canAccessPlatform(selectedPlatformId) ? selectedPlatformId : (platformOptions[0]?.id || DEFAULT_PLATFORM_ID);
  }
  const usersPlatformFilter = $("usersPlatformFilter");
  if (usersPlatformFilter) {
    const filterIds = userRole() === "admin" ? activePlatforms().map(p => p.id) : allowed;
    const optionsHtml = `<option value="all">All platform access</option>${activePlatforms().filter(p => filterIds.includes(p.id)).map(p => `<option value="${p.id}">${p.name}</option>`).join("")}`;
    if (usersPlatformFilter.dataset.optionsHtml !== optionsHtml) {
      usersPlatformFilter.innerHTML = optionsHtml;
      usersPlatformFilter.dataset.optionsHtml = optionsHtml;
    }
  }
  const bulkPlatformSelect = $("bulkPlatformSelect");
  if (bulkPlatformSelect) {
    const optionsHtml = `<option value="all">All Platforms</option>${activePlatforms().map(p => `<option value="${p.id}">${p.name}</option>`).join("")}`;
    if (bulkPlatformSelect.dataset.optionsHtml !== optionsHtml) {
      bulkPlatformSelect.innerHTML = optionsHtml;
      bulkPlatformSelect.dataset.optionsHtml = optionsHtml;
    }
    if (!bulkPlatformSelect.value) bulkPlatformSelect.value = "all";
  }
}
function changePlatform(id) {
  selectedPlatformId = canAccessPlatform(id) ? id : DEFAULT_PLATFORM_ID;
  localStorage.setItem("bm_selected_platform", selectedPlatformId);
  populatePlatformSelects();
  refreshCurrentPageWithLoader("Loading data...").catch(err => console.warn("Platform refresh failed", err));
  if (currentPage === "users") loadUsersOnce().catch(err => console.warn("User refresh failed", err));
  if (currentPage === "risk") loadRisksOnce().catch(err => console.warn("Risk refresh failed", err));
  renderPlatformManagement();
}
async function seedPlatforms() {
  for (const code of DEFAULT_PLATFORM_CODES) {
    const ref = doc(db, "platforms", code);
    const snap = await getDoc(ref).catch(() => null);
    if (!snap || !snap.exists()) {
      await setDoc(ref, { id: code, name: `MD ${code}`, status: "active", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
  }
}
async function loadPlatformsOnce() {
  const snap = await getDocs(collection(db, "platforms"));
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const map = new Map(DEFAULT_PLATFORM_CODES.map(code => [code, { id: code, name: `MD ${code}`, status: "active" }]));
  rows.forEach(p => map.set(p.id, { id: p.id, name: p.name || `MD ${p.id}`, status: p.status || "active", createdAt: p.createdAt, updatedAt: p.updatedAt }));
  PLATFORM_LIST = [...map.values()];
  populatePlatformSelects();
  renderPlatformManagement();
}
async function addPlatformFromSettings(e) {
  e?.preventDefault?.();
  if (userRole() !== "admin") return toast("Only admin can add platforms", "error");
  const input = $("newPlatformCode");
  const code = String(input?.value || "").trim();
  if (!code) return toast("Enter platform code", "error");
  const id = code.replace(/\s+/g, "-");
  if (PLATFORM_LIST.some(p => p.id.toLowerCase() === id.toLowerCase())) return toast("Platform already exists", "error");
  await setDoc(doc(db, "platforms", id), { id, name: `MD ${id}`, status: "active", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: currentUser.username });
  if (input) input.value = "";
  await loadPlatformsOnce();
  toast("Platform added", "success");
}
async function togglePlatformStatus(id) {
  if (userRole() !== "admin") return toast("Only admin can manage platforms", "error");
  if (id === DEFAULT_PLATFORM_ID) return toast("Default platform cannot be disabled", "error");
  const p = PLATFORM_LIST.find(x => x.id === id);
  if (!p) return;
  const nextStatus = p.status === "inactive" ? "active" : "inactive";
  if (nextStatus === "inactive" && !confirm(`Disable ${platformName(id)}? Old records will stay in history.`)) return;
  await setDoc(doc(db, "platforms", id), { id, name: p.name || `MD ${id}`, status: nextStatus, updatedAt: serverTimestamp(), updatedBy: currentUser.username }, { merge: true });
  await loadPlatformsOnce();
  toast(nextStatus === "active" ? "Platform enabled" : "Platform disabled", "success");
}
function renderPlatformManagement() {
  const tbody = $("platformsTable");
  if (!tbody) return;
  tbody.innerHTML = PLATFORM_LIST.map(p => `<tr><td>${safe(p.name || p.id)}</td><td>${safe(p.id)}</td><td>${badge(p.status === "inactive" ? "DISABLED" : "ACTIVE")}</td><td>${userRole() === "admin" ? `<button class="small-btn" data-platform-toggle="${attr(p.id)}">${p.status === "inactive" ? "Enable" : "Disable"}</button>` : ""}</td></tr>`).join("");
  document.querySelectorAll("[data-platform-toggle]").forEach(btn => btn.onclick = () => togglePlatformStatus(btn.dataset.platformToggle));
}
function platformBadge(t) { return `<span class="platform-badge">${safe(platformName(platformOf(t)))}</span>`; }
function myanmarParts(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MYANMAR_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
  }).formatToParts(date).reduce((a, p) => (a[p.type] = p.value, a), {});
}
function todayISO() { const p = myanmarParts(); return `${p.year}-${p.month}-${p.day}`; }
function isoDaysAgo(days) {
  const base = new Date(`${todayISO()}T00:00:00+06:30`);
  base.setUTCDate(base.getUTCDate() - Number(days || 0));
  return base.toISOString().slice(0, 10);
}
function isDateInLastDays(dateValue, days) {
  const d = String(dateValue || '').slice(0, 10);
  if (!d) return false;
  return d >= isoDaysAgo(Math.max(Number(days || 1) - 1, 0)) && d <= todayISO();
}
function myanmarDateText(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", { timeZone: MYANMAR_TZ, weekday: "short", year: "numeric", month: "short", day: "2-digit" }).format(date);
}
function myanmarTimeOnly(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", { timeZone: MYANMAR_TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(date);
}
function myanmarDateTimeText(date = new Date()) {
  return `${myanmarDateText(date)} ${myanmarTimeOnly(date)}`;
}
function firestoreDateToISO(t) {
  try {
    const d = t?.createdAt?.toDate ? t.createdAt.toDate() : null;
    if (!d) return "";
    const p = myanmarParts(d);
    return `${p.year}-${p.month}-${p.day}`;
  } catch { return ""; }
}
function txDate(t) { return t?.date || firestoreDateToISO(t) || ""; }
function dateObjToMyanmarISO(dateObj) {
  try {
    const p = myanmarParts(dateObj);
    return `${p.year}-${p.month}-${p.day}`;
  } catch { return ""; }
}
function paidLineDate(line, tx) {
  if (line?.paidAtISO) return String(line.paidAtISO).slice(0, 10);
  if (line?.date) return String(line.date).slice(0, 10);
  if (line?.paidAt?.toDate) return dateObjToMyanmarISO(line.paidAt.toDate());
  if (tx?.modifiedAt?.toDate) return dateObjToMyanmarISO(tx.modifiedAt.toDate());
  if (tx?.updatedAt?.toDate) return dateObjToMyanmarISO(tx.updatedAt.toDate());
  return txDate(tx);
}
function isLimitDoneRecord(t) {
  // Limit Done must only show transactions completed through the Pay Pending Limit flow.
  // Normal DONE transactions from Add Transaction/History must not appear here.
  return t?.status === "DONE" && (t?.limitPaymentCompleted === true || (Array.isArray(t?.limitPaymentLines) && t.limitPaymentLines.length > 0));
}
function limitDoneDateValue(t) {
  const lines = Array.isArray(t?.limitPaymentLines) ? t.limitPaymentLines : [];
  if (lines.length) return paidLineDate(lines[lines.length - 1], t);
  return t?.limitCompletedDate || (t?.modifiedAt?.toDate ? dateObjToMyanmarISO(t.modifiedAt.toDate()) : txDate(t));
}
function formatCreatedTime(t) {
  if (t?.createdAt?.toDate) return myanmarDateTimeText(t.createdAt.toDate());
  return t?.createdTimeText || t?.createdTime || "";
}
function formatModifiedTime(t) {
  if (t?.modifiedAt?.toDate) return myanmarDateTimeText(t.modifiedAt.toDate());
  if (t?.updatedAt?.toDate) return myanmarDateTimeText(t.updatedAt.toDate());
  return t?.modifiedTimeText || t?.updatedTimeText || "";
}
function toast(msg, type = "success") {
  const root = $("toastRoot");
  if (!root) return alert(msg);
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(20px)"; setTimeout(() => el.remove(), 250); }, 3800);
}
function loader(show, text = "Processing...") {
  const l = $("pageLoader");
  if (!l) return;
  const label = l.querySelector(".loader-card span");
  if (label) label.textContent = text;
  l.classList.toggle("hidden", !show);
}
function setButtonLoading(btn, show) {
  if (!btn) return;
  if (show) btn.dataset.loading = "true"; else delete btn.dataset.loading;
  btn.disabled = show;
  const text = btn.querySelector(".btn-text");
  const spin = btn.querySelector(".btn-loader");
  if (text && spin) { text.classList.toggle("hidden", show); spin.classList.toggle("hidden", !show); }
}
function setDbStatus(text, type = "") {
  const el = $("dbStatus");
  if (!el) return;
  el.textContent = text;
  el.className = `db-status ${type}`;
}
function requireLogin() { if (isApp && !currentUser) location.href = "index.html"; }
function applyTheme() {
  const t = localStorage.getItem("bm_theme") || "light";
  document.body.classList.toggle("dark", t === "dark");
  const b = $("themeToggle"); if (b) b.textContent = t === "dark" ? "Light" : "Dark";
}
function toggleTheme() { localStorage.setItem("bm_theme", document.body.classList.contains("dark") ? "light" : "dark"); applyTheme(); }

// LOGIN PAGE
if (!isApp) {
  applyTheme();
  installBasicSourceProtection();
  $("togglePassword")?.addEventListener("click", () => {
    const p = $("loginPassword");
    const btn = $("togglePassword");
    const isHidden = p.type === "password";
    p.type = isHidden ? "text" : "password";
    btn.classList.toggle("is-visible", isHidden);
    btn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    btn.setAttribute("title", isHidden ? "Hide password" : "Show password");
  });
  $("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter;
    setButtonLoading(btn, true);
    const username = $("loginUsername").value.trim();
    const password = $("loginPassword").value;
    try {
      const result = await apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      const u = result.user;
      localStorage.setItem("bm_token", result.token);
      localStorage.setItem("bm_user", JSON.stringify({ username: u.username || username, role: normalizeRole(u.role), status: u.status || "active", allowedPlatforms: Array.isArray(u.allowedPlatforms) ? u.allowedPlatforms : [] }));
      toast(`Welcome ${u.username || username}`, "success");
      setTimeout(() => location.href = "app.html", 500);
    } catch (err) {
      console.error(err);
      toast(err.code === "PGRST" ? "Login blocked by Supabase permissions. Check tables/RLS." : err.message || "Login failed", "error");
    } finally { setButtonLoading(btn, false); }
  });
}

// APP INIT
if (isApp) {
  requireLogin();
  applyTheme();
  currentUser.role = normalizeRole(currentUser.role);
  if (userRole() === "admin") selectedPlatformId = "all";
  $("currentUserName").textContent = currentUser.username;
  $("currentUserRole").textContent = currentUser.role.toUpperCase();
  if ($("qaUser")) $("qaUser").value = `QA/User: ${currentUser.username}`;
  if (!canAccessPlatform(selectedPlatformId)) selectedPlatformId = availablePlatformIds()[0] || DEFAULT_PLATFORM_ID;
  populatePlatformSelects();
  $("globalPlatformSelect")?.addEventListener("change", e => changePlatform(e.target.value));
  if ($("dashboardDate")) $("dashboardDate").value = todayISO();
  if ($("historyDate")) $("historyDate").value = todayISO();
  if ($("limitDoneDate")) $("limitDoneDate").value = todayISO();
  if ($("pendingPaidDate")) $("pendingPaidDate").value = todayISO();
  if ($("riskDate")) $("riskDate").value = todayISO();
  if (!canManageUsers()) document.querySelectorAll(".manage-users-nav").forEach(x => x.style.display = "none");
  if (!canSeeRisk()) document.querySelectorAll(".risk-nav").forEach(x => x.style.display = "none");
  if (!canBulkDelete()) document.querySelectorAll(".admin-delete-tools").forEach(x => x.style.display = "none");
  setUserOnline(true);
  startInactivityTimeout();

  $("themeToggle")?.addEventListener("click", toggleTheme);
  $("settingsThemeBtn")?.addEventListener("click", toggleTheme);
  $("mobileMenuBtn")?.addEventListener("click", () => $("sidebar").classList.toggle("open"));
  $("logoutBtn")?.addEventListener("click", async () => { await setUserOnline(false); localStorage.removeItem("bm_user"); localStorage.removeItem("bm_token"); location.href = "index.html"; });
  window.addEventListener("beforeunload", () => { releaseOrderReservationOnUnload(); setUserOnline(false); });
  lockNumberInputChanges(document);
  document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => showPage(btn.dataset.page)));
  $("addLineBtn")?.addEventListener("click", () => addPaymentLine());
  $("copyFormatBtn")?.addEventListener("click", () => copyText($("generatedFormat").value));
  $("clearTransactionBtn")?.addEventListener("click", clearTransactionForm);
  $("orderId")?.addEventListener("input", handleOrderIdInput);
  // Order ID check is instant/debounced on input. No realtime listener is used.
  $("orderId")?.addEventListener("blur", () => { if (!lockedOrderReservation) checkOrderIdNow(true); });
  $("checkOrderIdBtn")?.addEventListener("click", reserveOrderId);
  $("transactionForm")?.addEventListener("submit", saveTransaction);
  $("transactionForm")?.addEventListener("keydown", handleTransactionFormKeydown);
  ["amount", "bank"].forEach(id => $(id)?.addEventListener("input", updatePreviews));
  $("userForm")?.addEventListener("submit", addUser);
  $("userSearch")?.addEventListener("input", () => { usersPage = 1; renderUsers(); });
  $("usersPlatformFilter")?.addEventListener("change", () => { usersPage = 1; renderUsers(); });
  $("closeUserPlatformModal")?.addEventListener("click", closeUserPlatformModal);
  $("cancelUserPlatformsBtn")?.addEventListener("click", closeUserPlatformModal);
  $("saveUserPlatformsBtn")?.addEventListener("click", saveUserPlatforms);
  $("checkAllPlatformsBtn")?.addEventListener("click", () => setAllPlatformChecks(true));
  $("uncheckAllPlatformsBtn")?.addEventListener("click", () => setAllPlatformChecks(false));
  $("editUserAllPlatforms")?.addEventListener("change", () => {
    const locked = $("editUserAllPlatforms").checked;
    document.querySelectorAll("#editAllowedPlatforms input[type=checkbox]").forEach(cb => cb.disabled = locked);
  });
  if (userRole() === "editor" && $("newRole")) { $("newRole").value = "qa"; $("newRole").disabled = true; }
  $("exportCsvBtn")?.addEventListener("click", exportCSV);
  $("dashboardDate")?.addEventListener("change", () => { dashboardPage = 1; refreshCurrentPageWithLoader("Loading dashboard data...").catch(err => console.warn("Dashboard date load failed", err)); });
  $("dashboardTodayBtn")?.addEventListener("click", () => { $("dashboardDate").value = todayISO(); dashboardPage = 1; refreshCurrentPageWithLoader("Loading dashboard data...").catch(err => console.warn("Dashboard today load failed", err)); });
  $("historyTodayBtn")?.addEventListener("click", () => { $("historyDate").value = todayISO(); historyPage = 1; loadTransactionsOnce().then(renderHistory); });
  $("historySearchBtn")?.addEventListener("click", () => { historyPage = 1; loadTransactionsOnce().then(renderHistory); });
  $("historySearch")?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("historySearchBtn")?.click(); } });
  $("limitSearchBtn")?.addEventListener("click", () => { limitsPage = 1; loadTransactionsOnce().then(renderLimits); });
  $("limitSearch")?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); limitsPage = 1; $("limitSearchBtn")?.click(); } });
  $("limitDoneTodayBtn")?.addEventListener("click", () => { $("limitDoneDate").value = todayISO(); loadTransactionsOnce().then(renderLimits); });
  $("limitDoneAllBtn")?.addEventListener("click", () => { $("limitDoneDate").value = ""; loadTransactionsOnce().then(renderLimits); });
  $("pendingPaidSearchBtn")?.addEventListener("click", () => { loadTransactionsOnce().then(renderLimits); });
  $("pendingPaidTodayBtn")?.addEventListener("click", () => { $("pendingPaidDate").value = todayISO(); loadTransactionsOnce().then(renderLimits); });
  $("pendingPaidAllBtn")?.addEventListener("click", () => { $("pendingPaidDate").value = ""; loadTransactionsOnce().then(renderLimits); });
  $("riskTodayBtn")?.addEventListener("click", () => { $("riskDate").value = todayISO(); loadRisksOnce(); });
  $("riskAllBtn")?.addEventListener("click", () => { $("riskDate").value = ""; loadRisksOnce(); });
  $("riskSearchBtn")?.addEventListener("click", () => loadRisksOnce());
  $("bulkExportBtn")?.addEventListener("click", bulkExportCSV);
  $("bulkDeleteBtn")?.addEventListener("click", bulkDeleteSelected);
  $("changePasswordForm")?.addEventListener("submit", changeOwnPassword);
  $("platformForm")?.addEventListener("submit", addPlatformFromSettings);
  $("closePayModal")?.addEventListener("click", closePayModal);
  $("payLimitForm")?.addEventListener("submit", payLimit);
  $("closeEditTxModal")?.addEventListener("click", closeEditTxModal);
  $("cancelEditTxBtn")?.addEventListener("click", closeEditTxModal);
  $("editTxForm")?.addEventListener("submit", saveEditedTx);

  addPaymentLine();
  updateClock(); setInterval(updateClock, 1000);
  bootData();
}

function updateClock() {
  const d = $("dateOnly"); const t = $("timeOnly");
  if (d) d.textContent = myanmarDateText();
  if (t) t.textContent = myanmarTimeOnly();
  const today = todayISO();
  if (currentMyanmarDay && currentMyanmarDay !== today) {
    if ($("dashboardDate")) $("dashboardDate").value = today;
    renderDashboard();
  }
  currentMyanmarDay = today;
}
function showPage(page) {
  if (page === "users" && !canManageUsers()) return toast("No access to users page", "error");
  if (page === "risk" && !canSeeRisk()) return toast("No access to risk reports", "error");
  currentPage = page || "dashboard";
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active-page"));
  $(`${page}Page`)?.classList.add("active-page");
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  $("pageTitle").textContent = page === "add" ? "Add Transaction" : page === "limits" ? "Limits / Pending" : page === "risk" ? "Risk Reports" : page.charAt(0).toUpperCase() + page.slice(1);
  $("sidebar")?.classList.remove("open");
  if (page === "dashboard") loadTransactionsOnce().catch(err => console.warn("Dashboard load failed", err));
  if (page === "history") { historyPage = 1; loadTransactionsOnce().then(renderHistory).catch(err => console.warn("History load failed", err)); }
  if (page === "limits") { limitsPage = 1; loadTransactionsOnce().then(renderLimits).catch(err => console.warn("Pending load failed", err)); }
  if (page === "users") loadUsersOnce().catch(err => console.warn("User status load failed", err));
  if (page === "risk") loadRisksOnce().catch(err => console.warn("Risk load failed", err));
}
function addPaymentLine(code = "", amount = "") {
  const wrap = $("paymentLines"); if (!wrap) return;
  const row = document.createElement("div"); row.className = "payment-line";
  row.innerHTML = `<input class="line-code" placeholder="Ex: KBZ_DA_64275 or KBZ_CPN_39688" value="${code}"><input class="line-amount" type="number" placeholder="Amount" value="${amount}"><button type="button" class="remove-line">×</button>`;
  row.querySelectorAll("input").forEach(i => i.addEventListener("input", updatePreviews));
  lockNumberInputChanges(row);
  row.querySelector(".remove-line").addEventListener("click", () => { row.remove(); updatePreviews(); });
  wrap.appendChild(row);
  lockTransactionFields(Boolean(lockedOrderReservation));
  updatePreviews();
}
function handleTransactionFormKeydown(e) {
  if (e.key !== "Enter") return;
  const tag = String(e.target?.tagName || "").toLowerCase();
  if (tag === "textarea") return;
  const inPaymentLine = e.target?.closest?.(".payment-line");
  e.preventDefault();
  if (inPaymentLine) {
    addPaymentLine();
    const rows = document.querySelectorAll(".payment-line");
    rows[rows.length - 1]?.querySelector(".line-code")?.focus();
  }
}
function extractCode(v) {
  const raw = String(v || "").trim();
  if (!raw) return "";
  const parts = raw.split(/[ _-]+/).filter(Boolean);
  return parts[parts.length - 1] || raw;
}
function getLines() {
  return [...document.querySelectorAll(".payment-line")]
    .map(r => ({ accountCode: r.querySelector(".line-code").value.trim(), amount: Number(r.querySelector(".line-amount").value || 0) }))
    .filter(x => x.accountCode && x.amount > 0);
}
function makeFormat(lines) { return lines.length ? `${lines.map(l => `${extractCode(l.accountCode)}-${Number(l.amount || 0)}`).join("/")}////` : ""; }
function getBankCheck(lines, bank) {
  if (!lines.length) return true;
  const b = String(bank || "").toUpperCase();
  if (b === "KBZ") return lines.every(l => String(l.accountCode).toUpperCase().includes("KBZ"));
  if (b === "WAVE") return lines.every(l => String(l.accountCode).toUpperCase().includes("WAVE"));
  return true;
}
function calcStatus(amount, paid) { return paid === amount ? "DONE" : paid < amount ? "PENDING" : "OVERPAID"; }
async function setUserOnline(isOnline) {
  if (!currentUser?.username) return;
  try { await updateDoc(doc(db, "users", currentUser.username), { online: Boolean(isOnline), lastSeenAt: serverTimestamp(), lastSeenText: myanmarDateTimeText() }); }
  catch (err) { console.warn("Could not update online status", err); }
}
function markUserActivity() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(forceInactiveLogout, INACTIVITY_LIMIT_MS);
  const now = Date.now();
  if (now - lastOnlineHeartbeat > ONLINE_HEARTBEAT_MS) {
    lastOnlineHeartbeat = now;
    setUserOnline(true);
  }
}
async function forceInactiveLogout() {
  toast("Logged out because there was no activity for 1 hour.", "error");
  await setUserOnline(false);
  localStorage.removeItem("bm_user");
  setTimeout(() => { location.href = "index.html"; }, 700);
}
function startInactivityTimeout() {
  markUserActivity();
  ["click", "keydown", "mousemove", "mousedown", "touchstart", "scroll", "input"].forEach(evt => {
    window.addEventListener(evt, markUserActivity, { passive: true });
  });
}
function lastSeenMillis(u) {
  try {
    if (u?.lastSeenAt?.toDate) return u.lastSeenAt.toDate().getTime();
    if (u?.updatedAt?.toDate) return u.updatedAt.toDate().getTime();
  } catch {}
  return 0;
}
function isUserOnline(u) {
  const name = u?.username || u?.id;
  if (currentUser?.username && name === currentUser.username) return true;
  if (!Boolean(u?.online)) return false;
  const seen = lastSeenMillis(u);
  return !seen || (Date.now() - seen) <= ONLINE_STALE_MS;
}
function onlineBadge(u) {
  const online = isUserOnline(u);
  return `<span class="online-badge ${online ? 'online' : 'offline'}"><i></i>${online ? 'Online' : 'Offline'}</span>`;
}
function getPageSize() { return 10; }
function paginateArray(arr, page, size) {
  const totalPages = Math.max(1, Math.ceil(arr.length / size));
  const safePage = Math.min(Math.max(Number(page || 1), 1), totalPages);
  return { safePage, items: arr.slice((safePage - 1) * size, (safePage - 1) * size + size) };
}
function renderPagination(containerId, totalItems, page, pageSize, onChange) {
  const el = $(containerId); if (!el) return;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = totalItems ? (safePage - 1) * pageSize + 1 : 0;
  const end = Math.min(totalItems, safePage * pageSize);
  el.innerHTML = `<span>Showing ${start}-${end} of ${totalItems}</span><div class="pager-actions"><button class="ghost-btn" data-page-prev ${safePage <= 1 ? 'disabled' : ''}>Prev</button><b>Page ${safePage} / ${totalPages}</b><button class="ghost-btn" data-page-next ${safePage >= totalPages ? 'disabled' : ''}>Next</button></div>`;
  el.querySelector('[data-page-prev]')?.addEventListener('click', () => onChange(safePage - 1));
  el.querySelector('[data-page-next]')?.addEventListener('click', () => onChange(safePage + 1));
}
function currentWritePlatformId() { return selectedPlatformId && selectedPlatformId !== "all" ? selectedPlatformId : ""; }
function transactionFieldIds() {
  return ["clientId", "amount", "exchangeType", "clientName", "phoneNumber", "bank", "remark", "addLineBtn", "copyFormatBtn", "submitTransactionBtn"];
}
function lockTransactionFields(unlocked = false) {
  transactionFieldIds().forEach(id => {
    const el = $(id);
    if (!el) return;
    el.disabled = !unlocked;
    el.classList.toggle("locked-field", !unlocked);
  });
  document.querySelectorAll("#paymentLines input, #paymentLines button").forEach(el => {
    el.disabled = !unlocked;
    el.classList.toggle("locked-field", !unlocked);
  });
  const submitBtn = $("submitTransactionBtn");
  if (submitBtn && !submitBtn.dataset.loading) submitBtn.disabled = !unlocked;
}
function lockNumberInputChanges(scope = document) {
  const inputs = scope.querySelectorAll('input[type="number"], input[data-lock-number="true"]');
  inputs.forEach(input => {
    if (input.dataset.numberLockInstalled) return;
    input.dataset.numberLockInstalled = 'true';
    input.addEventListener('wheel', (e) => {
      // Prevent touchpad/mouse wheel from accidentally changing focused amount values.
      e.preventDefault();
      input.blur();
      setTimeout(() => input.focus(), 0);
    }, { passive: false });
    input.addEventListener('keydown', (e) => {
      if (["ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
    });
  });
}
function orderLockExpired(lock) {
  const expiresAt = lock?.expiresAt || lock?.expires_at;
  const reservedAt = lock?.reservedAt || lock?.reserved_at;
  const expiresMs = expiresAt ? Date.parse(expiresAt) : (reservedAt ? Date.parse(reservedAt) + ORDER_LOCK_TTL_MS : 0);
  return !expiresMs || Number.isNaN(expiresMs) || Date.now() > expiresMs;
}
function sameOrderOwner(lock) {
  return lock?.sessionId === ORDER_SESSION_ID || lock?.reservedBy === currentUser?.username;
}
async function forceReleaseExpiredReservation(id) {
  try { await deleteDoc(doc(db, "orderReservations", id)); } catch (err) { console.warn("Could not clear expired order reservation", err); }
}
function releaseOrderReservationOnUnload() {
  if (!lockedOrderReservation?.id) return;
  const token = authToken();
  const url = `${API_BASE_URL}/api/docs/orderReservations/${encodeURIComponent(lockedOrderReservation.id)}`;
  try {
    fetch(url, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {}, keepalive: true });
  } catch {}
}
function setOrderIdStatus(state = "idle", message = "") {
  orderIdCheckState = state;
  const el = $("orderIdStatus");
  const input = $("orderId");
  const btn = $("submitTransactionBtn");
  const checkBtn = $("checkOrderIdBtn");
  if (el) {
    el.textContent = message;
    el.className = `order-id-status ${state}`;
  }
  if (input) {
    input.classList.remove("order-ok", "order-error", "order-checking");
    if (state === "available" || state === "reserved") input.classList.add("order-ok");
    if (state === "exists" || state === "error") input.classList.add("order-error");
    if (state === "checking") input.classList.add("order-checking");
  }
  if (checkBtn && !checkBtn.dataset.loading) checkBtn.disabled = state === "checking" || Boolean(lockedOrderReservation);
  if (btn && !btn.dataset.loading) btn.disabled = !lockedOrderReservation || state === "exists" || state === "checking" || state === "error";
}
function transactionOrderExists(orderId, platformId = currentWritePlatformId() || DEFAULT_PLATFORM_ID) {
  const target = String(orderId || "").trim();
  if (!target) return false;
  return activeTx(allTransactions).some(t => platformOf(t) === platformId && String(t.orderId || t.id || "").trim() === target);
}
async function releaseOrderReservation(silent = true) {
  const current = lockedOrderReservation;
  lockedOrderReservation = null;
  lockTransactionFields(false);
  const orderInput = $("orderId");
  if (orderInput) orderInput.disabled = false;
  const checkBtn = $("checkOrderIdBtn");
  if (checkBtn) checkBtn.disabled = false;
  if (!current || configLooksMissing()) return;
  try {
    const reservationRef = doc(db, "orderReservations", current.id);
    await runTransaction(db, async (trx) => {
      const snap = await trx.get(reservationRef);
      if (snap.exists() && snap.data()?.sessionId === ORDER_SESSION_ID) trx.delete(reservationRef);
    });
  } catch (err) {
    if (!silent) console.warn("Could not release order reservation", err);
  }
}
function handleOrderIdInput() {
  clearTimeout(orderCheckTimer);
  if (lockedOrderReservation) releaseOrderReservation(true);
  lockedOrderReservation = null;
  lockTransactionFields(false);
  const input = $("orderId");
  if (input) input.disabled = false;
  const checkBtn = $("checkOrderIdBtn");
  if (checkBtn) checkBtn.disabled = false;
  const orderId = input?.value.trim();
  if (!orderId) return setOrderIdStatus("idle", "Enter an Order ID first.");
  setOrderIdStatus("checking", "Checking Order ID...");
  orderCheckTimer = setTimeout(() => checkOrderIdNow(false), 350);
}
async function checkOrderIdNow(force = false) {
  clearTimeout(orderCheckTimer);
  const input = $("orderId");
  const orderId = input?.value.trim();
  if (!orderId) { setOrderIdStatus("idle", "Enter an Order ID first, then click Submit Order ID."); return false; }
  setOrderIdStatus("checking", "Checking Order ID...");
  try {
    const platformId = currentWritePlatformId() || DEFAULT_PLATFORM_ID;
    let exists = transactionOrderExists(orderId, platformId);
    const txId = platformDocId(platformId, orderId);
    if (!exists && !configLooksMissing()) {
      const txSnap = await getDoc(doc(db, "transactions", txId));
      exists = txSnap.exists() && !txSnap.data()?.deleted;
      if (!exists) {
        const lockSnap = await getDoc(doc(db, "orderReservations", txId));
        if (lockSnap.exists()) {
          const lock = lockSnap.data() || {};
          if (orderLockExpired(lock)) {
            await forceReleaseExpiredReservation(txId);
          } else {
            exists = !sameOrderOwner(lock);
          }
        }
      }
    }
    if (input?.value.trim() !== orderId) return false;
    if (exists) {
      setOrderIdStatus("exists", "This Order ID already exists for the selected platform. Use another Order ID.");
      lockTransactionFields(false);
      return false;
    }
    setOrderIdStatus("available", "Order ID is available. Click Submit Order ID to lock it.");
    return true;
  } catch (err) {
    console.error(err);
    setOrderIdStatus("error", err.code === "PGRST" ? "Cannot check Order ID: permission denied." : "Cannot check Order ID. Check connection and try again.");
    lockTransactionFields(false);
    return false;
  }
}
async function reserveOrderId() {
  const checkBtn = $("checkOrderIdBtn");
  const input = $("orderId");
  const orderId = input?.value.trim();
  const platformId = currentWritePlatformId();
  if (!platformId) { toast("Please select a specific platform from the top platform dropdown before adding a transaction.", "error"); return; }
  if (!orderId) { toast("Order ID required", "error"); setOrderIdStatus("idle", "Enter an Order ID first."); return; }
  setButtonLoading(checkBtn, true);
  setOrderIdStatus("checking", "Locking Order ID...");
  try {
    const txId = platformDocId(platformId, orderId);
    const txRef = doc(db, "transactions", txId);
    const reservationRef = doc(db, "orderReservations", txId);
    await runTransaction(db, async (trx) => {
      const txSnap = await trx.get(txRef);
      if (txSnap.exists() && !txSnap.data()?.deleted) throw new Error("ORDER_EXISTS");
      const lockSnap = await trx.get(reservationRef);
      if (lockSnap.exists()) {
        const lock = lockSnap.data() || {};
        if (orderLockExpired(lock) || sameOrderOwner(lock)) await forceReleaseExpiredReservation(txId);
        else throw new Error("ORDER_LOCKED");
      }
      trx.set(reservationRef, {
        orderId, platformId, sessionId: ORDER_SESSION_ID, reservedBy: currentUser?.username || "Unknown",
        reservedAt: serverTimestamp(), expiresAt: new Date(Date.now() + ORDER_LOCK_TTL_MS).toISOString(),
        reservedTimeText: myanmarDateTimeText(), status: "reserved"
      });
    });
    lockedOrderReservation = { id: txId, orderId, platformId };
    if (input) input.disabled = true;
    if (checkBtn) checkBtn.disabled = true;
    lockTransactionFields(true);
    setOrderIdStatus("reserved", "Order ID locked. You can now complete the transaction details.");
    toast("Order ID locked successfully", "success");
    $("clientId")?.focus();
  } catch (err) {
    console.error(err);
    lockedOrderReservation = null;
    lockTransactionFields(false);
    if (err.message === "ORDER_EXISTS") setOrderIdStatus("exists", "This Order ID already exists for the selected platform. Use another Order ID.");
    else if (err.message === "ORDER_LOCKED") setOrderIdStatus("exists", "Another user is already using this Order ID. Use another Order ID.");
    else setOrderIdStatus("error", err.code === "PGRST" ? "Cannot lock Order ID: permission denied." : "Cannot lock Order ID. Check connection and try again.");
    toast("Order ID cannot be locked", "error");
  } finally {
    setButtonLoading(checkBtn, false);
    if (lockedOrderReservation && checkBtn) checkBtn.disabled = true;
  }
}
function installBasicSourceProtection() {
  document.addEventListener("contextmenu", (e) => { e.preventDefault(); toast("Right click is disabled on this system.", "error"); });
  document.addEventListener("keydown", (e) => {
    const key = String(e.key || "").toLowerCase();
    const blocked = key === "f12" || (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(key)) || (e.ctrlKey && ["u", "s"].includes(key));
    if (blocked) { e.preventDefault(); e.stopPropagation(); toast("Developer shortcuts are disabled.", "error"); }
  }, true);
}
function updatePreviews() {
  const lines = getLines();
  const paid = lines.reduce((s, l) => s + l.amount, 0);
  const amount = Number($("amount")?.value || 0);
  const pending = Math.max(amount - paid, 0);
  const status = amount > 0 || paid > 0 ? calcStatus(amount, paid) : "PENDING";
  if ($("generatedFormat")) $("generatedFormat").value = makeFormat(lines);
  if ($("totalPaidPreview")) $("totalPaidPreview").textContent = money(paid);
  if ($("balancePreview")) $("balancePreview").textContent = money(pending);
  if ($("statusPreview")) { $("statusPreview").textContent = status; $("statusPreview").className = `status-text ${status.toLowerCase()}`; }
  const ok = getBankCheck(lines, $("bank")?.value);
  if ($("bankCheckPreview")) { $("bankCheckPreview").textContent = ok ? "TRUE" : "WRONG BANK"; $("bankCheckPreview").className = ok ? "ok-bank" : "wrong-bank"; }
}
async function clearTransactionForm() {
  await releaseOrderReservation(true);
  $("transactionForm")?.reset();
  $("paymentLines").innerHTML = "";
  if ($("qaUser")) $("qaUser").value = `QA/User: ${currentUser.username}`;
  populatePlatformSelects();
  setOrderIdStatus("idle", "Enter an Order ID first, then click Submit Order ID.");
  addPaymentLine(); lockTransactionFields(false); updatePreviews();
}
async function saveTransaction(e) {
  e.preventDefault();
  const submitBtn = $("submitTransactionBtn") || e.submitter;
  setButtonLoading(submitBtn, true); loader(true);
  try {
    const orderId = $("orderId").value.trim();
    const platformId = currentWritePlatformId();
    if (!platformId) { toast("Please select a specific platform from the top platform dropdown before adding a transaction.", "error"); return; }
    const clientId = $("clientId").value.trim();
    const amount = Number($("amount").value || 0);
    const lines = getLines();
    const paid = lines.reduce((s, l) => s + Number(l.amount || 0), 0);
    const bank = $("bank").value;
    if (!orderId) { toast("Order ID required", "error"); return; }
    if (!lockedOrderReservation || lockedOrderReservation.orderId !== orderId || lockedOrderReservation.platformId !== platformId) { toast("Submit/lock the Order ID first before saving the transaction.", "error"); return; }
    if (!clientId) { toast("Client ID required", "error"); return; }
    if (!amount || amount <= 0) { toast("Amount must be greater than 0", "error"); return; }
    if (!lines.length) { toast("Add at least one payment line", "error"); return; }
    if (!getBankCheck(lines, bank)) { toast("Wrong Bank. Payment line does not match selected bank.", "error"); return; }
    const ref = doc(db, "transactions", platformDocId(platformId, orderId));
    const reservationRef = doc(db, "orderReservations", platformDocId(platformId, orderId));
    const pendingBalance = Math.max(amount - paid, 0);
    const overpaidAmount = Math.max(paid - amount, 0);
    const status = calcStatus(amount, paid);
    const data = {
      orderId, platformId, platformName: platformName(platformId), clientId, amount,
      exchangeType: $("exchangeType").value.trim(),
      clientName: $("clientName").value.trim(),
      phoneNumber: $("phoneNumber").value.trim(),
      clientAccountNumber: $("phoneNumber").value.trim(),
      bank, processedBank: bank, qaUser: currentUser.username,
      paymentLines: lines, paidAmount: paid, pendingBalance, overpaidAmount, status,
      generatedFormat: makeFormat(lines), remark: $("remark").value.trim(),
      date: todayISO(), createdTimeText: myanmarDateTimeText(), createdAt: serverTimestamp(),
      createdBy: currentUser.username, updatedAt: serverTimestamp(), modifiedTimeText: myanmarDateTimeText(), deleted: false
    };
    await runTransaction(db, async (trx) => {
      const existing = await trx.get(ref);
      if (existing.exists() && !existing.data()?.deleted) throw new Error("ORDER_EXISTS");
      const lockSnap = await trx.get(reservationRef);
      const lock = lockSnap.exists() ? (lockSnap.data() || {}) : null;
      if (!lock || orderLockExpired(lock) || !sameOrderOwner(lock)) throw new Error("ORDER_NOT_LOCKED");
      trx.set(ref, data);
      trx.delete(reservationRef);
    });
    lockedOrderReservation = null;
    if (status === "OVERPAID") await createRisk(data);
    await loadTransactionsOnce();
    toast("Transaction saved successfully", "success");
    clearTransactionForm();
    showPage("dashboard");
  } catch (err) {
    console.error(err);
    if (err.message === "ORDER_EXISTS") toast("This Order ID already exists. Search it in History.", "error");
    else if (err.message === "ORDER_NOT_LOCKED") toast("Order ID lock expired or was not found. Submit/lock the Order ID again.", "error");
    else toast(err.code === "PGRST" ? "No permission to save. Check Supabase tables/RLS." : `Save failed: ${err.message || err.code || "Unknown error"}`, "error");
  } finally { loader(false); setButtonLoading(submitBtn, false); if (!lockedOrderReservation) lockTransactionFields(false); if (["exists", "checking", "error"].includes(orderIdCheckState) && $("submitTransactionBtn")) $("submitTransactionBtn").disabled = true; }
}
async function createRisk(t) {
  const riskId = platformDocId(platformOf(t), t.orderId || Date.now());
  const data = {
    platformId: platformOf(t), platformName: platformName(platformOf(t)), clientId: t.clientId || "", clientAccountNumber: t.clientAccountNumber || t.phoneNumber || "", clientName: t.clientName || "", orderId: t.orderId || "", amount: Number(t.amount || 0),
    paidAmount: Number(t.paidAmount || 0), losses: Math.max(Number(t.paidAmount || 0) - Number(t.amount || 0), 0),
    reason: "Over paid", name: t.qaUser || t.createdBy || currentUser?.username || "",
    createdTimeText: myanmarDateTimeText(), createdAt: serverTimestamp(), date: txDate(t) || todayISO()
  };
  await setDoc(doc(db, "riskReports", riskId), data, { merge: true });
}
async function bootData() {
  if (configLooksMissing()) {
    setDbStatus("Supabase anon key missing in app.js", "error");
    toast("Paste your Supabase anon public key in app.js.", "error");
    renderDashboard(); renderHistory(); renderLimits();
    return;
  }
  setDbStatus(`Backend API • Loading...`);
  try {
    await seedPlatforms().catch(err => console.warn("Platform seed skipped", err));
    await loadPlatformsOnce().catch(err => console.warn("Platform load skipped", err));
    await loadTransactionsOnce();
    // User status is loaded only when the Users page is opened, then refreshed every 30 seconds while visible.
    startSmartRefreshLoops();
  } catch (err) {
    console.error(err);
    setDbStatus(`Load error: ${err.code || err.message}`, "error");
    toast("Database load failed. Check Supabase setup and anon key.", "error");
  }
}
async function refreshCurrentPageWithLoader(message = "Loading data...") {
  loader(true, message);
  try {
    await loadTransactionsOnce();
    if (currentPage === "dashboard") renderDashboard();
    if (currentPage === "history") renderHistory();
    if (currentPage === "limits") renderLimits();
  } finally {
    loader(false);
  }
}

async function loadTransactionsOnce() {
  if (dataLoadInProgress) return;
  dataLoadInProgress = true;
  try {
    const snap = await getDocs(collection(db, "transactions"));
    allTransactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    afterTransactionsLoaded("manual");
  } finally {
    dataLoadInProgress = false;
  }
}
function listenTransactions() {
  onSnapshot(collection(db, "transactions"), (snap) => {
    allTransactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    afterTransactionsLoaded("live");
    syncMissingRisks();
  }, err => {
    console.error(err);
    setDbStatus(err.code === "PGRST" ? "Permission denied — check Supabase tables/RLS" : `Realtime error: ${err.code || err.message}`, "error");
  });
}
function afterTransactionsLoaded(source) {
  const activeCount = activeTx(allTransactions).length;
  setDbStatus(`Backend API • Loaded ${activeCount} records (${source}) • View: ${selectedPlatformId === "all" ? "All Platforms" : platformName(selectedPlatformId)}`);
  sortTransactions();
  if (currentPage === "dashboard") renderDashboard();
  if (currentPage === "history") renderHistory();
  if (currentPage === "limits") renderLimits();
}
function sortTransactions() {
  allTransactions.sort((a, b) => {
    const ad = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(txDate(a) || 0).getTime();
    const bd = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(txDate(b) || 0).getTime();
    return bd - ad;
  });
}
async function loadRisksOnce() {
  if (!canSeeRisk()) return;
  const snap = await getDocs(collection(db, "riskReports"));
  allRisks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  await syncMissingRisks();
  riskLoadedForThisVisit = true;
  renderRisk();
}
function listenRisks() {
  onSnapshot(collection(db, "riskReports"), (snap) => {
    allRisks = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderRisk();
  }, err => console.error(err));
}
async function syncMissingRisks() {
  if (!canSeeRisk()) return;
  const riskIds = new Set(allRisks.map(r => platformDocId(platformOf(r), r.orderId || r.id)));
  const missing = platformScope(allTransactions).filter(t => t.status === "OVERPAID" && !riskIds.has(platformDocId(platformOf(t), t.orderId || t.id)));
  for (const t of missing.slice(0, 20)) {
    try { await createRisk(t); } catch (err) { console.warn("Risk sync failed", err); }
  }
}
async function loadUsersOnce() {
  if (!canManageUsers()) return;
  const snap = await getDocs(collection(db, "users"));
  allUsers = snap.docs.map(d => ({ id: d.id, ...d.data(), role: normalizeRole(d.data().role) }));
  if (currentPage === "users") renderUsers();
}
function startSmartRefreshLoops() {
  clearInterval(dashboardRefreshTimer);
  clearInterval(userRefreshTimer);
  dashboardRefreshTimer = setInterval(() => {
    if (currentPage === "dashboard" && !document.hidden) loadTransactionsOnce().catch(err => console.warn("Dashboard refresh failed", err));
  }, 30000);
  userRefreshTimer = setInterval(() => {
    if (currentPage === "users" && !document.hidden && canManageUsers()) loadUsersOnce().catch(err => console.warn("User refresh failed", err));
  }, 30000);
}

function dashboardTx() {
  const scoped = platformScope(allTransactions);
  return userRole() === "qa" ? scoped.filter(t => t.createdBy === currentUser.username || t.qaUser === currentUser.username) : scoped;
}
function historyTx() { return platformScope(allTransactions); }
function activeTx(arr = allTransactions) { return arr.filter(t => !t.deleted); }
function selectedDashboardDate() { return $("dashboardDate")?.value || todayISO(); }
function renderDashboard() {
  if (!$("dashPaid")) return;
  const selected = selectedDashboardDate();
  const records = dashboardTx().filter(t => txDate(t) === selected);
  const paid = records.reduce((sum, t) => sum + Number(t.paidAmount || 0), 0);
  const pendingBal = records.filter(t => t.status === "PENDING").reduce((sum, t) => sum + Number(t.pendingBalance || 0), 0);
  const overpaidAmount = records.reduce((sum, t) => sum + Number(t.overpaidAmount || Math.max(Number(t.paidAmount || 0) - Number(t.amount || 0), 0)), 0);
  $("dashPaid").textContent = money(paid);
  $("dashPendingBalance").textContent = money(pendingBal);
  $("dashOverpaidAmount").textContent = money(overpaidAmount);
  $("dashRecords").textContent = records.length;
  $("dashDone").textContent = records.filter(t => t.status === "DONE").length;
  $("dashPendingCount").textContent = records.filter(t => t.status === "PENDING").length;
  $("dashOverpaidCount").textContent = records.filter(t => t.status === "OVERPAID").length;
  const bankMap = {};
  records.forEach(t => bankMap[t.processedBank || t.bank || "Unknown"] = (bankMap[t.processedBank || t.bank || "Unknown"] || 0) + Number(t.paidAmount || 0));
  $("bankSummary").innerHTML = Object.keys(bankMap).length ? Object.entries(bankMap).map(([k, v]) => `<div><span>${k}</span><b>${money(v)}</b></div>`).join("") : `<p class="muted">No bank data for ${selected}.</p>`;
  const pending = records.filter(t => t.status === "PENDING");
  $("pendingBoxTable").innerHTML = pending.length ? pending.map(t => `<tr><td>${platformBadge(t)}</td><td>${safe(t.orderId)}</td><td>${safe(t.clientId)}</td><td>${safe(formatCreatedTime(t))}</td><td>${safe(t.processedBank || t.bank)}</td><td><b>${money(t.pendingBalance)}</b></td><td>${safe(t.qaUser || t.createdBy)}</td></tr>`).join("") : `<tr><td colspan="7" class="muted">No pending transactions for ${selected}.</td></tr>`;
  $("todayTitle").textContent = selected === todayISO() ? "Transactions Today" : `Transactions for ${selected}`;
  const pageSize = getPageSize();
  const pageData = paginateArray(records, dashboardPage, pageSize);
  dashboardPage = pageData.safePage;
  $("todayTable").innerHTML = pageData.items.length ? pageData.items.map(t => `<tr class="status-row-${String(t.status).toLowerCase()}"><td>${platformBadge(t)}</td><td>${safe(t.orderId)}</td><td>${safe(t.clientId)}</td><td>${safe(t.clientName)}</td><td>${money(t.amount)}</td><td>${money(t.paidAmount)}</td><td>${safe(t.processedBank || t.bank)}</td><td>${badge(t.status)}</td><td>${safe(t.qaUser || t.createdBy)}</td><td><button class="small-btn" data-copy="${attr(t.generatedFormat || "")}">Copy</button></td></tr>`).join("") : `<tr><td colspan="10" class="muted">Loaded ${dashboardTx().length} records for this platform, but none match ${selected}. Change the dashboard date/platform or check each record's date field.</td></tr>`;
  renderPagination("dashboardPagination", records.length, dashboardPage, pageSize, p => { dashboardPage = p; renderDashboard(); });
  bindCopyButtons(); renderActivityLineChart(records);
}
function renderActivityLineChart(records) {
  const canvas = $("activityLineChart"); if (!canvas || typeof Chart === "undefined") return;
  const buckets = {}; for (let h = 0; h < 24; h++) buckets[h] = 0;
  records.forEach(t => {
    let d = t.createdAt?.toDate ? t.createdAt.toDate() : null;
    if (!d && t.createdTimeText) d = new Date(t.createdTimeText);
    if (!d && t.createdAtText) d = new Date(t.createdAtText);
    const h = d && !isNaN(d.getTime()) ? d.getHours() : 0;
    buckets[h] = (buckets[h] || 0) + 1;
  });
  const activeHours = Object.keys(buckets).map(Number).filter(h => buckets[h] > 0);
  const minHour = activeHours.length ? Math.max(0, Math.min(...activeHours) - 1) : 8;
  const maxHour = activeHours.length ? Math.min(23, Math.max(...activeHours) + 1) : 16;
  const hours = []; for (let h = minHour; h <= maxHour; h++) hours.push(h);
  const labels = hours.map(h => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`);
  const values = hours.map(h => buckets[h] || 0);
  if (activityChart) { activityChart.destroy(); activityChart = null; }
  activityChart = new Chart(canvas, {
    type: "line",
    data: { labels, datasets: [{ label: "Transactions", data: values, borderColor: "#2563eb", backgroundColor: "rgba(37,99,235,.12)", borderWidth: 3, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: "#fff", pointBorderColor: "#2563eb", pointBorderWidth: 3, tension: .35, fill: true }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "rgba(148,163,184,.22)" } }, x: { grid: { display: false } } } }
  });
}
function badge(s) { return `<span class="badge ${String(s || "").toLowerCase()}">${safe(s)}</span>`; }
function safe(v) { return String(v ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function attr(v) { return safe(v).replace(/'/g, "&#39;"); }
function filteredHistory() {
  const date = $("historyDate")?.value;
  const st = $("historyStatus")?.value || "all";
  const kw = ($("historySearch")?.value || "").trim().toLowerCase();
  const base = activeTx(historyTx());
  let arr = base;
  if (date) arr = arr.filter(t => txDate(t) === date);
  if (st !== "all") arr = arr.filter(t => t.status === st);
  if (kw) arr = arr.filter(t => [t.orderId, t.clientId, t.phoneNumber, t.clientAccountNumber, t.clientName, t.processedBank, t.bank].some(v => String(v || "").toLowerCase().includes(kw)));
  // On first open, show today's records. If no imported/migrated record has today's date,
  // fall back to the latest records so the table is not blank after a successful load.
  if (!arr.length && date === todayISO() && st === "all" && !kw) arr = base;
  return arr;
}
function renderHistory() {
  if (!$('historyTable')) return;
  const arr = filteredHistory();
  const pageSize = getPageSize();
  const pageData = paginateArray(arr, historyPage, pageSize);
  historyPage = pageData.safePage;
  $('historyTable').innerHTML = pageData.items.length ? pageData.items.map(t => `<tr class="status-row-${String(t.status).toLowerCase()}"><td>${platformBadge(t)}</td><td>${safe(t.orderId)}</td><td>${safe(t.clientId)}</td><td>${safe(t.phoneNumber || t.clientAccountNumber)}</td><td>${safe(formatCreatedTime(t))}</td><td>${safe(t.processedBank || t.bank)}</td><td>${money(t.amount)}</td><td>${money(t.paidAmount)}</td><td>${money(t.pendingBalance)}</td><td>${badge(t.status)}</td><td>${safe(t.qaUser || t.createdBy)}</td><td>${safe(t.remark)}${t.editedBy ? `<small class="edit-meta">Edited by ${safe(t.editedBy)} • ${safe(t.modifiedTimeText || '')}</small>` : ''}</td><td>${canDeleteRecord() ? `<div class="action-row"><button class="small-btn" data-edit-tx="${attr(t.id)}">Edit</button><button class="danger-btn" data-del="${attr(t.id)}">Delete</button></div>` : ""}</td></tr>`).join('') : `<tr><td colspan="13" class="muted">No records found for current filters. Loaded ${activeTx(historyTx()).length} total records.</td></tr>`;
  renderPagination('historyPagination', arr.length, historyPage, pageSize, p => { historyPage = p; renderHistory(); });
  document.querySelectorAll('[data-edit-tx]').forEach(b => b.onclick = () => openEditTxModal(b.dataset.editTx));
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => deleteTx(b.dataset.del));
}
function renderLimits() {
  if (!$('limitsTable')) return;
  const kw = ($('limitSearch')?.value || '').trim().toLowerCase();
  const limitDoneDate = $('limitDoneDate')?.value || '';
  const match = t => !kw || [t.orderId, t.clientId, t.phoneNumber, t.clientAccountNumber].some(v => String(v || '').toLowerCase().includes(kw));
  let scoped = platformScope(allTransactions);
  let pending = scoped.filter(t => t.status === 'PENDING' && isDateInLastDays(txDate(t), 3) && match(t));
  let done = scoped.filter(t => isLimitDoneRecord(t) && match(t));
  if (limitDoneDate) done = done.filter(t => limitDoneDateValue(t) === limitDoneDate);

  const pendingPageData = paginateArray(pending, limitsPage, 5);
  limitsPage = pendingPageData.safePage;
  const pendingDisplay = pendingPageData.items;
  const doneDisplay = done.slice(0, 20);
  $('limitsTable').innerHTML = pendingDisplay.length
    ? pendingDisplay.map(t => `<tr><td>${platformBadge(t)}</td><td>${safe(t.orderId)}</td><td>${safe(t.clientId)}</td><td>${safe(formatCreatedTime(t))}</td><td>${safe(t.processedBank || t.bank)}</td><td>${money(t.amount)}</td><td>${money(t.paidAmount)}</td><td><b>${money(t.pendingBalance)}</b></td><td>${safe(t.qaUser || t.createdBy)}</td><td><button class="small-btn" data-pay="${attr(t.id)}">Pay</button></td></tr>`).join('')
    : `<tr><td colspan="10" class="muted">No pending limits from the past 3 days.</td></tr>`;
  const start = pending.length ? (limitsPage - 1) * 5 + 1 : 0;
  const end = Math.min(pending.length, limitsPage * 5);
  if ($('limitsPendingInfo')) $('limitsPendingInfo').textContent = `Showing ${start}-${end} of ${pending.length} pending transaction${pending.length === 1 ? '' : 's'} from the past 3 days. Use Next/Prev to see other limits. Only 5 are shown at one time.`;
  renderPagination('limitsPagination', pending.length, limitsPage, 5, p => { limitsPage = p; renderLimits(); });

  renderPendingPaidAccounts(kw);

  if ($('limitDoneTable')) $('limitDoneTable').innerHTML = doneDisplay.length
    ? doneDisplay.map(t => `<tr><td>${platformBadge(t)}</td><td>${safe(t.orderId)}</td><td>${safe(t.clientId)}</td><td>${safe(formatCreatedTime(t))}</td><td>${safe(formatModifiedTime(t))}</td><td>${safe(t.processedBank || t.bank)}</td><td>${money(t.amount)}</td><td>${money(t.paidAmount)}</td><td>${safe(t.limitPaidBy || t.qaUser || t.createdBy)}</td><td>${safe(t.limitPayRemark || '')}</td></tr>`).join('')
    : `<tr><td colspan="10" class="muted">No limit done records${limitDoneDate ? ` for ${safe(limitDoneDate)}` : ''}.</td></tr>`;

  document.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => openPayModal(b.dataset.pay));
}

function renderPendingPaidAccounts(kw = '') {
  const table = $('pendingPaidAccountsTable');
  if (!table) return;
  const selectedPaidDate = $('pendingPaidDate')?.value || '';
  const rows = [];
  platformScope(allTransactions).forEach(t => {
    if (kw && ![t.orderId, t.clientId, t.phoneNumber, t.clientAccountNumber].some(v => String(v || '').toLowerCase().includes(kw))) return;
    (t.limitPaymentLines || []).forEach((line, index) => {
      const paidDate = paidLineDate(line, t);
      if (selectedPaidDate && paidDate !== selectedPaidDate) return;
      rows.push({
        txId: t.id,
        lineIndex: index,
        platformId: platformOf(t),
        orderId: t.orderId,
        clientId: t.clientId,
        accountCode: line.accountCode,
        amount: line.amount,
        paidBy: line.paidBy || t.limitPaidBy || '',
        paidAt: line.paidAtText || line.createdTimeText || t.modifiedTimeText || formatModifiedTime(t),
        status: t.status
      });
    });
  });
  const rowsDisplay = rows.slice(0, 20);
  table.innerHTML = rowsDisplay.length
    ? rowsDisplay.map(r => `<tr><td><span class="platform-badge">${safe(platformName(r.platformId))}</span></td><td>${safe(r.orderId)}</td><td>${safe(r.clientId)}</td><td>${safe(r.accountCode)}</td><td><b>${money(r.amount)}</b></td><td>${safe(r.paidBy)}</td><td>${safe(r.paidAt)}</td><td>${badge(r.status)}</td><td>${canDeleteRecord() ? `<button class="danger-btn" data-del-limit-line="${attr(r.txId)}" data-line-index="${attr(r.lineIndex)}">Delete</button>` : ''}</td></tr>`).join('')
    : `<tr><td colspan="9" class="muted">No pending paid account records${selectedPaidDate ? ` for ${safe(selectedPaidDate)}` : ''}. Use the Pay button on a pending limit to create records here.</td></tr>`;
  document.querySelectorAll('[data-del-limit-line]').forEach(b => b.onclick = () => deleteLimitPaymentLine(b.dataset.delLimitLine, Number(b.dataset.lineIndex)));
}

async function deleteLimitPaymentLine(txId, lineIndex) {
  if (!canDeleteRecord()) return toast('Only Admin or Editor can delete pending paid account records', 'error');
  const tx = allTransactions.find(t => t.id === txId);
  if (!tx) return toast('Transaction not found', 'error');
  const limitLines = [...(tx.limitPaymentLines || [])];
  const removed = limitLines[lineIndex];
  if (!removed) return toast('Pending paid account line not found', 'error');
  if (!confirm(`Delete this paid account line?\n${removed.accountCode || ''} - ${money(removed.amount)}`)) return;
  limitLines.splice(lineIndex, 1);
  const paymentLines = [...(tx.paymentLines || [])];
  for (let i = paymentLines.length - 1; i >= 0; i--) {
    const p = paymentLines[i];
    if (String(p.accountCode || '') === String(removed.accountCode || '') && Number(p.amount || 0) === Number(removed.amount || 0)) {
      paymentLines.splice(i, 1);
      break;
    }
  }
  const amount = Number(tx.amount || 0);
  const paid = paymentLines.reduce((s, l) => s + Number(l.amount || 0), 0);
  const pendingBalance = Math.max(amount - paid, 0);
  const overpaidAmount = Math.max(paid - amount, 0);
  const status = calcStatus(amount, paid);
  const updated = {
    paymentLines,
    limitPaymentLines: limitLines,
    paidAmount: paid,
    pendingBalance,
    overpaidAmount,
    status,
    generatedFormat: makeFormat(paymentLines),
    modifiedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    modifiedTimeText: myanmarDateTimeText(),
    limitPaymentCompleted: limitLines.length > 0,
    limitCompletedDate: limitLines.length ? paidLineDate(limitLines[limitLines.length - 1], tx) : ""
  };
  loader(true);
  try {
    await updateDoc(doc(db, 'transactions', txId), updated);
    if (status === 'OVERPAID') await createRisk({ ...tx, ...updated });
    else await deleteDoc(doc(db, 'riskReports', platformDocId(platformOf(tx), tx.orderId || tx.id))).catch(() => {});
    toast('Pending paid account deleted and transaction totals recalculated', 'success');
  } catch (err) {
    console.error(err);
    toast(err.code === 'PGRST' ? 'No permission to delete this paid account line. Check rules.' : 'Delete failed', 'error');
  } finally { loader(false); }
}
function riskRows() {
  const riskByOrder = new Map(allRisks.map(r => [platformDocId(platformOf(r), r.orderId || r.id), r]));
  const fallback = platformScope(allTransactions).filter(t => t.status === "OVERPAID" && !riskByOrder.has(platformDocId(platformOf(t), t.orderId || t.id))).map(t => ({
    id: `tx-${t.id}`, platformId: platformOf(t), platformName: platformName(platformOf(t)), clientId: t.clientId, clientAccountNumber: t.clientAccountNumber || t.phoneNumber || "", orderId: t.orderId, amount: t.amount, paidAmount: t.paidAmount,
    losses: Number(t.overpaidAmount || Math.max(Number(t.paidAmount || 0) - Number(t.amount || 0), 0)), reason: "Over paid", name: t.qaUser || t.createdBy, createdTimeText: formatCreatedTime(t), date: txDate(t)
  }));
  const selectedRiskDate = $("riskDate")?.value || "";
  return [...allRisks, ...fallback]
    .filter(r => selectedPlatformId === "all" ? canAccessPlatform(platformOf(r)) : platformOf(r) === selectedPlatformId)
    .filter(r => !selectedRiskDate || txDate(r) === selectedRiskDate);
}
function renderRisk() {
  if (!$("riskTable")) return;
  const rows = riskRows();
  $("riskTable").innerHTML = rows.length ? rows.map(r => `<tr class="status-row-overpaid"><td><span class="platform-badge">${safe(platformName(platformOf(r)))}</span></td><td>${safe(r.clientId)}</td><td>${safe(r.clientAccountNumber || r.phoneNumber)}</td><td>${safe(r.orderId)}</td><td>${money(r.amount)}</td><td>${money(r.paidAmount)}</td><td>${money(r.losses)}</td><td>${safe(r.reason || "Over paid")}</td><td>${safe(r.name)}</td><td>${safe(formatCreatedTime(r))}</td><td>${canDeleteRisk() && !String(r.id || '').startsWith('tx-') ? `<button class="danger-btn" data-risk-del="${attr(r.id || platformDocId(platformOf(r), r.orderId))}">Delete</button>` : ''}</td></tr>`).join("") : `<tr><td colspan="11" class="muted">No risk reports.</td></tr>`;
  document.querySelectorAll('[data-risk-del]').forEach(b => b.onclick = () => deleteRiskReport(b.dataset.riskDel));
}
async function deleteRiskReport(id) {
  if (!canDeleteRisk()) return toast("Only Admin can delete risk reports", "error");
  if (!confirm("Delete this risk report only? The transaction history will stay unchanged.")) return;
  try { await deleteDoc(doc(db, "riskReports", id)); await loadRisksOnce(); toast("Risk report deleted", "success"); }
  catch (err) { console.error(err); toast(err.status === 403 ? "Only Admin can delete risk reports" : "Risk report delete failed", "error"); }
}
function openEditTxModal(id) {
  if (!canDeleteRecord()) return toast("Only Admin or Editor can edit history", "error");
  activeEditTx = allTransactions.find(t => t.id === id);
  if (!activeEditTx) return toast("Transaction not found", "error");
  $("editTxOrder").value = activeEditTx.orderId || activeEditTx.id || "";
  $("editTxClientId").value = activeEditTx.clientId || "";
  $("editTxClientName").value = activeEditTx.clientName || "";
  $("editTxClientAccount").value = activeEditTx.clientAccountNumber || activeEditTx.phoneNumber || "";
  $("editTxAmount").value = Number(activeEditTx.amount || 0);
  $("editTxPaid").value = Number(activeEditTx.paidAmount || 0);
  $("editTxBank").value = activeEditTx.processedBank || activeEditTx.bank || "KBZ";
  $("editTxRemark").value = activeEditTx.remark || "";
  $("editTxMeta").textContent = `Last modified: ${activeEditTx.modifiedTimeText || formatModifiedTime(activeEditTx) || "-"}`;
  $("editTxModal").classList.remove("hidden");
  lockNumberInputChanges($("editTxModal"));
}
function closeEditTxModal() { $("editTxModal")?.classList.add("hidden"); activeEditTx = null; }
async function saveEditedTx(e) {
  e.preventDefault();
  if (!activeEditTx) return;
  if (!canDeleteRecord()) return toast("Only Admin or Editor can edit history", "error");
  const amount = Number($("editTxAmount").value || 0);
  const paidAmount = Number($("editTxPaid").value || 0);
  if (amount <= 0) return toast("Amount must be greater than 0", "error");
  if (paidAmount < 0) return toast("Paid amount cannot be negative", "error");
  const pendingBalance = Math.max(amount - paidAmount, 0);
  const overpaidAmount = Math.max(paidAmount - amount, 0);
  const status = calcStatus(amount, paidAmount);
  const updated = {
    clientId: $("editTxClientId").value.trim(),
    clientName: $("editTxClientName").value.trim(),
    phoneNumber: $("editTxClientAccount").value.trim(),
    clientAccountNumber: $("editTxClientAccount").value.trim(),
    amount, paidAmount, pendingBalance, overpaidAmount, status,
    bank: $("editTxBank").value, processedBank: $("editTxBank").value,
    remark: $("editTxRemark").value.trim(),
    editedBy: currentUser.username, modifiedBy: currentUser.username, updatedBy: currentUser.username,
    modifiedAt: serverTimestamp(), updatedAt: serverTimestamp(), modifiedTimeText: myanmarDateTimeText()
  };
  loader(true);
  try {
    await updateDoc(doc(db, "transactions", activeEditTx.id), updated);
    if (status === "OVERPAID") await createRisk({ ...activeEditTx, ...updated });
    else await deleteDoc(doc(db, "riskReports", platformDocId(platformOf(activeEditTx), activeEditTx.orderId || activeEditTx.id))).catch(() => {});
    closeEditTxModal();
    await loadTransactionsOnce();
    if (canSeeRisk()) await loadRisksOnce().catch(() => {});
    toast("Transaction updated successfully", "success");
  } catch (err) { console.error(err); toast(err.status === 403 ? "No edit permission" : "Edit failed", "error"); }
  finally { loader(false); }
}
async function deleteTx(id) {
  if (!canDeleteRecord()) return toast("Only Admin or Editor can delete a specific record", "error");
  if (!confirm("Delete this transaction from history?")) return;
  try { await deleteDoc(doc(db, "transactions", id)); await loadTransactionsOnce(); toast("Transaction deleted", "success"); }
  catch (err) { console.error(err); toast(err.code === "PGRST" ? "No permission to delete. Check rules." : "Delete failed", "error"); }
}
function bulkActionRecords() {
  const platformId = $("bulkPlatformSelect")?.value || "all";
  const from = $("bulkFromDate")?.value || "";
  const to = $("bulkToDate")?.value || "";
  if (!from || !to) { toast("Choose both From and To dates", "error"); return null; }
  if (from > to) { toast("From date cannot be after To date", "error"); return null; }
  return activeTx(allTransactions).filter(t => {
    const d = txDate(t);
    if (!d) return false;
    const platformOk = platformId === "all" ? canAccessPlatform(platformOf(t)) : platformOf(t) === platformId;
    return platformOk && d >= from && d <= to;
  });
}
async function bulkDeleteSelected() {
  if (!canBulkDelete()) return toast("Only Admin can bulk delete data", "error");
  const targets = bulkActionRecords();
  if (!targets) return;
  const platformLabel = platformName($("bulkPlatformSelect")?.value || "all");
  if (!targets.length) return toast("No records found for selected platform/date duration", "error");
  if (!confirm(`Delete ${targets.length} records from ${platformLabel} between ${$("bulkFromDate").value} and ${$("bulkToDate").value}? This cannot be undone.`)) return;
  loader(true);
  try {
    for (const t of targets) await deleteDoc(doc(db, "transactions", t.id));
    await loadTransactionsOnce();
    toast(`Deleted ${targets.length} records`, "success");
  } catch (err) { console.error(err); toast("Bulk delete failed", "error"); }
  finally { loader(false); }
}
function bindCopyButtons() { document.querySelectorAll("[data-copy]").forEach(b => b.onclick = () => copyText(b.dataset.copy)); }
async function copyText(t) { await navigator.clipboard.writeText(t || ""); toast("Copied", "success"); }
function buildTransactionsCSV(records) {
  const rows = records.map(t => [platformName(platformOf(t)), t.orderId, t.clientId, t.phoneNumber || t.clientAccountNumber, formatCreatedTime(t), t.processedBank || t.bank, t.clientName, t.amount, t.paidAmount, t.pendingBalance, t.status, t.qaUser || t.createdBy, t.remark, t.generatedFormat]);
  return ["Platform,Order ID,Client ID,Client Account,Created Time,Processed Bank,Client Name,Amount,Paid,Pending,Status,User,Remark,Format", ...rows.map(r => r.map(x => `"${String(x ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
}
function downloadCSV(csv, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
}
function exportCSV() {
  const records = filteredHistory();
  downloadCSV(buildTransactionsCSV(records), `bm-history-${$("historyDate")?.value || "all"}-${Date.now()}.csv`);
  toast(`CSV exported with ${records.length} records`, "success");
}
function bulkExportCSV() {
  if (!canBulkDelete()) return toast("Only Admin can bulk export", "error");
  const records = bulkActionRecords();
  if (!records) return;
  if (!records.length) return toast("No records found for selected platform/date duration", "error");
  const platformId = $("bulkPlatformSelect")?.value || "all";
  downloadCSV(buildTransactionsCSV(records), `bm-bulk-${platformId}-${$("bulkFromDate").value}-to-${$("bulkToDate").value}-${Date.now()}.csv`);
  toast(`Bulk export completed with ${records.length} records`, "success");
}
function openPayModal(id) {
  activePayTx = allTransactions.find(t => t.id === id); if (!activePayTx) return;
  $("payDetails").innerHTML = `<div><span>Order ID</span><b>${safe(activePayTx.orderId)}</b></div><div><span>Client ID</span><b>${safe(activePayTx.clientId)}</b></div><div><span>Client Name</span><b>${safe(activePayTx.clientName || '-')}</b></div><div><span>Client Acc No</span><b>${safe(activePayTx.clientAccountNumber || activePayTx.phoneNumber || '-')}</b></div><div><span>Amount</span><b>${money(activePayTx.amount)}</b></div><div><span>Paid</span><b>${money(activePayTx.paidAmount)}</b></div><div><span>Pending</span><b>${money(activePayTx.pendingBalance)}</b></div><div><span>Bank</span><b>${safe(activePayTx.processedBank || activePayTx.bank)}</b></div>`;
  $("payLimitForm").reset(); $("payModal").classList.remove("hidden");
}
function closePayModal() { $("payModal").classList.add("hidden"); activePayTx = null; }
async function payLimit(e) {
  e.preventDefault(); if (!activePayTx) return;
  loader(true);
  try {
    const newLines = [...(activePayTx.paymentLines || [])];
    const a1 = $("payAccountCode").value.trim(), p1 = Number($("payAmount").value || 0); if (a1 && p1 > 0) newLines.push({ accountCode: a1, amount: p1 });
    const a2 = $("secondAccountCode").value.trim(), p2 = Number($("secondPayAmount").value || 0); if (a2 && p2 > 0) newLines.push({ accountCode: a2, amount: p2 });
    const paid = newLines.reduce((s, l) => s + Number(l.amount || 0), 0);
    const amount = Number(activePayTx.amount || 0);
    const pendingBalance = Math.max(amount - paid, 0);
    const overpaidAmount = Math.max(paid - amount, 0);
    const status = calcStatus(amount, paid);
    const payTimeText = myanmarDateTimeText();
    const newLimitPaymentLines = [...(activePayTx.limitPaymentLines || [])];
    const payDateISO = todayISO();
    if (a1 && p1 > 0) newLimitPaymentLines.push({ accountCode: a1, amount: p1, paidBy: currentUser.username, paidAtText: payTimeText, paidAtISO: payDateISO });
    if (a2 && p2 > 0) newLimitPaymentLines.push({ accountCode: a2, amount: p2, paidBy: currentUser.username, paidAtText: payTimeText, paidAtISO: payDateISO, secondAccount: true });
    const updated = { paymentLines: newLines, limitPaymentLines: newLimitPaymentLines, paidAmount: paid, pendingBalance, overpaidAmount, status, generatedFormat: makeFormat(newLines), limitPaidBy: currentUser.username, limitPayRemark: $("payRemark").value.trim(), limitPaymentCompleted: newLimitPaymentLines.length > 0, limitCompletedDate: payDateISO, modifiedAt: serverTimestamp(), updatedAt: serverTimestamp(), modifiedTimeText: payTimeText };
    await updateDoc(doc(db, "transactions", activePayTx.id), updated);
    if (status === "OVERPAID") await createRisk({ ...activePayTx, ...updated, qaUser: currentUser.username });
    toast(status === "DONE" ? "Limit marked as DONE" : "Limit payment updated", "success"); closePayModal();
  } catch (err) { console.error(err); toast(err.code === "PGRST" ? "No permission to update limit. Check Supabase tables/RLS." : "Payment update failed", "error"); }
  finally { loader(false); }
}
function listenUsers() {
  onSnapshot(collection(db, "users"), snap => {
    allUsers = snap.docs.map(d => ({ id: d.id, ...d.data(), role: normalizeRole(d.data().role) }));
    renderUsers();
  }, err => console.error(err));
}
function userAllowedPlatformList(u) {
  const arr = Array.isArray(u.allowedPlatforms) ? u.allowedPlatforms : [];
  if (!arr.length) return [DEFAULT_PLATFORM_ID];
  if (arr.includes("all")) return ["all"];
  return arr;
}
function allowedPlatformText(u) {
  const arr = userAllowedPlatformList(u);
  return arr.includes("all") ? "All Platforms" : arr.map(platformName).join(", ");
}
function userMatchesPlatform(u, platformId) {
  if (!platformId || platformId === "all") return true;
  const arr = userAllowedPlatformList(u);
  return arr.includes("all") || arr.includes(platformId);
}
function canEditDefaultAdmin(u) {
  return String(u?.username || u?.id || "").toLowerCase() !== "admin";
}
function canEditUserPlatformAccess(u) {
  if (!canEditDefaultAdmin(u)) return false;
  if (userRole() === "admin") return true;
  if (userRole() === "editor") {
    if (normalizeRole(u?.role) !== "qa" || isAdminUser(u)) return false;
    const assignable = assignablePlatformIds();
    const targetPlatforms = userAllowedPlatformList(u).filter(id => id !== "all");
    return targetPlatforms.some(id => assignable.includes(id));
  }
  return false;
}
function roleSortWeight(role) {
  const weights = { admin: 0, editor: 1, qa: 2, user: 2 };
  return weights[normalizeRole(role)] ?? 99;
}
function renderUsers() {
  if (!$('usersTable')) return;
  const q = String($('userSearch')?.value || '').trim().toLowerCase();
  const platformFilter = $('usersPlatformFilter')?.value || 'all';
  const filtered = allUsers.filter(u => {
    if (userRole() === 'editor' && !canEditUserPlatformAccess(u) && (u.username || u.id) !== currentUser.username) return false;
    const text = `${u.username || u.id} ${u.role || ''} ${u.status || ''} ${allowedPlatformText(u)}`.toLowerCase();
    return (!q || text.includes(q)) && userMatchesPlatform(u, platformFilter);
  }).sort((a, b) => {
    const roleDiff = roleSortWeight(a.role) - roleSortWeight(b.role);
    if (roleDiff) return roleDiff;
    return String(a.username || a.id || '').localeCompare(String(b.username || b.id || ''));
  });
  const pageData = paginateArray(filtered, usersPage, USERS_PAGE_SIZE);
  usersPage = pageData.safePage;
  $('usersTable').innerHTML = pageData.items.length ? pageData.items.map(u => {
    const lockedForEditor = userRole() === 'editor';
    const defaultAdminLocked = !canEditDefaultAdmin(u);
    const canEditAccess = canEditUserPlatformAccess(u);
    return `<tr><td>${safe(u.username || u.id)}${defaultAdminLocked ? ' <span class="locked-badge">Default</span>' : ''}</td><td>${safe(allowedPlatformText(u))}</td><td><select data-role="${attr(u.id)}" ${lockedForEditor || defaultAdminLocked ? 'disabled' : ''}><option value="qa" ${normalizeRole(u.role) === 'qa' ? 'selected' : ''}>QA</option><option value="editor" ${normalizeRole(u.role) === 'editor' ? 'selected' : ''}>Editor</option><option value="admin" ${normalizeRole(u.role) === 'admin' ? 'selected' : ''}>Admin</option></select></td><td>${safe(u.status || 'active')}</td><td>${onlineBadge(u)}${u.lastSeenText ? `<small class="last-seen">${safe(u.lastSeenText)}</small>` : ''}</td><td><div class="action-row"><button class="small-btn ${!canEditAccess ? 'locked' : ''}" data-edit-platforms="${attr(u.id)}">Edit Access</button><button class="small-btn ${lockedForEditor || defaultAdminLocked ? 'locked' : ''}" data-toggle="${attr(u.id)}">${u.status === 'disabled' ? 'Enable' : 'Disable'}</button><button class="small-btn ${lockedForEditor || defaultAdminLocked ? 'locked' : ''}" data-pass="${attr(u.id)}">Password</button><button class="danger-btn ${lockedForEditor || defaultAdminLocked || userRole() !== 'admin' ? 'locked' : ''}" data-userdel="${attr(u.id)}">Delete</button></div></td></tr>`;
  }).join('') : `<tr><td colspan="6" class="muted">No users found for the selected search/filter.</td></tr>`;
  renderPagination('usersPagination', filtered.length, usersPage, USERS_PAGE_SIZE, (p) => { usersPage = p; renderUsers(); });
  bindUserActions();
}
function bindUserActions() {
  document.querySelectorAll('[data-edit-platforms]').forEach(b => b.onclick = () => {
    if (b.classList.contains('locked')) return toast('You can only edit platform access allowed by your role', 'error');
    openUserPlatformModal(b.dataset.editPlatforms);
  });
  document.querySelectorAll('[data-role]').forEach(s => s.onchange = async () => {
    if (s.disabled) return toast('This user cannot be changed', 'error');
    await updateDoc(doc(db, 'users', s.dataset.role), { role: s.value, updatedAt: serverTimestamp(), updatedBy: currentUser.username }); toast('User role updated');
  });
  document.querySelectorAll('[data-toggle]').forEach(b => b.onclick = async () => {
    if (b.classList.contains('locked')) return toast('This user cannot be changed', 'error');
    const r = doc(db, 'users', b.dataset.toggle); const snap = await getDoc(r);
    await updateDoc(r, { status: snap.data().status === 'disabled' ? 'active' : 'disabled', updatedAt: serverTimestamp(), updatedBy: currentUser.username }); toast('User status updated');
  });
  document.querySelectorAll('[data-pass]').forEach(b => b.onclick = async () => {
    if (b.classList.contains('locked')) return toast("This user cannot be changed", 'error');
    const p = prompt('New password'); if (p) { await updateDoc(doc(db, 'users', b.dataset.pass), { password: p, updatedAt: serverTimestamp(), updatedBy: currentUser.username }); toast('Password updated'); }
  });
  document.querySelectorAll('[data-userdel]').forEach(b => b.onclick = async () => {
    if (b.classList.contains('locked')) return toast('This user cannot be deleted', 'error');
    if (confirm('Delete user?')) { await deleteDoc(doc(db, 'users', b.dataset.userdel)); toast('User deleted'); }
  });
}
function openCreateUserPlatformModal(userData) {
  activeUserPlatformMode = 'create';
  activeEditUserId = null;
  pendingNewUser = userData;
  const optionIds = assignablePlatformIds();
  if ($('userPlatformModalTitle')) $('userPlatformModalTitle').textContent = 'Select Platform Access';
  if ($('editUserPlatformName')) $('editUserPlatformName').textContent = `Creating ${userData.role.toUpperCase()}: ${userData.username}. Tick the platforms this user can access.`;
  const canUseAll = userRole() === 'admin';
  if ($('editUserAllPlatformsRow')) $('editUserAllPlatformsRow').style.display = canUseAll ? 'flex' : 'none';
  if ($('editUserAllPlatforms')) $('editUserAllPlatforms').checked = false;
  setPlatformCheckboxes(optionIds.length === 1 ? [optionIds[0]] : [], optionIds);
  if ($('saveUserPlatformsBtn')) $('saveUserPlatformsBtn').textContent = 'Add User';
  $('userPlatformModal')?.classList.remove('hidden');
}
function openUserPlatformModal(userId) {
  const u = allUsers.find(x => x.id === userId);
  if (!u) return toast('User not found', 'error');
  if (!canEditUserPlatformAccess(u)) return toast('You can only edit platform access allowed by your role', 'error');
  activeUserPlatformMode = 'edit';
  pendingNewUser = null;
  activeEditUserId = userId;
  const existing = userAllowedPlatformList(u);
  const optionIds = assignablePlatformIds();
  const visibleSelected = existing.includes('all') ? optionIds : existing.filter(id => optionIds.includes(id));
  const allChecked = userRole() === 'admin' && existing.includes('all');
  if ($('userPlatformModalTitle')) $('userPlatformModalTitle').textContent = 'Edit Platform Access';
  if ($('editUserPlatformName')) $('editUserPlatformName').textContent = `Editing access for: ${u.username || u.id}`;
  if ($('editUserAllPlatformsRow')) $('editUserAllPlatformsRow').style.display = userRole() === 'admin' ? 'flex' : 'none';
  if ($('editUserAllPlatforms')) $('editUserAllPlatforms').checked = allChecked;
  setPlatformCheckboxes(visibleSelected, optionIds);
  document.querySelectorAll('#editAllowedPlatforms input[type=checkbox]').forEach(cb => cb.disabled = allChecked);
  if ($('saveUserPlatformsBtn')) $('saveUserPlatformsBtn').textContent = 'Save Platform Access';
  $('userPlatformModal')?.classList.remove('hidden');
}
function closeUserPlatformModal() {
  activeEditUserId = null;
  activeUserPlatformMode = 'edit';
  pendingNewUser = null;
  $('userPlatformModal')?.classList.add('hidden');
}
async function saveUserPlatforms() {
  const checked = getPlatformCheckboxValues();
  const useAll = userRole() === 'admin' && $('editUserAllPlatforms')?.checked;
  if (!useAll && !checked.length) return toast('Select at least one platform', 'error');

  if (activeUserPlatformMode === 'create') {
    if (!pendingNewUser) return toast('User details missing', 'error');
    const allowedPlatforms = useAll ? ['all'] : checked.filter(id => assignablePlatformIds().includes(id));
    if (!allowedPlatforms.length) return toast('Select at least one platform', 'error');
    const ref = doc(db, 'users', pendingNewUser.username);
    if ((await getDoc(ref)).exists()) return toast(`Username exists. Try ${pendingNewUser.username}1`, 'error');
    await setDoc(ref, { ...pendingNewUser, allowedPlatforms, status: 'active', online: false, createdAt: serverTimestamp(), createdBy: currentUser.username });
    $('userForm')?.reset();
    if (userRole() === 'editor' && $('newRole')) { $('newRole').value = 'qa'; $('newRole').disabled = true; }
    toast('User added successfully', 'success');
    closeUserPlatformModal();
    return;
  }

  if (!activeEditUserId) return;
  const target = allUsers.find(x => x.id === activeEditUserId);
  if (!target || !canEditUserPlatformAccess(target)) return toast("You cannot edit this user's platform access", 'error');
  let allowedPlatforms;
  if (useAll) {
    allowedPlatforms = ['all'];
  } else if (userRole() === 'editor') {
    const assignable = assignablePlatformIds();
    const current = userAllowedPlatformList(target).filter(id => id !== 'all');
    const preserved = current.filter(id => !assignable.includes(id));
    allowedPlatforms = [...new Set([...preserved, ...checked.filter(id => assignable.includes(id))])];
  } else {
    allowedPlatforms = checked;
  }
  if (!allowedPlatforms.length) return toast('Select at least one platform', 'error');
  await updateDoc(doc(db, 'users', activeEditUserId), { allowedPlatforms, updatedAt: serverTimestamp(), updatedBy: currentUser.username });
  toast('User platform access updated', 'success');
  closeUserPlatformModal();
}
async function addUser(e) {
  e.preventDefault();
  if (!canManageUsers()) return toast('No access', 'error');
  const username = $('newUsername').value.trim();
  const password = $('newPassword').value;
  let role = normalizeRole($('newRole').value);
  if (userRole() === 'editor') role = 'qa';
  if (userRole() === 'editor' && role !== 'qa') return toast('Editor can only add QA users', 'error');
  if (!username || !password) return toast('Username and password required', 'error');
  const ref = doc(db, 'users', username);
  if ((await getDoc(ref)).exists()) return toast(`Username exists. Try ${username}1`, 'error');
  openCreateUserPlatformModal({ username, password, role });
}
async function changeOwnPassword(e) {
  e.preventDefault();
  if (String(currentUser?.username || "").toLowerCase() === "admin") return toast("Default Admin login cannot be changed", "error");
  const p = $("ownNewPassword").value;
  if (!p) return;
  await updateDoc(doc(db, "users", currentUser.username), { password: p });
  $("ownNewPassword").value = ""; toast("Password changed", "success");
}
