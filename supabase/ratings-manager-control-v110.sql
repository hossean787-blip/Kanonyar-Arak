-- Kanonha v1.1: ONLY the verified global manager can operate the survey.
-- Scores are inaccessible until explicit manager approval; no automatic publishing.
create table if not exists public.kanonha_rating_control (
  id integer primary key default 1 check (id=1),
  voting_open boolean not null default false,
  results_published boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint kanonha_rating_no_live_publishing check (not (voting_open and results_published))
);
insert into public.kanonha_rating_control(id,voting_open,results_published)
values(1,false,false) on conflict(id) do nothing;

alter table public.kanonha_rating_control enable row level security;
revoke all on public.kanonha_rating_control from public,anon,authenticated;
grant select on public.kanonha_rating_control to anon,authenticated;
grant update (voting_open,results_published) on public.kanonha_rating_control to authenticated;

create policy kanonha_rating_control_public_read on public.kanonha_rating_control
  for select to anon,authenticated using (true);
create policy kanonha_rating_control_manager_update on public.kanonha_rating_control
  for update to authenticated
  using (exists (select 1 from public.kanonha_admins a where a.user_id=(select auth.uid())))
  with check (exists (select 1 from public.kanonha_admins a where a.user_id=(select auth.uid())));

-- Strip ALL direct aggregate-column read access, including deliberate API requests.
-- PostgREST callers now must explicitly select only allowed catalog columns.
revoke select on public.kanonha_rating_targets from anon,authenticated;
grant select (id,category,title,subtitle,is_active) on public.kanonha_rating_targets to anon,authenticated;

-- Only permit new votes while the manager's survey is open.
drop policy if exists kanonha_ratings_student_one_insert on public.kanonha_ratings;
create policy kanonha_ratings_student_one_insert on public.kanonha_ratings
  for insert to authenticated
  with check (
    user_id=(select auth.uid())
    and exists (select 1 from public.kanonha_profiles p where p.user_id=(select auth.uid()))
    and exists (select 1 from public.kanonha_rating_targets t where t.id=target_id and t.is_active)
    and exists (select 1 from public.kanonha_rating_control c
      where c.id=1 and c.voting_open and not c.results_published)
  );

-- One narrow, audited reporting endpoint: only manager OR published results.
-- We use a definer solely because aggregate columns are intentionally inaccessible
-- to API roles; this function has no input, no dynamic SQL, and an explicit UID check.
create or replace function public.kanonha_rating_results()
returns table(target_id uuid,rating_count integer,rating_sum integer)
language plpgsql stable security definer set search_path=''
as $f$
begin
  if (select auth.uid()) is null then return; end if;
  if not exists (select 1 from public.kanonha_admins a
                 where a.user_id=(select auth.uid()))
     and not exists (select 1 from public.kanonha_rating_control c
                     where c.id=1 and c.results_published) then
    return;
  end if;
  return query
    select t.id,t.rating_count,t.rating_sum
    from public.kanonha_rating_targets t where t.is_active;
end;
$f$;
revoke all on function public.kanonha_rating_results() from public,anon,authenticated;
grant execute on function public.kanonha_rating_results() to authenticated;

-- The manager's explicit workflow is:
-- 1. Start voting: voting_open=true, results_published=false
-- 2. Close voting: voting_open=false
-- 3. Confirm release: results_published=true; cannot publish while open.
-- 4. Revoke results: results_published=false (manager-only).
-- The immutable, unique one-vote-per-target rule remains in place across phases.
