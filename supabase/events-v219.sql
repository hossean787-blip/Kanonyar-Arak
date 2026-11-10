-- Kanonha only. Events v0.9.19: approvals, posters, tickets, cancellations and scoped reports.
begin;
alter table public.kanonha_events
 add column if not exists approval_status text not null default 'pending'
 check (approval_status in ('pending','approved','rejected')),
 add column if not exists approved_at timestamptz,
 add column if not exists poster_path text;
alter table public.kanonha_registrations
 add column if not exists ticket_token uuid not null default gen_random_uuid();
create unique index if not exists kanonha_ticket_token_unique
 on public.kanonha_registrations(ticket_token);
create index if not exists kanonha_event_approval_index
 on public.kanonha_events (approval_status, starts_at);

-- Only privileged service-role admin console can approve or publish an event.
create or replace function kanonha_private.guard_event_approval()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if current_user <> 'service_role' then
  if tg_op='INSERT' then
   if new.is_published or new.approval_status <> 'pending' or new.approved_at is not null then
    raise exception 'Secretary events require manager approval';
   end if;
  else
   if new.approval_status is distinct from old.approval_status
     or new.approved_at is distinct from old.approved_at
     or (new.is_published and not old.is_published) then
    raise exception 'Only the manager can approve/publish an event';
   end if;
   if new.title is distinct from old.title or new.location is distinct from old.location
    or new.starts_at is distinct from old.starts_at
    or new.registration_deadline is distinct from old.registration_deadline
    or new.capacity is distinct from old.capacity
    or new.poster_path is distinct from old.poster_path then
    new.approval_status := 'pending';
    new.approved_at := null;
    new.is_published := false;
   end if;
  end if;
 end if;
 if new.is_published and new.approval_status <> 'approved' then
  raise exception 'Unapproved events cannot be published';
 end if;
 if new.poster_path is not null and
  new.poster_path <> new.club_id::text || '/' || new.id::text || '.webp' then
  raise exception 'Invalid event poster path';
 end if;
 return new;
end $$;
drop trigger if exists kanonha_event_approval_guard on public.kanonha_events;
create trigger kanonha_event_approval_guard
 before insert or update on public.kanonha_events
 for each row execute function kanonha_private.guard_event_approval();

-- Previously published events, if any, become pending until manager reviews.
update public.kanonha_events set is_published=false,approval_status='pending',approved_at=null
 where is_published=true and approval_status <> 'approved';

drop policy if exists kanonha_published_events_public on public.kanonha_events;
create policy kanonha_published_events_public on public.kanonha_events
 for select to anon,authenticated
 using (is_published and approval_status='approved');
drop policy if exists kanonha_manager_read_all_events on public.kanonha_events;
create policy kanonha_manager_read_all_events on public.kanonha_events
 for select to authenticated
 using (exists(select 1 from public.kanonha_admins a where a.user_id=(select auth.uid())));
grant select (approval_status,approved_at,poster_path) on public.kanonha_events to anon,authenticated;
grant update (poster_path) on public.kanonha_events to authenticated;
grant select (ticket_token) on public.kanonha_registrations to authenticated;

-- Student cancellations free capacity atomically in the same transaction.
grant delete on public.kanonha_registrations to authenticated;
drop policy if exists kanonha_student_cancel_event on public.kanonha_registrations;
create policy kanonha_student_cancel_event on public.kanonha_registrations
 for delete to authenticated
 using(user_id=(select auth.uid()) and status='confirmed' and attended_at is null
   and exists(select 1 from public.kanonha_events e
      where e.id=event_id and e.starts_at>now()));
create or replace function kanonha_private.release_event_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if old.status='confirmed' then
  update public.kanonha_events set registered_count=registered_count-1
   where id=old.event_id and registered_count>0;
  if not found then raise exception 'Invalid registration counter'; end if;
 end if;
 return old;
end $$;
revoke all on function kanonha_private.release_event_capacity() from public,anon,authenticated;
drop trigger if exists kanonha_release_event_capacity on public.kanonha_registrations;
create trigger kanonha_release_event_capacity after delete
 on public.kanonha_registrations for each row
 execute function kanonha_private.release_event_capacity();

-- Ticket is a random opaque UUID. Only designated secretaries / manager can verify it.
create or replace function public.kanonha_checkin_ticket(p_token uuid)
returns table(result text, attendee text, event_title text)
language plpgsql security definer set search_path = '' as $$
declare v record; v_actor uuid := (select auth.uid());
begin
 if v_actor is null then raise exception 'Unauthorized'; end if;
 select r.id,r.attended_at,r.status,e.club_id,e.starts_at,e.title,p.full_name
 into v from public.kanonha_registrations r
 join public.kanonha_events e on e.id=r.event_id
 left join public.kanonha_profiles p on p.user_id=r.user_id
 where r.ticket_token=p_token
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
revoke all on function public.kanonha_checkin_ticket(uuid) from public,anon;
grant execute on function public.kanonha_checkin_ticket(uuid) to authenticated;

create or replace function public.kanonha_event_summary(p_event_id uuid)
returns table(registrations bigint, attendees bigint, capacity integer)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=(select auth.uid()); v_club uuid; v_capacity integer;
begin
 if v_actor is null then raise exception 'Unauthorized'; end if;
 select e.club_id,e.capacity into v_club,v_capacity
  from public.kanonha_events e where e.id=p_event_id;
 if v_club is null then raise exception 'Unknown event'; end if;
 if not exists(select 1 from public.kanonha_secretaries s
    where s.club_id=v_club and s.user_id=v_actor)
 and not exists(select 1 from public.kanonha_admins a where a.user_id=v_actor)
 then raise exception 'Forbidden'; end if;
 return query select count(*)::bigint,
  count(*) filter(where r.attended_at is not null)::bigint,v_capacity
  from public.kanonha_registrations r where r.event_id=p_event_id and r.status='confirmed';
end $$;
revoke all on function public.kanonha_event_summary(uuid) from public,anon;
grant execute on function public.kanonha_event_summary(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('kanonha-event-posters','kanonha-event-posters',true,2097152,array['image/webp'])
 on conflict(id) do update set file_size_limit=excluded.file_size_limit,
 allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists kanonha_event_poster_read on storage.objects;
create policy kanonha_event_poster_read on storage.objects
 for select to authenticated using(bucket_id='kanonha-event-posters'
 and exists(select 1 from public.kanonha_events e
  where e.club_id::text=split_part(storage.objects.name,'/',1)
   and e.id::text=replace(split_part(storage.objects.name,'/',2),'.webp','')
   and (exists(select 1 from public.kanonha_secretaries s
    where s.club_id=e.club_id and s.user_id=(select auth.uid()))
     or exists(select 1 from public.kanonha_admins a where a.user_id=(select auth.uid())))));
drop policy if exists kanonha_event_poster_insert on storage.objects;
create policy kanonha_event_poster_insert on storage.objects
 for insert to authenticated with check(bucket_id='kanonha-event-posters'
 and storage.objects.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]webp$'
 and exists(select 1 from public.kanonha_events e
  where e.club_id::text=split_part(storage.objects.name,'/',1)
   and e.id::text=replace(split_part(storage.objects.name,'/',2),'.webp','')
   and (exists(select 1 from public.kanonha_secretaries s
    where s.club_id=e.club_id and s.user_id=(select auth.uid()))
     or exists(select 1 from public.kanonha_admins a where a.user_id=(select auth.uid())))));
drop policy if exists kanonha_event_poster_update on storage.objects;
create policy kanonha_event_poster_update on storage.objects
 for update to authenticated
 using(bucket_id='kanonha-event-posters' and exists(
 select 1 from public.kanonha_events e where e.club_id::text=split_part(storage.objects.name,'/',1)
 and e.id::text=replace(split_part(storage.objects.name,'/',2),'.webp','')
 and (exists(select 1 from public.kanonha_secretaries s where s.club_id=e.club_id and s.user_id=(select auth.uid()))
 or exists(select 1 from public.kanonha_admins a where a.user_id=(select auth.uid())))))
 with check(bucket_id='kanonha-event-posters'
 and storage.objects.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]webp$'
 and exists(select 1 from public.kanonha_events e where e.club_id::text=split_part(storage.objects.name,'/',1)
 and e.id::text=replace(split_part(storage.objects.name,'/',2),'.webp','')
 and (exists(select 1 from public.kanonha_secretaries s where s.club_id=e.club_id and s.user_id=(select auth.uid()))
 or exists(select 1 from public.kanonha_admins a where a.user_id=(select auth.uid())))));
commit;
