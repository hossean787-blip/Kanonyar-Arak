-- Kanonha: targeted in-app notification campaigns (FCM push requires separate Firebase setup).
-- Server-only publishing, immutable recipient snapshots, individual read receipts.
create table if not exists public.kanonha_notification_campaigns (
 id uuid primary key default gen_random_uuid(),
 request_key uuid not null unique,
 kind text not null check (kind in ('event','club','update','general')),
 title text not null check (char_length(btrim(title)) between 2 and 120),
 body text not null check (char_length(btrim(body)) between 2 and 1000),
 audience text not null check (audience in ('all','students','secretaries','university','faculties','club_members')),
 target_university text,
 target_faculties text[] not null default '{}'::text[],
 target_club_id uuid references public.kanonha_clubs(id),
 related_id uuid,
 version_label text,
 recipient_count integer not null default 0 check (recipient_count >= 0),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.kanonha_notification_deliveries (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.kanonha_notification_campaigns(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 read_at timestamptz,
 created_at timestamptz not null default now(),
 constraint kanonha_notification_one_delivery unique (campaign_id,user_id)
);
create index if not exists kanonha_notification_recipient_recent
 on public.kanonha_notification_deliveries(user_id,created_at desc);
create index if not exists kanonha_notification_campaign_recent
 on public.kanonha_notification_campaigns(created_at desc);
create index if not exists kanonha_notification_academic_lookup
 on public.kanonha_academic_details(university,faculty,user_id);
create index if not exists kanonha_notification_member_lookup
 on public.kanonha_memberships(club_id,status,user_id);
alter table public.kanonha_notification_campaigns enable row level security;
alter table public.kanonha_notification_deliveries enable row level security;
revoke all on public.kanonha_notification_campaigns from public,anon,authenticated;
revoke all on public.kanonha_notification_deliveries from public,anon,authenticated;
grant select on public.kanonha_notification_campaigns to authenticated;
grant select on public.kanonha_notification_deliveries to authenticated;
grant update(read_at) on public.kanonha_notification_deliveries to authenticated;
drop policy if exists kanonha_notifications_own on public.kanonha_notification_deliveries;
create policy kanonha_notifications_own on public.kanonha_notification_deliveries
 for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists kanonha_notifications_mark_read on public.kanonha_notification_deliveries;
create policy kanonha_notifications_mark_read on public.kanonha_notification_deliveries
 for update to authenticated using (user_id=(select auth.uid()))
 with check (user_id=(select auth.uid()));
drop policy if exists kanonha_notification_campaign_visible on public.kanonha_notification_campaigns;
create policy kanonha_notification_campaign_visible on public.kanonha_notification_campaigns
 for select to authenticated using (
  exists(select 1 from public.kanonha_notification_deliveries d
         where d.campaign_id=id and d.user_id=(select auth.uid()))
 );

-- Privileged helper is NOT in exposed public schema.
create schema if not exists kanonha_private;
revoke all on schema kanonha_private from public,anon,authenticated;
create or replace function kanonha_private.notification_recipient_ids(
 p_audience text, p_university text default null,
 p_faculties text[] default '{}'::text[], p_club_id uuid default null
) returns table(user_id uuid) language sql stable security definer
 set search_path='' as $$
 select u.id
 from auth.users u
 where u.deleted_at is null and (
  p_audience='all'
  or (p_audience='students' and exists (
     select 1 from public.kanonha_profiles p where p.user_id=u.id))
  or (p_audience='secretaries' and exists (
     select 1 from public.kanonha_secretaries s where s.user_id=u.id))
  or (p_audience='university' and exists (
     select 1 from public.kanonha_academic_details a
      where a.user_id=u.id and a.university=p_university))
  or (p_audience='faculties' and exists (
     select 1 from public.kanonha_academic_details a
      where a.user_id=u.id and a.university=p_university and a.faculty=any(p_faculties)))
  or (p_audience='club_members' and exists (
     select 1 from public.kanonha_memberships m where m.user_id=u.id
       and m.club_id=p_club_id and m.status='approved'))
 );
$$;
revoke all on function kanonha_private.notification_recipient_ids(text,text,text[],uuid) from public,anon,authenticated;
grant usage on schema kanonha_private to service_role;
grant execute on function kanonha_private.notification_recipient_ids(text,text,text[],uuid) to service_role;

create or replace function public.kanonha_notification_preview(
 p_audience text, p_university text default null,
 p_faculties text[] default '{}'::text[], p_club_id uuid default null
) returns integer language plpgsql stable security definer set search_path='' as $$
declare n integer;
begin
 if p_audience not in ('all','students','secretaries','university','faculties','club_members')
 or p_audience is null then raise exception 'bad_audience'; end if;
 if p_audience in ('university','faculties') and coalesce(length(btrim(p_university)),0)<2 then
  raise exception 'bad_university'; end if;
 if p_audience='faculties' and (coalesce(array_length(p_faculties,1),0)=0
   or array_length(p_faculties,1)>30) then raise exception 'bad_faculties'; end if;
 if p_audience='club_members' and p_club_id is null then raise exception 'bad_club'; end if;
 select count(*)::integer into n from kanonha_private.notification_recipient_ids(
   p_audience,p_university,p_faculties,p_club_id);
 return n;
end;
$$;
revoke all on function public.kanonha_notification_preview(text,text,text[],uuid) from public,anon,authenticated;
grant execute on function public.kanonha_notification_preview(text,text,text[],uuid) to service_role;

create or replace function public.kanonha_notification_publish(
 p_request_key uuid, p_kind text, p_title text, p_body text,
 p_audience text, p_actor uuid, p_university text default null,
 p_faculties text[] default '{}'::text[], p_club_id uuid default null,
 p_related_id uuid default null, p_version_label text default null
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare campaign uuid; n integer; duplicate_count integer; validated integer;
begin
 if p_request_key is null or p_actor is null or not exists(
  select 1 from public.kanonha_admins where user_id=p_actor
 ) then raise exception 'forbidden'; end if;
 select id,recipient_count into campaign,duplicate_count
 from public.kanonha_notification_campaigns where request_key=p_request_key;
 if found then return jsonb_build_object('id',campaign,'recipient_count',duplicate_count,'duplicate',true); end if;
 if p_kind is null or p_kind not in ('event','club','update','general')
   or char_length(btrim(coalesce(p_title,''))) not between 2 and 120
   or char_length(btrim(coalesce(p_body,''))) not between 2 and 1000 then
  raise exception 'bad_content'; end if;
 n:=public.kanonha_notification_preview(p_audience,p_university,p_faculties,p_club_id);
 if n=0 then raise exception 'no_recipients'; end if;
 if p_audience in ('university','faculties') then
  if not exists(select 1 from public.kanonha_universities where name=p_university)
    then raise exception 'unknown_university'; end if;
 end if;
 if p_audience='faculties' then
  select count(distinct f.name) into validated
  from public.kanonha_faculties f join public.kanonha_universities u on u.id=f.university_id
  where u.name=p_university and f.name=any(p_faculties);
  if validated<> (select count(distinct v) from unnest(p_faculties) v) then
    raise exception 'unknown_faculty'; end if;
 end if;
 if p_audience='club_members' and not exists(select 1 from public.kanonha_clubs
    where id=p_club_id and is_active=true) then raise exception 'unknown_club'; end if;
 if p_kind='event' and not exists(
  select 1 from public.kanonha_events where id=p_related_id
    and is_published=true and registration_deadline>now() and starts_at>now()
 ) then raise exception 'invalid_event'; end if;
 if p_kind='club' and not exists(
  select 1 from public.kanonha_clubs where id=p_related_id and is_active=true
 ) then raise exception 'invalid_club'; end if;
 if p_kind='update' and (char_length(btrim(coalesce(p_version_label,''))) not between 1 and 40)
  then raise exception 'bad_version'; end if;
 insert into public.kanonha_notification_campaigns
  (request_key,kind,title,body,audience,target_university,target_faculties,target_club_id,
   related_id,version_label,created_by)
 values(p_request_key,p_kind,btrim(p_title),btrim(p_body),p_audience,
   case when p_audience in ('university','faculties') then p_university else null end,
   case when p_audience='faculties' then p_faculties else '{}'::text[] end,
   case when p_audience='club_members' then p_club_id else null end,
   case when p_kind in ('event','club') then p_related_id else null end,
   case when p_kind='update' then p_version_label else null end,p_actor)
 on conflict (request_key) do nothing returning id into campaign;
 if campaign is null then
  select id,recipient_count into campaign,duplicate_count
   from public.kanonha_notification_campaigns where request_key=p_request_key;
  return jsonb_build_object('id',campaign,'recipient_count',duplicate_count,'duplicate',true);
 end if;
 insert into public.kanonha_notification_deliveries(campaign_id,user_id)
  select campaign,recipient.user_id from kanonha_private.notification_recipient_ids(
   p_audience,p_university,p_faculties,p_club_id) recipient
  on conflict(campaign_id,user_id) do nothing;
 get diagnostics n = row_count;
 update public.kanonha_notification_campaigns set recipient_count=n where id=campaign;
 return jsonb_build_object('id',campaign,'recipient_count',n,'duplicate',false);
end;
$$;
revoke all on function public.kanonha_notification_publish(
 uuid,text,text,text,text,uuid,text,text[],uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.kanonha_notification_publish(
 uuid,text,text,text,text,uuid,text,text[],uuid,uuid,text) to service_role;
