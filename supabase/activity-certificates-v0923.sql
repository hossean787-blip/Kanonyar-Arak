-- Kanonha activity v0.9.23. Run only on the dedicated Kanonha project.
-- Registered event history and permanent issued certificates are independent
-- from short-lived ticket availability. All privileged operations are server-checked.
begin;

-- Event registrations are immutable for students. Club membership cancellation remains allowed.
drop policy if exists kanonha_student_cancel_event on public.kanonha_registrations;
revoke delete on public.kanonha_registrations from authenticated;
-- Ticket tokens must never be fetched indefinitely through the raw Data API.
revoke select (ticket_token) on public.kanonha_registrations from authenticated;

create table if not exists public.kanonha_certificates (
 id uuid primary key default gen_random_uuid(),
 registration_id uuid not null unique references public.kanonha_registrations(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete cascade,
 event_id uuid not null references public.kanonha_events(id) on delete restrict,
 student_name text not null,
 student_number text not null,
 event_title text not null,
 club_name text not null,
 event_starts_at timestamptz not null,
 event_location text not null default '',
 issued_by uuid not null,
 issued_at timestamptz not null default now(),
 certificate_code uuid not null unique default gen_random_uuid()
);
create index if not exists kanonha_certificates_user_issued
 on public.kanonha_certificates(user_id,issued_at desc);
create index if not exists kanonha_certificates_event
 on public.kanonha_certificates(event_id);
alter table public.kanonha_certificates enable row level security;
revoke all on public.kanonha_certificates from public,anon,authenticated;
grant select (id,registration_id,user_id,event_id,student_name,student_number,
 event_title,club_name,event_starts_at,event_location,issued_by,issued_at,certificate_code)
 on public.kanonha_certificates to authenticated;
drop policy if exists kanonha_certificate_owner_read on public.kanonha_certificates;
create policy kanonha_certificate_owner_read on public.kanonha_certificates
 for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists kanonha_certificate_assigned_staff_read on public.kanonha_certificates;
create policy kanonha_certificate_assigned_staff_read on public.kanonha_certificates
 for select to authenticated using (
   exists(select 1 from public.kanonha_events e
     join public.kanonha_secretaries s on s.club_id=e.club_id
     where e.id=event_id and s.user_id=(select auth.uid()))
   or exists(select 1 from public.kanonha_admins a where a.user_id=(select auth.uid()))
 );

-- Only the owner of a registration can fetch its history. Tokens are NULL
-- once the seventh 24-hour period after the event start has elapsed.
create or replace function public.kanonha_my_event_history()
returns table(
 registration_id uuid,event_id uuid,event_title text,event_starts_at timestamptz,
 event_location text,club_name text,status text,attended_at timestamptz,
 ticket_expires_at timestamptz,ticket_token uuid)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid());
begin
 if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 return query
 select r.id,r.event_id,e.title,e.starts_at,e.location,c.name,r.status,r.attended_at,
        e.starts_at+interval '7 days',
        case when now()<e.starts_at+interval '7 days' then r.ticket_token else null::uuid end
 from public.kanonha_registrations r
 join public.kanonha_events e on e.id=r.event_id
 join public.kanonha_clubs c on c.id=e.club_id
 where r.user_id=v_actor and r.status='confirmed'
 order by e.starts_at desc,r.id;
end $$;
revoke all on function public.kanonha_my_event_history() from public,anon,authenticated;
grant execute on function public.kanonha_my_event_history() to authenticated;

-- Idempotent issuance: only an assigned secretary or manager, for a student
-- with attendance actually recorded after the event began. No client can invent
-- a certificate, edit or delete the stored snapshot.
create or replace function public.kanonha_issue_certificate(p_registration_id uuid)
returns table(id uuid,certificate_code uuid,issued_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v record;
begin
 if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select r.id as rid,r.user_id,r.event_id,r.status,r.attended_at,
        e.club_id,e.title,e.starts_at,e.location,c.name as club_name,
        p.full_name,p.student_number
   into v from public.kanonha_registrations r
   join public.kanonha_events e on e.id=r.event_id
   join public.kanonha_clubs c on c.id=e.club_id
   join public.kanonha_profiles p on p.user_id=r.user_id
   where r.id=p_registration_id for update of r;
 if not found then raise exception 'Registration not found' using errcode='P0002'; end if;
 if not exists(select 1 from public.kanonha_secretaries s where s.user_id=v_actor and s.club_id=v.club_id)
    and not exists(select 1 from public.kanonha_admins a where a.user_id=v_actor)
 then raise exception 'Not authorized to issue certificate' using errcode='42501'; end if;
 if v.status<>'confirmed' or v.attended_at is null or v.starts_at>now()
 then raise exception 'Attendance is required before certificate issuance' using errcode='22023'; end if;
 insert into public.kanonha_certificates
 (registration_id,user_id,event_id,student_name,student_number,event_title,
  club_name,event_starts_at,event_location,issued_by)
 values(v.rid,v.user_id,v.event_id,v.full_name,v.student_number,v.title,
        v.club_name,v.starts_at,v.location,v_actor)
 on conflict (registration_id) do nothing;
 return query select c.id,c.certificate_code,c.issued_at
 from public.kanonha_certificates c where c.registration_id=p_registration_id;
end $$;
revoke all on function public.kanonha_issue_certificate(uuid) from public,anon,authenticated;
grant execute on function public.kanonha_issue_certificate(uuid) to authenticated;
commit;
