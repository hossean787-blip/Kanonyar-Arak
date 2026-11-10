-- Event lifecycle end-to-end security integration; all generated rows roll back.
begin;
select set_config('request.jwt.claim.sub',
 (select s.user_id::text from public.kanonha_secretaries s
 join public.kanonha_clubs c on c.id=s.club_id and c.is_active
 join public.kanonha_profiles p on p.user_id=s.user_id limit 1),true);
set local role service_role;
insert into public.kanonha_events(club_id,title,starts_at,registration_deadline,
 capacity,is_published,approval_status,approved_at)
values((select club_id from public.kanonha_secretaries
 where user_id=(select auth.uid()) limit 1),
 'QA event one',now()+interval '8 days',now()+interval '7 days',1,true,'approved',now());
insert into public.kanonha_events(club_id,title,starts_at,registration_deadline,
 capacity,is_published,approval_status,approved_at)
values((select club_id from public.kanonha_secretaries
 where user_id=(select auth.uid()) limit 1),
 'QA event two',now()+interval '8 days',now()+interval '7 days',1,true,'approved',now());
set local role authenticated;
do $$
declare e1 uuid; e2 uuid; rid uuid; token uuid; status text; total bigint; present bigint; seats integer; failed boolean;
begin
 select id into e1 from public.kanonha_events where title='QA event one' order by created_at desc limit 1;
 select id into e2 from public.kanonha_events where title='QA event two' order by created_at desc limit 1;
 if e1 is null or e2 is null then raise exception 'Event QA fixture missing'; end if;
 insert into public.kanonha_registrations(user_id,event_id)
 values((select auth.uid()),e1) returning id,ticket_token into rid,token;
 select registered_count into seats from public.kanonha_events where id=e1;
 if seats<>1 then raise exception 'FAILED capacity reservation'; end if;
 select result into status from public.kanonha_checkin_ticket(token,e1);
 if status<>'early' then raise exception 'FAILED early checkin: %',status;end if;
 select result into status from public.kanonha_checkin_ticket(token,e2);
 if status<>'invalid' then raise exception 'FAILED cross-event checkin: %',status;end if;
 set local role service_role;
 update public.kanonha_events set starts_at=now()-interval '1 hour',
  registration_deadline=now()-interval '2 hours' where id=e1;
 set local role authenticated;
 select result into status from public.kanonha_checkin_ticket(token,e1);
 if status<>'checked_in' then raise exception 'FAILED first checkin: %',status;end if;
 select result into status from public.kanonha_checkin_ticket(token,e1);
 if status<>'already' then raise exception 'FAILED duplicate detection: %',status;end if;
 select registrations,attendees,capacity into total,present,seats from public.kanonha_event_summary(e1);
 if total<>1 or present<>1 or seats<>1 then raise exception 'FAILED attendance metrics: % % %',total,present,seats;end if;
 failed:=false;
 begin delete from public.kanonha_registrations where id=rid;
 exception when others then failed:=true;end;
 if not failed then
  if not exists(select 1 from public.kanonha_registrations where id=rid) then
   raise exception 'FAILED attended registration was cancelled';
  end if;
 end if;
end $$;
rollback;