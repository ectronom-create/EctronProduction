-- FPY Dashboard schema bootstrap for Supabase
-- Run this file in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) Report header (kept for backward compatibility with the app)
-- -----------------------------------------------------------------------------
create table if not exists public.reports (
  id bigserial primary key,
  report_date date not null unique,
  product text not null,
  overall_fpy numeric,
  total_boards integer,
  achieved integer,
  target_boards integer,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reports
  add column if not exists target_boards integer;

create index if not exists idx_reports_report_date on public.reports (report_date desc);

-- -----------------------------------------------------------------------------
-- 2) Normalized details (Simplified)
-- -----------------------------------------------------------------------------
drop table if exists public.report_defects cascade;

create table if not exists public.report_stations (
  id bigserial primary key,
  report_id bigint not null references public.reports(id) on delete cascade,
  station_order integer not null default 0,
  station_name text not null,
  nb_boards integer not null default 0,
  nb_boards_ok integer not null default 0,
  error_count integer not null default 0,
  fpy numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_report_stations_report_id on public.report_stations(report_id);
create index if not exists idx_report_stations_station_name on public.report_stations(station_name);

-- -----------------------------------------------------------------------------
-- 3) updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_reports_updated_at on public.reports;
create trigger trg_reports_updated_at
before update on public.reports
for each row
execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4) Sync normalized tables from JSONB (auto on insert/update)
-- -----------------------------------------------------------------------------
create or replace function public.sync_report_children()
returns trigger
language plpgsql
as $$
declare
  stations jsonb;
begin
  -- Refresh children (idempotent)
  if new.id is null then
    return new;
  end if;

  delete from public.report_stations where report_id = new.id;

  stations := new.data->'stations';
  if jsonb_typeof(stations) = 'array' then
    insert into public.report_stations (
      report_id,
      station_order,
      station_name,
      nb_boards,
      nb_boards_ok,
      error_count,
      fpy
    )
    select
      new.id as report_id,
      (elem.ord - 1) as station_order,
      coalesce(nullif(elem.val->>'stationName', ''), 'Unknown') as station_name,
      coalesce(nullif(elem.val->>'nbBoards', '')::int, 0) as nb_boards,
      coalesce(nullif(elem.val->>'nbBoardsOK', '')::int, 0) as nb_boards_ok,
      (coalesce(nullif(elem.val->>'nbBoards', '')::int, 0) - coalesce(nullif(elem.val->>'nbBoardsOK', '')::int, 0)) as error_count,
      nullif(nullif(elem.val->>'fpy', '')::numeric, 0) as fpy
    from jsonb_array_elements(stations) with ordinality as elem(val, ord);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reports_sync_children on public.reports;
create trigger trg_reports_sync_children
after insert or update on public.reports
for each row
execute function public.sync_report_children();

alter table public.reports enable row level security;
alter table public.report_stations enable row level security;

-- Ensure API roles can see the public schema/table through PostgREST
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.reports to anon, authenticated;
grant usage, select on sequence public.reports_id_seq to anon, authenticated;
grant select, insert, update, delete on table public.report_stations to anon, authenticated;
grant usage, select on sequence public.report_stations_id_seq to anon, authenticated;

-- Recreate policies in an idempotent way
drop policy if exists reports_select on public.reports;
drop policy if exists reports_insert on public.reports;
drop policy if exists reports_update on public.reports;
drop policy if exists reports_delete on public.reports;
drop policy if exists report_stations_select on public.report_stations;
drop policy if exists report_stations_insert on public.report_stations;
drop policy if exists report_stations_update on public.report_stations;
drop policy if exists report_stations_delete on public.report_stations;

create policy reports_select on public.reports for select to anon, authenticated using (true);
create policy reports_insert on public.reports for insert to anon, authenticated with check (true);
create policy reports_update on public.reports for update to anon, authenticated using (true) with check (true);
create policy reports_delete on public.reports for delete to anon, authenticated using (true);

create policy report_stations_select on public.report_stations for select to anon, authenticated using (true);
create policy report_stations_insert on public.report_stations for insert to anon, authenticated with check (true);
create policy report_stations_update on public.report_stations for update to anon, authenticated using (true) with check (true);
create policy report_stations_delete on public.report_stations for delete to anon, authenticated using (true);

-- Ask PostgREST to refresh schema cache immediately
notify pgrst, 'reload schema';

-- =============================================================================
-- ROTATION SYSTEM TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 5) Employees table
-- -----------------------------------------------------------------------------
create table if not exists public.employees (
  id bigserial primary key,
  emp_id text not null unique,
  name text not null,
  phone text default '',
  email text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employees_emp_id on public.employees(emp_id);

drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6) Rotation stations (production line stations)
-- -----------------------------------------------------------------------------
create table if not exists public.rotation_stations (
  id bigserial primary key,
  station_order integer not null default 0,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rotation_stations_order on public.rotation_stations(station_order);

-- -----------------------------------------------------------------------------
-- 7) Rotation base assignments (who is assigned to which station — master)
-- -----------------------------------------------------------------------------
create table if not exists public.rotation_assignments (
  id bigserial primary key,
  station_id bigint not null references public.rotation_stations(id) on delete cascade,
  emp_id text not null references public.employees(emp_id) on delete cascade,
  assignment_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(station_id, emp_id)
);

create index if not exists idx_rotation_assignments_station on public.rotation_assignments(station_id);
create index if not exists idx_rotation_assignments_emp on public.rotation_assignments(emp_id);

-- -----------------------------------------------------------------------------
-- 8) Rotation config (start date, shift amount)
-- -----------------------------------------------------------------------------
create table if not exists public.rotation_config (
  id integer primary key default 1 check (id = 1),
  start_date date,
  shift_amount integer not null default 1,
  updated_at timestamptz not null default now()
);

-- Insert default row if not exists
insert into public.rotation_config (id, shift_amount)
values (1, 1)
on conflict (id) do nothing;

drop trigger if exists trg_rotation_config_updated_at on public.rotation_config;
create trigger trg_rotation_config_updated_at
before update on public.rotation_config
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS + Grants for rotation tables
-- -----------------------------------------------------------------------------
alter table public.employees enable row level security;
alter table public.rotation_stations enable row level security;
alter table public.rotation_assignments enable row level security;
alter table public.rotation_config enable row level security;

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table public.employees to anon, authenticated;
grant usage, select on sequence public.employees_id_seq to anon, authenticated;

grant select, insert, update, delete on table public.rotation_stations to anon, authenticated;
grant usage, select on sequence public.rotation_stations_id_seq to anon, authenticated;

grant select, insert, update, delete on table public.rotation_assignments to anon, authenticated;
grant usage, select on sequence public.rotation_assignments_id_seq to anon, authenticated;

grant select, insert, update, delete on table public.rotation_config to anon, authenticated;

-- Policies: employees
drop policy if exists employees_select on public.employees;
drop policy if exists employees_insert on public.employees;
drop policy if exists employees_update on public.employees;
drop policy if exists employees_delete on public.employees;
create policy employees_select on public.employees for select to anon, authenticated using (true);
create policy employees_insert on public.employees for insert to anon, authenticated with check (true);
create policy employees_update on public.employees for update to anon, authenticated using (true) with check (true);
create policy employees_delete on public.employees for delete to anon, authenticated using (true);

-- Policies: rotation_stations
drop policy if exists rotation_stations_select on public.rotation_stations;
drop policy if exists rotation_stations_insert on public.rotation_stations;
drop policy if exists rotation_stations_update on public.rotation_stations;
drop policy if exists rotation_stations_delete on public.rotation_stations;
create policy rotation_stations_select on public.rotation_stations for select to anon, authenticated using (true);
create policy rotation_stations_insert on public.rotation_stations for insert to anon, authenticated with check (true);
create policy rotation_stations_update on public.rotation_stations for update to anon, authenticated using (true) with check (true);
create policy rotation_stations_delete on public.rotation_stations for delete to anon, authenticated using (true);

-- Policies: rotation_assignments
drop policy if exists rotation_assignments_select on public.rotation_assignments;
drop policy if exists rotation_assignments_insert on public.rotation_assignments;
drop policy if exists rotation_assignments_update on public.rotation_assignments;
drop policy if exists rotation_assignments_delete on public.rotation_assignments;
create policy rotation_assignments_select on public.rotation_assignments for select to anon, authenticated using (true);
create policy rotation_assignments_insert on public.rotation_assignments for insert to anon, authenticated with check (true);
create policy rotation_assignments_update on public.rotation_assignments for update to anon, authenticated using (true) with check (true);
create policy rotation_assignments_delete on public.rotation_assignments for delete to anon, authenticated using (true);

-- Policies: rotation_config
drop policy if exists rotation_config_select on public.rotation_config;
drop policy if exists rotation_config_insert on public.rotation_config;
drop policy if exists rotation_config_update on public.rotation_config;
drop policy if exists rotation_config_delete on public.rotation_config;
create policy rotation_config_select on public.rotation_config for select to anon, authenticated using (true);
create policy rotation_config_insert on public.rotation_config for insert to anon, authenticated with check (true);
create policy rotation_config_update on public.rotation_config for update to anon, authenticated using (true) with check (true);
create policy rotation_config_delete on public.rotation_config for delete to anon, authenticated using (true);

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';
