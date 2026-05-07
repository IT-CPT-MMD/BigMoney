-- BM Core Supabase setup
-- Run this once in Supabase Dashboard > SQL Editor before opening the system.

create table if not exists public.users (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.transactions (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public."riskReports" (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public."orderReservations" (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.platforms (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Internal-tool mode: keep RLS disabled unless you later add secure Supabase Auth policies.
alter table public.users disable row level security;
alter table public.transactions disable row level security;
alter table public."riskReports" disable row level security;
alter table public."orderReservations" disable row level security;
alter table public.platforms disable row level security;

-- Default admin login: username admin / password 123456
insert into public.users (id, data, updated_at)
values (
  'admin',
  '{"username":"admin","password":"123456","role":"admin","status":"active","allowedPlatforms":["all"],"protected":true,"createdAt":"2026-05-02"}'::jsonb,
  now()
)
on conflict (id) do update set data = excluded.data, updated_at = now();

-- Default platforms
insert into public.platforms (id, data, updated_at) values
('4-1', '{"id":"4-1","name":"MD 4-1","status":"active"}'::jsonb, now()),
('4-2', '{"id":"4-2","name":"MD 4-2","status":"active"}'::jsonb, now()),
('4-4', '{"id":"4-4","name":"MD 4-4","status":"active"}'::jsonb, now()),
('4-3', '{"id":"4-3","name":"MD 4-3","status":"active"}'::jsonb, now()),
('4-5', '{"id":"4-5","name":"MD 4-5","status":"active"}'::jsonb, now()),
('4-6', '{"id":"4-6","name":"MD 4-6","status":"active"}'::jsonb, now()),
('4-8', '{"id":"4-8","name":"MD 4-8","status":"active"}'::jsonb, now()),
('4-9', '{"id":"4-9","name":"MD 4-9","status":"active"}'::jsonb, now()),
('4-10', '{"id":"4-10","name":"MD 4-10","status":"active"}'::jsonb, now()),
('4-11', '{"id":"4-11","name":"MD 4-11","status":"active"}'::jsonb, now()),
('4-12', '{"id":"4-12","name":"MD 4-12","status":"active"}'::jsonb, now()),
('4-14', '{"id":"4-14","name":"MD 4-14","status":"active"}'::jsonb, now()),
('4-15', '{"id":"4-15","name":"MD 4-15","status":"active"}'::jsonb, now()),
('4-16', '{"id":"4-16","name":"MD 4-16","status":"active"}'::jsonb, now()),
('4-17', '{"id":"4-17","name":"MD 4-17","status":"active"}'::jsonb, now()),
('4-18', '{"id":"4-18","name":"MD 4-18","status":"active"}'::jsonb, now()),
('4-19', '{"id":"4-19","name":"MD 4-19","status":"active"}'::jsonb, now()),
('4-20', '{"id":"4-20","name":"MD 4-20","status":"active"}'::jsonb, now()),
('4-22', '{"id":"4-22","name":"MD 4-22","status":"active"}'::jsonb, now()),
('4-23', '{"id":"4-23","name":"MD 4-23","status":"active"}'::jsonb, now()),
('4-24', '{"id":"4-24","name":"MD 4-24","status":"active"}'::jsonb, now()),
('4-25', '{"id":"4-25","name":"MD 4-25","status":"active"}'::jsonb, now()),
('4-26', '{"id":"4-26","name":"MD 4-26","status":"active"}'::jsonb, now()),
('4-27', '{"id":"4-27","name":"MD 4-27","status":"active"}'::jsonb, now()),
('4-28', '{"id":"4-28","name":"MD 4-28","status":"active"}'::jsonb, now()),
('4-29', '{"id":"4-29","name":"MD 4-29","status":"active"}'::jsonb, now()),
('4-30', '{"id":"4-30","name":"MD 4-30","status":"active"}'::jsonb, now()),
('4-31', '{"id":"4-31","name":"MD 4-31","status":"active"}'::jsonb, now()),
('4-33', '{"id":"4-33","name":"MD 4-33","status":"active"}'::jsonb, now()),
('4-34', '{"id":"4-34","name":"MD 4-34","status":"active"}'::jsonb, now()),
('4-40002', '{"id":"4-40002","name":"MD 4-40002","status":"active"}'::jsonb, now()),
('4-40003', '{"id":"4-40003","name":"MD 4-40003","status":"active"}'::jsonb, now()),
('4-40001', '{"id":"4-40001","name":"MD 4-40001","status":"active"}'::jsonb, now())
on conflict (id) do nothing;

-- Optional realtime. Run these once. If Supabase says a table is already in the publication, ignore that line.
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public."riskReports";
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.platforms;
