-- Live integration: student -> secretary -> manager, membership, event, QR, certificate.
-- Run ONLY in dedicated Kanonha project; all synthetic records are rolled back.
-- Failure aborts the transaction and leaves no persistent test records.
begin;
insert into auth.users(id,aud,role,email,created_at,updated_at) values
('a8320000-0000-4000-8000-000000000001','authenticated','authenticated','kanonha.qa.student@example.invalid',now(),now()),
('a8320000-0000-4000-8000-000000000002','authenticated','authenticated','kanonha.qa.secretary@example.invalid',now(),now()),
('a8320000-0000-4000-8000-000000000003','authenticated','authenticated','kanonha.qa.manager@example.invalid',now(),now());
insert into public.kanonha_profiles(user_id,full_name,student_number) values
('a8320000-0000-4000-8000-000000000001','دانشجوی آزمایشی','90200001'),
('a8320000-0000-4000-8000-000000000002','دبیر آزمایشی','90200002'),
('a8320000-0000-4000-8000-000000000003','مدیر آزمایشی','90200003');
insert into public.kanonha_academic_details(user_id,birth_date,university,faculty,major,mobile)
values('a8320000-0000-4000-8000-000000000001','2002-03-10',
'دانشگاه آزاد اسلامی- واحد اراک','علوم انسانی','رشته آزمایشی','09000000000');
insert into public.kanonha_clubs(id,name,description,category,is_active,university,faculty)
values('a8321000-0000-4000-8000-000000000000','کانون آزمون بازگشتی',
'کانون موقت صرفاً برای آزمون غیرماندگار','علمی',true,
'دانشگاه آزاد اسلامی- واحد اراک','علوم انسانی');
insert into public.kanonha_secretaries(club_id,user_id)
values('a8321000-0000-4000-8000-000000000000','a8320000-0000-4000-8000-000000000002');
insert into public.kanonha_admins(user_id)
values('a8320000-0000-4000-8000-000000000003');

-- Student: request membership, never self-approve.
set local role authenticated;
select set_config('request.jwt.claim.sub','a8320000-0000-4000-8000-000000000001',true);
insert into public.kanonha_memberships(user_id,club_id,status)
values('a8320000-0000-4000-8000-000000000001',
'a8321000-0000-4000-8000-000000000000','pending');

-- Secretary: pending request is visible and can be approved.
select set_config('request.jwt.claim.sub','a8320000-0000-4000-8000-000000000002',true);
do $$begin
 if (select count(*) from public.kanonha_memberships
 where club_id='a8321000-0000-4000-8000-000000000000' and status='pending')<>1
 then raise exception 'Secretary cannot view pending request';end if;
end$$;
update public.kanonha_memberships set status='approved'
where club_id='a8321000-0000-4000-8000-000000000000' and status='pending';

-- Secretary: publish upcoming event without manager approval.
insert into public.kanonha_events(id,club_id,title,location,description,starts_at,
 registration_deadline,capacity,is_published,event_type)
values('a8322000-0000-4000-8000-000000000000',
'a8321000-0000-4000-8000-000000000000','رویداد آزمون بازگشتی',
'سالن آزمایش','رویداد موقت غیرواقعی',now()+interval '2 hours',
now()+interval '1 hour',20,true,'workshop');

-- Student: enroll once; no certificate before attendance.
select set_config('request.jwt.claim.sub','a8320000-0000-4000-8000-000000000001',true);
insert into public.kanonha_registrations(id,user_id,event_id,ticket_token)
values('a8323000-0000-4000-8000-000000000000',
'a8320000-0000-4000-8000-000000000001',
'a8322000-0000-4000-8000-000000000000',
'a8324000-0000-4000-8000-000000000000');
do $$begin
 if (select count(*) from public.kanonha_certificates)>0
 then raise exception 'Certificate issued before attendance';end if;
end$$;

-- Secretary cannot mark attendance before the event.
select set_config('request.jwt.claim.sub','a8320000-0000-4000-8000-000000000002',true);
do $$declare answer text;begin
 select result into answer from public.kanonha_checkin_ticket(
 'a8324000-0000-4000-8000-000000000000',
 'a8322000-0000-4000-8000-000000000000');
 if answer<>'early' then raise exception 'Early check-in was not blocked: %',answer;end if;
end$$;

-- Advance the synthetic event clock ONLY inside the test transaction.
reset role;
update public.kanonha_events set starts_at=now()-interval '1 hour',
 registration_deadline=now()-interval '2 hours'
where id='a8322000-0000-4000-8000-000000000000';
set local role authenticated;
select set_config('request.jwt.claim.sub','a8320000-0000-4000-8000-000000000002',true);
do $$declare answer text; cert_count integer;begin
 select result into answer from public.kanonha_checkin_ticket(
 'a8324000-0000-4000-8000-000000000000',
 'a8322000-0000-4000-8000-000000000000');
 if answer<>'checked_in' then raise exception 'Expected checked_in: %',answer;end if;
 select count(*) into cert_count from public.kanonha_certificates
 where registration_id='a8323000-0000-4000-8000-000000000000';
 if cert_count<>1 then raise exception 'Certificate auto-issue failed: %',cert_count;end if;
end$$;

-- Manager: can read the immutable certificate.
select set_config('request.jwt.claim.sub','a8320000-0000-4000-8000-000000000003',true);
do $$declare cert_count integer;begin
 select count(*) into cert_count from public.kanonha_certificates
 where event_id='a8322000-0000-4000-8000-000000000000';
 if cert_count<>1 then raise exception 'Manager cannot view certificate';end if;
end$$;
reset role;
rollback;
