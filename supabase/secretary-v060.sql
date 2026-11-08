-- Secretary role for the INDEPENDENT Kanonha project only.
-- No self-appointment: only project admins / privileged migrations can INSERT here.
-- Requires schema-v040.sql on https://cnqcysnjinghzzrzanpj.supabase.co.

create table if not exists public.kanonha_secretaries (
  club_id uuid not null references public.kanonha_clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  appointed_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index if not exists kanonha_secretaries_user_idx on public.kanonha_secretaries (user_id, club_id);

alter table public.kanonha_secretaries enable row level security;
revoke all on public.kanonha_secretaries from public, anon, authenticated;
grant select (club_id, user_id, appointed_at) on public.kanonha_secretaries to authenticated;
create policy "secretary_can_read_own_assignments" on public.kanonha_secretaries
  for select to authenticated using (user_id = (select auth.uid()));
-- There deliberately are NO INSERT / UPDATE / DELETE policies or grants for app users.

-- Secretaries can edit public-facing details of their assigned active club, but
-- can never grant roles, move the club ID or change the active flag.
grant update (name, description, category) on public.kanonha_clubs to authenticated;
create policy "secretary_can_update_assigned_club" on public.kanonha_clubs
  for update to authenticated
  using (
    exists (
      select 1 from public.kanonha_secretaries s
      where s.club_id = public.kanonha_clubs.id and s.user_id = (select auth.uid())
    ) and is_active = true
  )
  with check (
    exists (
      select 1 from public.kanonha_secretaries s
      where s.club_id = public.kanonha_clubs.id and s.user_id = (select auth.uid())
    ) and is_active = true
  );

-- Unpublished events are visible ONLY to secretaries of the same club.
create policy "secretary_can_read_assigned_events" on public.kanonha_events
  for select to authenticated
  using (exists (
    select 1 from public.kanonha_secretaries s
    where s.club_id = public.kanonha_events.club_id and s.user_id = (select auth.uid())
  ));

grant insert (club_id, title, starts_at, registration_deadline, location, capacity, is_published)
  on public.kanonha_events to authenticated;
grant update (title, starts_at, registration_deadline, location, capacity, is_published)
  on public.kanonha_events to authenticated;
create policy "secretary_can_create_assigned_event" on public.kanonha_events
  for insert to authenticated
  with check (
    exists (select 1 from public.kanonha_secretaries s
            join public.kanonha_clubs c on c.id = s.club_id
            where s.club_id = public.kanonha_events.club_id and s.user_id = (select auth.uid())
              and c.is_active)
    and starts_at > now() and registration_deadline > now()
  );
create policy "secretary_can_edit_assigned_event" on public.kanonha_events
  for update to authenticated
  using (exists (
    select 1 from public.kanonha_secretaries s where s.club_id = public.kanonha_events.club_id and s.user_id = (select auth.uid())
  ) and registered_count = 0)
  with check (
    exists (select 1 from public.kanonha_secretaries s
            where s.club_id = public.kanonha_events.club_id and s.user_id = (select auth.uid()))
    and registered_count = 0 and starts_at > now() and registration_deadline > now()
  );
-- Never grant update on club_id or registered_count.

-- A secretary can list membership requests and approved members ONLY for assigned clubs.
create policy "secretary_can_read_assigned_memberships" on public.kanonha_memberships
  for select to authenticated
  using (exists (
    select 1 from public.kanonha_secretaries s where s.club_id = public.kanonha_memberships.club_id and s.user_id = (select auth.uid())
  ));
alter table public.kanonha_memberships
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by uuid references auth.users(id) on delete set null;
grant update (status) on public.kanonha_memberships to authenticated;
create policy "secretary_can_decide_assigned_memberships" on public.kanonha_memberships
  for update to authenticated
  using (
    status = 'pending' and exists (
      select 1 from public.kanonha_secretaries s where s.club_id = public.kanonha_memberships.club_id and s.user_id = (select auth.uid())
    )
  )
  with check (
    status in ('approved', 'rejected') and exists (
      select 1 from public.kanonha_secretaries s where s.club_id = public.kanonha_memberships.club_id and s.user_id = (select auth.uid())
    )
  );
-- The user does not have permission to forge the decision audit fields.
create or replace function kanonha_private.audit_membership_decision()
returns trigger language plpgsql security invoker set search_path = '' as $func$
begin
  if old.status <> 'pending' or new.status not in ('approved', 'rejected')
    or new.club_id <> old.club_id or new.user_id <> old.user_id then
    raise exception 'Invalid membership state transition';
  end if;
  new.decided_by := auth.uid();
  new.decided_at := now();
  return new;
end;
$func$;
revoke all on function kanonha_private.audit_membership_decision() from public, anon, authenticated;
create trigger kanonha_membership_decision_audit
  before update on public.kanonha_memberships
  for each row execute function kanonha_private.audit_membership_decision();

-- See names/numbers only for students who applied to this secretary's club.
create policy "secretary_can_read_applicants_profiles" on public.kanonha_profiles
  for select to authenticated using (
    exists (
      select 1 from public.kanonha_memberships m
        join public.kanonha_secretaries s on s.club_id = m.club_id
      where m.user_id = public.kanonha_profiles.user_id and s.user_id = (select auth.uid())
    )
  );

-- Event roster and attendance; protect entries for ALL other clubs.
alter table public.kanonha_registrations
  add column if not exists attended_at timestamptz;
grant select (attended_at) on public.kanonha_registrations to authenticated;
grant update (attended_at) on public.kanonha_registrations to authenticated;
create policy "secretary_can_read_assigned_event_rosters" on public.kanonha_registrations
  for select to authenticated using (
    exists (
      select 1 from public.kanonha_events e
      join public.kanonha_secretaries s on s.club_id = e.club_id
      where e.id = public.kanonha_registrations.event_id and s.user_id = (select auth.uid())
    )
  );
create policy "secretary_can_mark_assigned_event_attendance" on public.kanonha_registrations
  for update to authenticated
  using (exists (
    select 1 from public.kanonha_events e
    join public.kanonha_secretaries s on s.club_id = e.club_id
    where e.id = public.kanonha_registrations.event_id and s.user_id = (select auth.uid())
      and e.starts_at <= now()
  ))
  with check (exists (
    select 1 from public.kanonha_events e
    join public.kanonha_secretaries s on s.club_id = e.club_id
    where e.id = public.kanonha_registrations.event_id and s.user_id = (select auth.uid())
      and e.starts_at <= now()
  ));
-- Attendance dates are set by server clock, not client-supplied values.
create or replace function kanonha_private.stamp_attendance()
returns trigger language plpgsql security invoker set search_path = '' as $func$
begin
  new.attended_at := case when new.attended_at is null then null else now() end;
  return new;
end;
$func$;
revoke all on function kanonha_private.stamp_attendance() from public, anon, authenticated;
create trigger kanonha_attendance_stamp
  before update of attended_at on public.kanonha_registrations
  for each row execute function kanonha_private.stamp_attendance();

-- Preserve information about actual attendance without issuing fake tickets.
