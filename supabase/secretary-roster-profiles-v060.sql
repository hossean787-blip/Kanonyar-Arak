-- Secretary may see student profile only when the student is enrolled
-- in an event belonging to the secretary's assigned club.
-- This also covers attendees who aren't club members.
create policy "secretary_can_read_event_registrants_profiles" on public.kanonha_profiles
for select to authenticated using (
  exists (
    select 1 from public.kanonha_registrations r
    join public.kanonha_events e on e.id = r.event_id
    join public.kanonha_secretaries s on s.club_id = e.club_id
    where r.user_id = public.kanonha_profiles.user_id
      and s.user_id = (select auth.uid())
  )
);
