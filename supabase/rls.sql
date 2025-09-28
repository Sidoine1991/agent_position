-- Enable RLS and add safe policies for Presence CCRB
-- Run this in Supabase SQL Editor AFTER schema + data migration

-- Helper: claims email
create or replace function public.jwt_email() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', '')
$$;

-- ROLES: revoke public, restrict anon; prefer authenticated; service_role bypasses RLS
-- USERS
alter table public.users enable row level security;
revoke all on table public.users from anon;
revoke all on table public.users from public;
grant select, insert, update, delete on table public.users to authenticated;

-- Only allow a user to read/update/delete their own row by email; insert blocked (service inserts only)
drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users
  for select to authenticated
  using (email = public.jwt_email());

drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users
  for update to authenticated
  using (email = public.jwt_email());

drop policy if exists users_self_delete on public.users;
create policy users_self_delete on public.users
  for delete to authenticated
  using (email = public.jwt_email());

-- insert via service role only (no policy needed). If you want self-signup via PostgREST, uncomment below:
-- create policy users_self_insert on public.users for insert to authenticated with check (email = public.jwt_email());

-- MISSIONS
alter table public.missions enable row level security;
revoke all on table public.missions from anon;
revoke all on table public.missions from public;
grant select, insert, update, delete on table public.missions to authenticated;

drop policy if exists missions_owner_rw on public.missions;
create policy missions_owner_rw on public.missions
  for all to authenticated
  using (exists (
    select 1 from public.users u
    where u.id = public.missions.agent_id and u.email = public.jwt_email()
  ))
  with check (exists (
    select 1 from public.users u
    where u.id = public.missions.agent_id and u.email = public.jwt_email()
  ));

-- CHECKINS
alter table public.checkins enable row level security;
revoke all on table public.checkins from anon;
revoke all on table public.checkins from public;
grant select, insert, update, delete on table public.checkins to authenticated;

drop policy if exists checkins_mission_owner_rw on public.checkins;
create policy checkins_mission_owner_rw on public.checkins
  for all to authenticated
  using (exists (
    select 1 from public.missions m
    join public.users u on u.id = m.agent_id
    where m.id = public.checkins.mission_id and u.email = public.jwt_email()
  ))
  with check (exists (
    select 1 from public.missions m
    join public.users u on u.id = m.agent_id
    where m.id = public.checkins.mission_id and u.email = public.jwt_email()
  ));

-- ABSENCES
alter table public.absences enable row level security;
revoke all on table public.absences from anon;
revoke all on table public.absences from public;
grant select, insert, update, delete on table public.absences to authenticated;

drop policy if exists absences_self_rw on public.absences;
create policy absences_self_rw on public.absences
  for all to authenticated
  using (exists (
    select 1 from public.users u where u.id = public.absences.user_id and u.email = public.jwt_email()
  ))
  with check (exists (
    select 1 from public.users u where u.id = public.absences.user_id and u.email = public.jwt_email()
  ));

-- REPORTS
alter table public.reports enable row level security;
revoke all on table public.reports from anon;
revoke all on table public.reports from public;
grant select, insert, update, delete on table public.reports to authenticated;

drop policy if exists reports_self_rw on public.reports;
create policy reports_self_rw on public.reports
  for all to authenticated
  using (exists (
    select 1 from public.users u where u.id = public.reports.user_id and u.email = public.jwt_email()
  ))
  with check (exists (
    select 1 from public.users u where u.id = public.reports.user_id and u.email = public.jwt_email()
  ));

-- VERIFICATION CODES (service-role only)
alter table public.verification_codes enable row level security;
revoke all on table public.verification_codes from anon;
revoke all on table public.verification_codes from authenticated;
revoke all on table public.verification_codes from public;
-- no policies: only service role can access via RPC/server

-- APP SETTINGS (read-only for authenticated)
alter table public.app_settings enable row level security;
revoke all on table public.app_settings from anon;
revoke all on table public.app_settings from public;
grant select on table public.app_settings to authenticated;

drop policy if exists app_settings_ro on public.app_settings;
create policy app_settings_ro on public.app_settings for select to authenticated using (true);

-- Optional: ADMIN policies (by email) if you need admin-wide access
-- create policy users_admin_all on public.users for all to authenticated using (public.jwt_email() in ('syebadokpo@gmail.com')) with check (public.jwt_email() in ('syebadokpo@gmail.com'));
-- Repeat similar for other tables if needed.


