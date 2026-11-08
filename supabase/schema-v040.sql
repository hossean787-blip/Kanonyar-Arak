-- Kanonha v0.4: isolated student directory, catalog and enrollments.
-- Run ONLY in a newly created, dedicated Kanonha Supabase project.
-- Do not apply to existing authentication projects.
begin;

create table if not exists public.kanonha_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 80),
  student_number text not null unique check (student_number ~ '^[0-9]{6,20}$'),
  university_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kanonha_clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 2 and 120),
  description text not null default '',
  category text not null default 'سایر',
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.kanonha_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.kanonha_clubs(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  starts_at timestamptz not null,
  registration_deadline timestamptz not null,
  location text not null default '',
  capacity integer not null check (capacity > 0),
  registered_count integer not null default 0 check (registered_count >= 0 and registered_count <= capacity),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint kanonha_deadline_before_event check (registration_deadline <= starts_at)
);

create table if not exists public.kanonha_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references public.kanonha_clubs(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  unique (user_id, club_id)
);

create table if not exists public.kanonha_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.kanonha_events(id) on delete restrict,
  status text not null default 'confirmed' check (status = 'confirmed'),
  registered_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create index if not exists kanonha_events_club_idx on public.kanonha_events (club_id, starts_at);
create index if not exists kanonha_memberships_user_idx on public.kanonha_memberships (user_id);
create index if not exists kanonha_memberships_club_idx on public.kanonha_memberships (club_id);
create index if not exists kanonha_regs_user_idx on public.kanonha_registrations (user_id);
create index if not exists kanonha_regs_event_idx on public.kanonha_registrations (event_id);

alter table public.kanonha_profiles enable row level security;
alter table public.kanonha_clubs enable row level security;
alter table public.kanonha_events enable row level security;
alter table public.kanonha_memberships enable row level security;
alter table public.kanonha_registrations enable row level security;

-- Restrict PUBLIC grants, including columns reserved for server administrators.
revoke all on public.kanonha_profiles, public.kanonha_clubs, public.kanonha_events,
              public.kanonha_memberships, public.kanonha_registrations from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select (user_id, full_name, student_number, university_verified, created_at, updated_at)
  on public.kanonha_profiles to authenticated;
grant insert (user_id, full_name, student_number) on public.kanonha_profiles to authenticated;
grant update (full_name, student_number) on public.kanonha_profiles to authenticated;
grant select (id, name, description, category, is_active, created_at) on public.kanonha_clubs to anon, authenticated;
grant select (id, club_id, title, starts_at, registration_deadline, location, capacity,
              registered_count, is_published, created_at)
  on public.kanonha_events to anon, authenticated;
grant select (id, user_id, club_id, status, requested_at) on public.kanonha_memberships to authenticated;
grant insert (user_id, club_id) on public.kanonha_memberships to authenticated;
grant select (id, user_id, event_id, status, registered_at) on public.kanonha_registrations to authenticated;
grant insert (user_id, event_id) on public.kanonha_registrations to authenticated;

create policy "kanonha_own_profile_read" on public.kanonha_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "kanonha_own_profile_create" on public.kanonha_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "kanonha_own_profile_update" on public.kanonha_profiles
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "kanonha_active_clubs_public" on public.kanonha_clubs
  for select to anon, authenticated using (is_active = true);
create policy "kanonha_published_events_public" on public.kanonha_events
  for select to anon, authenticated using (is_published = true);

create policy "kanonha_own_memberships_read" on public.kanonha_memberships
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "kanonha_own_memberships_request" on public.kanonha_memberships
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id and status = 'pending'
    and exists (select 1 from public.kanonha_profiles p where p.user_id = (select auth.uid()))
    and exists (select 1 from public.kanonha_clubs c where c.id = club_id and c.is_active = true)
  );

create policy "kanonha_own_registrations_read" on public.kanonha_registrations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "kanonha_own_registrations_create" on public.kanonha_registrations
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id and status = 'confirmed'
    and exists (select 1 from public.kanonha_profiles p where p.user_id = (select auth.uid()))
  );

-- Atomic capacity check; row-level UPDATE lock serializes concurrent seat reservations.
-- Private schema prevents clients from directly invoking the privileged function.
create schema if not exists kanonha_private;
revoke all on schema kanonha_private from public, anon, authenticated;
create or replace function kanonha_private.reserve_event_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  update public.kanonha_events
     set registered_count = registered_count + 1
   where id = new.event_id
     and is_published
     and registration_deadline > now()
     and starts_at > now()
     and registered_count < capacity;
  if not found then
    raise exception 'Event registration closed or capacity exhausted'
      using errcode = 'P0001';
  end if;
  return new;
end
$fn$;
revoke all on function kanonha_private.reserve_event_capacity() from public, anon, authenticated;
drop trigger if exists kanonha_reserve_capacity on public.kanonha_registrations;
create trigger kanonha_reserve_capacity
  before insert on public.kanonha_registrations
  for each row execute function kanonha_private.reserve_event_capacity();

-- There is intentionally no end-user UPDATE/DELETE permission for registrations,
-- which keeps the event capacity counter consistent until admin workflows are built.

commit;
