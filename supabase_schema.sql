-- ============================================================================
-- Station SIM/IP Assignment System — Supabase Database Schema (Simplified)
-- ============================================================================
-- HOW TO USE:
-- 1. Go to your Supabase project → SQL Editor → New Query
-- 2. Paste this entire file
-- 3. Click "Run"
-- ============================================================================

-- Drop existing tables if re-running this script (safe to ignore errors on first run)
drop table if exists audit_logs cascade;
drop table if exists request_stations cascade;
drop table if exists station_requests cascade;
drop table if exists ip_registry cascade;
drop table if exists stations_master cascade;
drop table if exists app_users cascade;

-- ============================================================================
-- TABLE: app_users
-- Linked to Supabase Auth (auth.users) via id. Holds the payroll number,
-- display name, and role. Real login (payroll number + password) is
-- handled by Supabase Auth itself — this table just stores the extra info.
-- ============================================================================
create table app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  payroll_no text not null unique,
  name text not null,
  role text not null check (role in ('SUPER_ADMIN', 'STN_ADMIN', 'STN_SCADA')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- TABLE: stations_master
-- The station registry. SUPER_ADMIN can bulk-upload it via CSV, and it also
-- grows automatically: whenever STN_ADMIN adds a new station to a request,
-- that station gets inserted here too. This is what "Add Station" checks
-- against to block duplicates — uniqueness is on the EQ Number + Type
-- combination, since the same EQ Number can legitimately exist twice with
-- a different Type (Smart RMU vs Smart OH).
-- ============================================================================
create table stations_master (
  id uuid primary key default gen_random_uuid(),
  eq_number text not null,
  type text not null check (type in ('Smart RMU', 'Smart OH')),
  vendor text not null,
  modem text not null,
  created_at timestamptz not null default now(),
  unique (eq_number, type)
);

-- ============================================================================
-- TABLE: ip_registry
-- Simple registry of IP addresses already in use, so SCADA gets blocked
-- from assigning a duplicate IP. SUPER_ADMIN can bulk-upload existing IPs
-- via CSV, and it also grows automatically whenever a new IP is assigned
-- through the Assign SIM/IP screen.
-- ============================================================================
create table ip_registry (
  id uuid primary key default gen_random_uuid(),
  ip text not null unique,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- TABLE: station_requests
-- A request created by STN_ADMIN, containing a list of stations they typed
-- in by hand (checked against stations_master for duplicates as they go).
-- ============================================================================
create table station_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  title text not null,
  remarks text,
  status text not null default 'SUBMITTED'
    check (status in ('SUBMITTED', 'IN_PROGRESS', 'PARTIALLY_ASSIGNED', 'COMPLETED', 'RETURNED')),
  submitted_by_name text not null,
  submitted_by_payroll text not null,
  total_stations integer not null default 0,
  assigned_count integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ============================================================================
-- TABLE: request_stations
-- Each station in a request. EQ Number, Type, Vendor, Modem, and location
-- info are typed by STN_ADMIN (checked against stations_master first to
-- block duplicates on the EQ Number + Type combo). SerialNo and IP are
-- typed by STN_SCADA manually, checked against ip_registry.
-- ============================================================================
create table request_stations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references station_requests(id) on delete cascade,
  eq_number text not null,
  type text not null check (type in ('Smart RMU', 'Smart OH')),
  vendor text not null,
  modem text not null,
  longitude text,
  latitude text,
  location_url text,
  serial_no text,
  ip text,
  assignment_status text not null default 'UNASSIGNED'
    check (assignment_status in ('UNASSIGNED', 'ASSIGNED')),
  remarks text,
  assigned_by_name text,
  assigned_at timestamptz
);

-- ============================================================================
-- TABLE: audit_logs
-- Every meaningful change in the system gets logged here.
-- ============================================================================
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_name text not null,
  action text not null,
  request_no text,
  eq_number text,
  old_value text,
  new_value text,
  remarks text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES for faster lookups
-- ============================================================================
create index idx_stations_master_eq_number on stations_master(eq_number);
create index idx_ip_registry_ip on ip_registry(ip);
create index idx_request_stations_request_id on request_stations(request_id);
create index idx_station_requests_status on station_requests(status);
create index idx_audit_logs_created_at on audit_logs(created_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Require a logged-in session for all access — no anonymous reads/writes.
-- Fine-grained role checks happen in the app's JavaScript.
-- ============================================================================
alter table app_users enable row level security;
alter table stations_master enable row level security;
alter table ip_registry enable row level security;
alter table station_requests enable row level security;
alter table request_stations enable row level security;
alter table audit_logs enable row level security;

create policy "Authenticated users can access app_users" on app_users for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated users can access stations_master" on stations_master for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated users can access ip_registry" on ip_registry for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated users can access station_requests" on station_requests for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated users can access request_stations" on request_stations for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated users can access audit_logs" on audit_logs for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============================================================================
-- GRANTS — required in addition to RLS policies, or Postgres will still
-- reject queries with "permission denied for table" even if RLS allows it.
-- ============================================================================
grant usage on schema public to service_role, authenticated, anon;

grant all on public.app_users to service_role;
grant all on public.stations_master to service_role;
grant all on public.ip_registry to service_role;
grant all on public.station_requests to service_role;
grant all on public.request_stations to service_role;
grant all on public.audit_logs to service_role;

grant select, insert, update, delete on public.app_users to authenticated;
grant select, insert, update, delete on public.stations_master to authenticated;
grant select, insert, update, delete on public.ip_registry to authenticated;
grant select, insert, update, delete on public.station_requests to authenticated;
grant select, insert, update, delete on public.request_stations to authenticated;
grant select, insert, update, delete on public.audit_logs to authenticated;

-- ============================================================================
-- NOTE ON USERS
-- app_users links to Supabase Auth (auth.users), so we can't pre-insert
-- fake users via plain SQL here — Supabase Auth requires a real signup or
-- admin-create call to generate the auth.users row first.
--
-- After running this schema, create your first Super Admin manually via
-- Authentication > Users > Add User in the Supabase dashboard, then insert
-- a matching row into app_users with that user's id. After that, use the
-- create-user Edge Function (see supabase/functions/create-user) from the
-- Users page in the app to create everyone else.
-- ============================================================================

-- ============================================================================
-- Done! You should now see 6 tables in the Table Editor on the left sidebar.
-- ============================================================================
