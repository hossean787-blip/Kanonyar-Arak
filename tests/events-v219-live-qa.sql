-- Kanonha event QA against the connected database.
-- Requires an active secretary with a complete student profile.
-- Never COMMIT: all temporary event/registration/certificate rows roll back.
begin;
select set_config('request.jwt.claim.sub',
 (select s.user_id::text from public.kanonha_secretaries s
 join public.kanonha_clubs c on c.id=s.club_id and c.is_active
 join public.kanonha_profiles p on p.user_id=s.user_id
 join public.kanonha_academic_details a on a.user_id=s.user_id
 where p.student_number ~ '^[0-9]{6,20}$' and a.mobile ~ '^09[0-9]{9}$'
 limit 1),true);
set local role authenticated;
do $test$
declare v_event uuid; v_other uuid; v_reg uuid; v_ticket uuid;
 v_result text; v_approval text; v_count int; v_capacity int; v_registered bigint; v_attended bigint;
begin
 if (select auth.uid()) is null then raise exception 'Missing eligible QA identity'; end if;
 -- The secretary publishes directly; a director approval step is not involved.
 insert into public.kanonha_events(club_id,title,location,description,starts_at,registration_deadline,capacity,is_published)
 values((select club_id from public.kanonha_secretaries where user_id=(select auth.uid()) limit 1),
  'آزمون بازگشت‌پذیر رویداد','سالن آزمون','آزمون زیرسامانه رویداد',
  now()+interval '8 days',now()+interval '7 days',1,true)
 returning id,approval_status into v_event,v_approval;
 if v_approval<>'approved' then raise exception 'Direct publication still requires approval'; end if;
 insert into public.kanonha_events(club_id,title,location,description,starts_at,registration_deadline,capacity,is_published)
 values((select club_id from public.kanonha_secretaries where user_id=(select auth.uid()) limit 1),
  'آزمون رویداد دوم','سالن آزمون','آزمون جداسازی بلیت',
  now()+interval '8 days',now()+interval '7 days',1,true)
 returning id into v_other;
 insert into public.kanonha_registrations(user_id,event_id)
 values((select auth.uid()),v_event);
 -- A student receives the opaque ticket only through the owner-scoped RPC.
 select registration_id,ticket_token into v_reg,v_ticket
 from public.kanonha_my_event_history() where event_id=v_event;
 if v_reg is null or v_ticket is null then raise exception 'Student ticket RPC failed'; end if;
 select registered_count into v_capacity from public.kanonha_events where id=v_event;
 if v_capacity<>1 then raise exception 'Capacity reservation failed'; end if;
 select result into v_result from public.kanonha_checkin_ticket(v_ticket,v_other);
 if v_result<>'invalid' then raise exception 'Cross-event ticket accepted'; end if;
 select result into v_result from public.kanonha_checkin_ticket(v_ticket,v_event);
 if v_result<>'early' then raise exception 'Early check-in accepted'; end if;
 -- Editing remains available after students register.
 update public.kanonha_events set starts_at=now()-interval '1 hour',
  registration_deadline=now()-interval '2 hours' where id=v_event;
 if not found then raise exception 'Secretary could not edit after registration'; end if;
 select result into v_result from public.kanonha_checkin_ticket(v_ticket,v_event);
 if v_result<>'checked_in' then raise exception 'Valid scan failed: %',v_result; end if;
 select result into v_result from public.kanonha_checkin_ticket(v_ticket,v_event);
 if v_result<>'already' then raise exception 'Repeated scan was not rejected'; end if;
 select count(*) into v_count from public.kanonha_certificates where registration_id=v_reg;
 if v_count<>1 then raise exception 'Automatic certificate count wrong: %',v_count; end if;
 select registrations,attendees,capacity into v_registered,v_attended,v_capacity
 from public.kanonha_event_summary(v_event);
 if v_registered<>1 or v_attended<>1 or v_capacity<>1 then
  raise exception 'Attendance summary mismatch'; end if;
 -- Student cancellation is explicitly forbidden.
 begin
  delete from public.kanonha_registrations where id=v_reg;
  raise exception 'Student event cancellation unexpectedly allowed';
 exception when insufficient_privilege then null;
 end;
end
$test$;
rollback;
