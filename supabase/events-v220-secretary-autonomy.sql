-- Kanonha v0.9.22: secretary-owned events, complete profiles and automatic certificates.
-- Independent Kanonha project. Apply after events-v219 and activity-certificates-v0923.
begin;
alter table public.kanonha_events add column if not exists description text not null default '';
alter table public.kanonha_events alter column approval_status set default 'approved';
grant select (description) on public.kanonha_events to anon,authenticated;
grant insert (description) on public.kanonha_events to authenticated;
grant update (description) on public.kanonha_events to authenticated;

-- Publication belongs to the assigned secretary. Keep legacy approval columns for old clients,
-- but no manager approval is required for new events or edits.
create or replace function kanonha_private.guard_event_approval()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.capacity < new.registered_count then
  raise exception 'Capacity cannot be lower than confirmed registrations' using errcode='23514';
 end if;
 if new.registration_deadline > new.starts_at then
  raise exception 'Registration deadline must precede event start' using errcode='23514';
 end if;
 if char_length(btrim(new.title)) < 2 or char_length(new.title)>160
    or char_length(btrim(new.location)) < 2 or char_length(new.location)>250
    or char_length(new.description)>4000 then
  raise exception 'Incomplete event details' using errcode='23514';
 end if;
 if new.poster_path is not null and
    new.poster_path <> new.club_id::text||'/'||new.id::text||'.webp' then
  raise exception 'Invalid event poster path' using errcode='23514';
 end if;
 new.approval_status := 'approved';
 new.approved_at := null;
 return new;
end $$;

-- Keep rejected legacy drafts unpublished; remove obsolete waiting-for-approval for active events.
update public.kanonha_events set is_published=true
 where approval_status='pending' and not is_published
   and starts_at>now() and registration_deadline>now()
   and char_length(btrim(location))>=2;
update public.kanonha_events set approval_status='approved',approved_at=null
 where approval_status<>'approved';

drop policy if exists kanonha_published_events_public on public.kanonha_events;
create policy kanonha_published_events_public on public.kanonha_events
 for select to anon,authenticated using(is_published);

drop policy if exists secretary_can_create_assigned_event on public.kanonha_events;
create policy secretary_can_create_assigned_event on public.kanonha_events
 for insert to authenticated with check (
  exists(select 1 from public.kanonha_secretaries s
   join public.kanonha_clubs c on c.id=s.club_id
   where s.club_id=kanonha_events.club_id and s.user_id=(select auth.uid()) and c.is_active)
  and starts_at>now() and registration_deadline>now()
  and capacity>=registered_count
 );
drop policy if exists secretary_can_edit_assigned_event on public.kanonha_events;
create policy secretary_can_edit_assigned_event on public.kanonha_events
 for update to authenticated
 using(exists(select 1 from public.kanonha_secretaries s
   where s.club_id=kanonha_events.club_id and s.user_id=(select auth.uid())))
 with check(exists(select 1 from public.kanonha_secretaries s
   where s.club_id=kanonha_events.club_id and s.user_id=(select auth.uid()))
   and capacity>=registered_count and registration_deadline<=starts_at);

-- Registration must be backed by a fully populated personal and academic profile.
create or replace function kanonha_private.current_student_has_profile()
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(
   select 1 from public.kanonha_profiles p
   join public.kanonha_academic_details a on a.user_id=p.user_id
   where p.user_id=(select auth.uid())
    and char_length(btrim(p.full_name))>=2
    and p.student_number ~ '^[0-9]{6,20}$'
    and a.birth_date is not null
    and char_length(btrim(a.university))>=2
    and char_length(btrim(a.faculty))>=2
    and char_length(btrim(a.major))>=2
    and a.mobile ~ '^09[0-9]{9}$'
 );
$$;
revoke all on function kanonha_private.current_student_has_profile() from public,anon,authenticated;
grant execute on function kanonha_private.current_student_has_profile() to authenticated;

-- Attendance by authenticated staff writes a permanent certificate in the SAME transaction.
-- Duplicate scans stay idempotent; students have no table INSERT/UPDATE permissions.
create or replace function kanonha_private.issue_certificate_on_attendance()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());
begin
 if old.attended_at is null and new.attended_at is not null
    and new.status='confirmed' and v_actor is not null then
  insert into public.kanonha_certificates
   (registration_id,user_id,event_id,student_name,student_number,event_title,
    club_name,event_starts_at,event_location,issued_by)
  select new.id,new.user_id,new.event_id,p.full_name,p.student_number,e.title,
    c.name,e.starts_at,e.location,v_actor
  from public.kanonha_events e
  join public.kanonha_clubs c on c.id=e.club_id
  join public.kanonha_profiles p on p.user_id=new.user_id
  where e.id=new.event_id and e.starts_at<=now()
  on conflict (registration_id) do nothing;
  if not found and not exists(
     select 1 from public.kanonha_certificates cert where cert.registration_id=new.id
  ) then
    raise exception 'Certificate could not be issued' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
revoke all on function kanonha_private.issue_certificate_on_attendance() from public,anon,authenticated;
drop trigger if exists kanonha_auto_certificate_on_attendance on public.kanonha_registrations;
create trigger kanonha_auto_certificate_on_attendance
 after update of attended_at on public.kanonha_registrations
 for each row execute function kanonha_private.issue_certificate_on_attendance();

-- Registration cancellation is deliberately unavailable to students.
drop policy if exists kanonha_student_cancel_event on public.kanonha_registrations;
revoke delete on public.kanonha_registrations from authenticated;
commit;