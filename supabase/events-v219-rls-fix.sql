-- Kanonha: fix pre-existing RLS cycle when an authenticated student registers.
-- registrations INSERT -> profiles SELECT -> registrations SELECT recursion.
begin;
create or replace function kanonha_private.current_student_has_profile()
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(
   select 1 from public.kanonha_profiles p where p.user_id=(select auth.uid())
 );
$$;
revoke all on function kanonha_private.current_student_has_profile() from public,anon,authenticated;
grant execute on function kanonha_private.current_student_has_profile() to authenticated;
drop policy if exists kanonha_own_registrations_create on public.kanonha_registrations;
create policy kanonha_own_registrations_create on public.kanonha_registrations
 for insert to authenticated
 with check (user_id=(select auth.uid()) and status='confirmed'
   and kanonha_private.current_student_has_profile());
commit;
