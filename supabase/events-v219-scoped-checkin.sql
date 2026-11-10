-- Restrict scanned tickets to the currently selected event, not merely any assigned club.
begin;
drop function if exists public.kanonha_checkin_ticket(uuid);
create or replace function public.kanonha_checkin_ticket(p_token uuid,p_event_id uuid)
returns table(result text, attendee text, event_title text)
language plpgsql security definer set search_path = '' as $$
declare v record; v_actor uuid := (select auth.uid());
begin
 if v_actor is null then raise exception 'Unauthorized'; end if;
 select r.id,r.attended_at,r.status,e.club_id,e.starts_at,e.title,p.full_name
 into v from public.kanonha_registrations r
 join public.kanonha_events e on e.id=r.event_id
 left join public.kanonha_profiles p on p.user_id=r.user_id
 where r.ticket_token=p_token and r.event_id=p_event_id
 for update of r;
 if not found then
  return query select 'invalid'::text,''::text,''::text;return;
 end if;
 if not exists(select 1 from public.kanonha_secretaries s
   where s.user_id=v_actor and s.club_id=v.club_id)
 and not exists(select 1 from public.kanonha_admins a where a.user_id=v_actor)
 then raise exception 'Forbidden'; end if;
 if v.status <> 'confirmed' then
  return query select 'invalid'::text,''::text,''::text;return;
 end if;
 if v.starts_at>now() then
  return query select 'early'::text,coalesce(v.full_name,'')::text,v.title::text;return;
 end if;
 if v.attended_at is not null then
  return query select 'already'::text,coalesce(v.full_name,'')::text,v.title::text;return;
 end if;
 update public.kanonha_registrations set attended_at=now() where id=v.id;
 return query select 'checked_in'::text,coalesce(v.full_name,'')::text,v.title::text;
end $$;
revoke all on function public.kanonha_checkin_ticket(uuid,uuid) from public,anon;
grant execute on function public.kanonha_checkin_ticket(uuid,uuid) to authenticated;


commit;
