-- Kanonha v0.7 unified identity and admin. Apply only to dedicated project.
-- Owner: verified Gmail address, never raw unverified email or editable user metadata.

create table if not exists public.kanonha_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.kanonha_admins enable row level security;
revoke all on public.kanonha_admins from public, anon, authenticated;
grant select (user_id,created_at) on public.kanonha_admins to authenticated;
create policy "admin_can_read_own_role" on public.kanonha_admins
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function kanonha_private.sync_verified_owner()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if lower(coalesce(new.email,'')) = 'hossean787@gmail.com'
     and new.email_confirmed_at is not null then
    insert into public.kanonha_admins(user_id) values(new.id)
      on conflict (user_id) do nothing;
  else
    delete from public.kanonha_admins where user_id = new.id;
  end if;
  return new;
end
$fn$;
revoke all on function kanonha_private.sync_verified_owner() from public, anon, authenticated;
drop trigger if exists kanonha_verified_owner_sync on auth.users;
create trigger kanonha_verified_owner_sync
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function kanonha_private.sync_verified_owner();
-- Backfill only a VERIFIED user belonging to the intended owner email:
insert into public.kanonha_admins(user_id)
select id from auth.users where lower(email)='hossean787@gmail.com'
 and email_confirmed_at is not null on conflict do nothing;

-- Never expose either identifier mappings or internal synthetic Auth email.
create table if not exists public.kanonha_student_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  student_number text not null unique check (student_number ~ '^[0-9]{6,20}$'),
  national_digest text not null unique check (national_digest ~ '^[a-f0-9]{64}$'),
  internal_email text not null unique,
  registered_at timestamptz not null default now()
);
alter table public.kanonha_student_credentials enable row level security;
revoke all on public.kanonha_student_credentials from public, anon, authenticated;

create table if not exists public.kanonha_academic_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_date date not null check (birth_date between date '1920-01-01' and date '2100-12-31'),
  university text not null check(char_length(btrim(university)) between 2 and 120),
  faculty text not null check(char_length(btrim(faculty)) between 2 and 120),
  major text not null check(char_length(btrim(major)) between 2 and 120),
  created_at timestamptz not null default now()
);
alter table public.kanonha_academic_details enable row level security;
revoke all on public.kanonha_academic_details from public, anon, authenticated;
grant select (user_id,birth_date,university,faculty,major,created_at)
  on public.kanonha_academic_details to authenticated;
grant update (university,faculty,major) on public.kanonha_academic_details to authenticated;
create policy "student_own_academic_read" on public.kanonha_academic_details
  for select to authenticated using (user_id = (select auth.uid()));
create policy "student_own_academic_edit" on public.kanonha_academic_details
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- National ID is NOT stored as plaintext. Date of birth is never secretary-visible.

-- Keep canonical login student number immutable except via trusted administrator;
-- otherwise alias and displayed profile could diverge.
revoke update (student_number) on public.kanonha_profiles from authenticated;

-- Rate-limit keys are HMAC hashes, not plaintext identifying details.
create table if not exists public.kanonha_auth_attempts (
  lookup_hash text primary key check (lookup_hash ~ '^[a-f0-9]{64}$'),
  attempts integer not null default 1,
  window_start timestamptz not null default now()
);
alter table public.kanonha_auth_attempts enable row level security;
revoke all on public.kanonha_auth_attempts from public, anon, authenticated;
create or replace function public.kanonha_rate_limit(p_key text, p_max integer default 8, p_minutes integer default 15)
returns boolean language plpgsql security definer set search_path='' as $fn$
declare n integer;
begin
  if p_key !~ '^[a-f0-9]{64}$' or p_max < 1 or p_max > 20 or p_minutes < 1 or p_minutes > 60 then
    raise exception 'Invalid parameters';
  end if;
  insert into public.kanonha_auth_attempts(lookup_hash,attempts,window_start)
  values(p_key,1,now())
  on conflict(lookup_hash) do update set
    attempts = case when public.kanonha_auth_attempts.window_start < now() - make_interval(mins => p_minutes)
       then 1 else public.kanonha_auth_attempts.attempts+1 end,
    window_start = case when public.kanonha_auth_attempts.window_start < now() - make_interval(mins => p_minutes)
       then now() else public.kanonha_auth_attempts.window_start end
  returning attempts into n;
  return n <= p_max;
end
$fn$;
revoke all on function public.kanonha_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.kanonha_rate_limit(text,integer,integer) to service_role;

-- Admins are bound to server-managed authenticated verified identity.
-- The UI queries only its own role; admin mutations are handled by a separate JWT-validated Edge Function.
create index if not exists kanonha_academic_university_idx on public.kanonha_academic_details (university);
