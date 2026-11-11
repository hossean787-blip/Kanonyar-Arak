-- Kanonha standalone: one approved certificate design across all event kinds.
-- Apply after events-v220-secretary-autonomy and activity-certificates-v0923.
begin;

alter table public.kanonha_events
 add column if not exists event_type text not null default 'general',
 add column if not exists certificate_signers jsonb not null default '[]'::jsonb;

do $$
begin
 if not exists(select 1 from pg_constraint where conname='kanonha_event_type_allowed') then
  alter table public.kanonha_events add constraint kanonha_event_type_allowed
   check(event_type in ('workshop','course','conference','session','competition',
                       'festival','volunteer','collaboration','general'));
 end if;
 if not exists(select 1 from pg_constraint where conname='kanonha_event_signers_array') then
  alter table public.kanonha_events add constraint kanonha_event_signers_array
   check(jsonb_typeof(certificate_signers)='array' and jsonb_array_length(certificate_signers)<=60);
 end if;
end $$;
grant select(event_type,certificate_signers) on public.kanonha_events to anon,authenticated;
grant insert(event_type,certificate_signers) on public.kanonha_events to authenticated;
grant update(event_type,certificate_signers) on public.kanonha_events to authenticated;

alter table public.kanonha_certificates
 add column if not exists event_type text not null default 'general',
 add column if not exists certificate_signers jsonb not null default '[]'::jsonb,
 add column if not exists club_id uuid references public.kanonha_clubs(id) on delete restrict,
 add column if not exists club_logo_path text not null default '',
 add column if not exists secretary_name text not null default '',
 add column if not exists student_national_id text;

-- Backfill immutable snapshots for historical certificates with available trusted fields.
update public.kanonha_certificates cert set
 event_type=e.event_type,
 certificate_signers=e.certificate_signers,
 club_id=e.club_id,
 club_logo_path=coalesce(c.logo_path,''),
 secretary_name=coalesce((
   select p.full_name from public.kanonha_secretaries s
    join public.kanonha_profiles p on p.user_id=s.user_id
    where s.club_id=e.club_id order by s.appointed_at desc limit 1
 ),'')
 from public.kanonha_events e
 join public.kanonha_clubs c on c.id=e.club_id
 where cert.event_id=e.id;
-- National IDs were not collected by prior releases. Never invent or substitute student numbers.
grant select(event_type,certificate_signers,club_id,club_logo_path,secretary_name,student_national_id)
 on public.kanonha_certificates to authenticated;

-- Attendance remains the sole server-authorized automatic issuance event.
create or replace function kanonha_private.issue_certificate_on_attendance()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());
begin
 if old.attended_at is null and new.attended_at is not null
    and new.status='confirmed' and v_actor is not null then
  insert into public.kanonha_certificates
   (registration_id,user_id,event_id,student_name,student_number,event_title,
    event_type,certificate_signers,club_id,club_name,club_logo_path,secretary_name,
    event_starts_at,event_location,issued_by)
  select new.id,new.user_id,new.event_id,p.full_name,p.student_number,e.title,
    e.event_type,e.certificate_signers,e.club_id,c.name,coalesce(c.logo_path,''),
    coalesce((select prof.full_name from public.kanonha_secretaries sec
      join public.kanonha_profiles prof on prof.user_id=sec.user_id
      where sec.club_id=e.club_id order by sec.appointed_at desc limit 1),''),
    e.starts_at,e.location,v_actor
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

-- Preserve idempotency and all existing authorization conditions on explicit issuance.
create or replace function public.kanonha_issue_certificate(p_registration_id uuid)
returns table(id uuid,certificate_code uuid,issued_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v record;
begin
 if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select r.id as rid,r.user_id,r.event_id,r.status,r.attended_at,
        e.club_id,e.title,e.event_type,e.certificate_signers,e.starts_at,e.location,
        c.name as club_name,c.logo_path as club_logo_path,
        p.full_name,p.student_number,
        coalesce((select prof.full_name from public.kanonha_secretaries sec
            join public.kanonha_profiles prof on prof.user_id=sec.user_id
            where sec.club_id=e.club_id order by sec.appointed_at desc limit 1),'') as secretary_name
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
 (registration_id,user_id,event_id,student_name,student_number,event_title,event_type,
  certificate_signers,club_id,club_name,club_logo_path,secretary_name,
  event_starts_at,event_location,issued_by)
 values(v.rid,v.user_id,v.event_id,v.full_name,v.student_number,v.title,v.event_type,
        v.certificate_signers,v.club_id,v.club_name,coalesce(v.club_logo_path,''),v.secretary_name,
        v.starts_at,v.location,v_actor)
 on conflict (registration_id) do nothing;
 return query select c.id,c.certificate_code,c.issued_at
 from public.kanonha_certificates c where c.registration_id=p_registration_id;
end $$;
revoke all on function public.kanonha_issue_certificate(uuid) from public,anon,authenticated;
grant execute on function public.kanonha_issue_certificate(uuid) to authenticated;
commit;