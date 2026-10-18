-- LeaveTrack leave domain, per docs/arch-docs/ARCH-LeaveTrack-v1.0.md (Data Model).
-- Apply with the Supabase CLI (see README). Reference data lives in seed.sql.

create type user_role as enum ('employee', 'manager', 'hr_admin');
create type request_status as enum ('pending', 'approved', 'rejected');

create table users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  role        user_role not null,
  manager_id  uuid references users (id)
);
-- users.manager_id is the sole source of truth for scoped visibility (US-04).
create index users_manager_id_idx on users (manager_id);

create table leave_types (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  tracks_balance  boolean not null
);

create table leave_policies (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users (id),
  leave_type_id      uuid not null references leave_types (id),
  accrual_per_month  numeric(6, 2) not null check (accrual_per_month >= 0),
  unique (user_id, leave_type_id)
);

create table leave_balances (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users (id),
  leave_type_id  uuid not null references leave_types (id),
  balance        numeric(6, 2) not null default 0,
  updated_at     timestamptz not null default now(),
  unique (user_id, leave_type_id)
);

create table leave_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users (id),
  leave_type_id  uuid not null references leave_types (id),
  start_date     date not null,
  end_date       date not null,
  reason         text not null,
  status         request_status not null default 'pending',
  decided_by     uuid references users (id),
  decided_at     timestamptz,
  -- Soft delete only (BR-04, 3-year retention). No hard-delete path may exist.
  is_deleted     boolean not null default false,
  created_at     timestamptz not null default now(),
  check (end_date >= start_date)
);
create index leave_requests_user_status_idx on leave_requests (user_id, status);
create index leave_requests_is_deleted_idx on leave_requests (is_deleted);

create table audit_log (
  id                uuid primary key default gen_random_uuid(),
  leave_request_id  uuid not null references leave_requests (id),
  actor_id          uuid not null references users (id),
  action            text not null check (action in ('submitted', 'approved', 'rejected')),
  occurred_at       timestamptz not null default now()
);
create index audit_log_leave_request_idx on audit_log (leave_request_id);

-- BR-04 in the database: leave requests and audit rows can never be deleted or truncated.
create function forbid_delete() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Hard delete is not allowed on %. Use is_deleted.', tg_table_name;
end;
$$;

create trigger leave_requests_no_delete before delete on leave_requests
  for each row execute function forbid_delete();
create trigger leave_requests_no_truncate before truncate on leave_requests
  for each statement execute function forbid_delete();
create trigger audit_log_no_delete before delete on audit_log
  for each row execute function forbid_delete();
create trigger audit_log_no_truncate before truncate on audit_log
  for each statement execute function forbid_delete();

-- Row Level Security: deny by default. Tables in `public` are exposed through the Supabase Data API,
-- so without RLS the publishable key could read every row. No policies exist yet; Day 1 adds them
-- (or the app reaches the database only from the server). The service/secret key bypasses RLS.
alter table users           enable row level security;
alter table leave_types     enable row level security;
alter table leave_policies  enable row level security;
alter table leave_balances  enable row level security;
alter table leave_requests  enable row level security;
alter table audit_log       enable row level security;

revoke all on users, leave_types, leave_policies, leave_balances, leave_requests, audit_log
  from anon, authenticated;
