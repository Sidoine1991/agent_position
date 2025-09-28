-- Supabase schema for Presence CCRB
-- Execute this in Supabase SQL editor

create table if not exists users (
  id bigint generated always as identity primary key,
  email text not null unique,
  password_hash text,
  name text,
  role text check (role in ('admin','supervisor','agent')) default 'agent',
  phone text,
  is_verified boolean default false,
  verification_code text,
  verification_expires timestamptz,
  photo_path text,
  reference_lat numeric(10,6),
  reference_lon numeric(11,6),
  tolerance_radius_meters integer,
  departement text,
  commune text,
  arrondissement text,
  village text,
  project_name text,
  expected_days_per_month integer,
  expected_hours_per_month integer,
  planning_start_date date,
  planning_end_date date,
  created_at timestamptz default now()
);

create table if not exists missions (
  id bigint generated always as identity primary key,
  agent_id bigint references users(id) on delete set null,
  date_start timestamptz,
  date_end timestamptz,
  status text check (status in ('active','completed','cancelled')) default 'active',
  village_id bigint,
  departement text,
  commune text,
  arrondissement text,
  village text,
  note text,
  created_at timestamptz default now()
);

create table if not exists checkins (
  id bigint generated always as identity primary key,
  mission_id bigint references missions(id) on delete cascade,
  lat numeric(10,8),
  lon numeric(11,8),
  note text,
  photo_path text,
  timestamp timestamptz default now()
);

create table if not exists absences (
  id bigint generated always as identity primary key,
  user_id bigint references users(id) on delete cascade,
  date timestamptz not null,
  reason text,
  created_at timestamptz default now()
);

create table if not exists reports (
  id bigint generated always as identity primary key,
  user_id bigint references users(id) on delete set null,
  title text not null,
  type text not null,
  content text,
  data jsonb,
  created_at timestamptz default now()
);

create table if not exists verification_codes (
  id bigint generated always as identity primary key,
  email text not null,
  code text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create table if not exists app_settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

create index if not exists idx_users_email on users(email);
create index if not exists idx_users_role on users(role);
create index if not exists idx_presences_start_time on missions(date_start);
create index if not exists idx_reports_user_id on reports(user_id);
create index if not exists idx_verification_codes_email on verification_codes(email);


