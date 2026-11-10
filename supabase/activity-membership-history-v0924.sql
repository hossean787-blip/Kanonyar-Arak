-- Kanonha: include both active and archived clubs in the signed-in student's activity.
begin;
create or replace function public.kanonha_my_club_memberships()
returns table(club_id uuid,club_name text,category text,university text,
 is_active boolean,status text)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid());
begin
 if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 return query
 select m.club_id,c.name,c.category,c.university,c.is_active,m.status
 from public.kanonha_memberships m
 join public.kanonha_clubs c on c.id=m.club_id
 where m.user_id=v_actor
 order by m.requested_at desc;
end $$;
revoke all on function public.kanonha_my_club_memberships() from public,anon,authenticated;
grant execute on function public.kanonha_my_club_memberships() to authenticated;
commit;