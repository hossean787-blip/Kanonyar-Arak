-- Academic directory, access isolation and registration safeguard (v0.9.3).
create table if not exists public.kanonha_universities (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 2 and 120),
 created_at timestamptz not null default now()
);
create unique index if not exists kanonha_universities_name_ci
 on public.kanonha_universities(lower(btrim(name)));
create table if not exists public.kanonha_faculties (
 id uuid primary key default gen_random_uuid(),
 university_id uuid not null references public.kanonha_universities(id) on delete restrict,
 name text not null check(length(btrim(name)) between 2 and 120),
 created_at timestamptz not null default now()
);
create unique index if not exists kanonha_faculties_university_name_ci
 on public.kanonha_faculties(university_id,lower(btrim(name)));
create index if not exists kanonha_faculties_university_idx
 on public.kanonha_faculties(university_id);
alter table public.kanonha_universities enable row level security;
alter table public.kanonha_faculties enable row level security;
revoke all on public.kanonha_universities,public.kanonha_faculties from public,anon,authenticated;
grant select on public.kanonha_universities,public.kanonha_faculties to anon,authenticated;
grant all on public.kanonha_universities,public.kanonha_faculties to service_role;
drop policy if exists kanonha_universities_public_read on public.kanonha_universities;
drop policy if exists kanonha_faculties_public_read on public.kanonha_faculties;
create policy kanonha_universities_public_read on public.kanonha_universities
 for select to anon,authenticated using (true);
create policy kanonha_faculties_public_read on public.kanonha_faculties
 for select to anon,authenticated using (true);
-- Keep legacy rows intact; reject new or changed university/faculty combinations
-- unless they are catalogued by the server-authorized manager.
create or replace function public.kanonha_check_academic_directory()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE'
    and new.university is not distinct from old.university
    and new.faculty is not distinct from old.faculty then return new; end if;
 if not exists (
  select 1 from public.kanonha_universities u
  join public.kanonha_faculties f on f.university_id=u.id
  where u.name=new.university and f.name=new.faculty
 ) then
  raise exception 'University/faculty not present in official Kanonha directory'
   using errcode='23514';
 end if;
 return new;
end;
$$;
revoke all on function public.kanonha_check_academic_directory() from public,anon,authenticated;
drop trigger if exists kanonha_academic_directory_guard on public.kanonha_academic_details;
create trigger kanonha_academic_directory_guard
 before insert or update of university,faculty on public.kanonha_academic_details
 for each row execute function public.kanonha_check_academic_directory();
