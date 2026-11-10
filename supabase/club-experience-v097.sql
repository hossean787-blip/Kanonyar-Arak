-- Kanonha v0.9.7: resolve membership RLS recursion and enable club experience.
-- Apply ONLY to dedicated Kanonha Supabase project, after v0.9.3 and secretary migrations.
begin;
alter policy "kanonha_own_memberships_request" on public.kanonha_memberships
 with check (
  (select auth.uid())=user_id and status='pending'
  and exists(select 1 from public.kanonha_clubs c where c.id=club_id and c.is_active)
 );
do $$ begin
 if not exists(select 1 from pg_constraint where conname='kanonha_membership_student_profile_fk') then
  alter table public.kanonha_memberships add constraint kanonha_membership_student_profile_fk
   foreign key(user_id) references public.kanonha_profiles(user_id) on delete cascade;
 end if;
end $$;
alter table public.kanonha_clubs
 add column if not exists university text not null default '',
 add column if not exists faculty text not null default '',
 add column if not exists logo_path text not null default '';
do $$ begin
 if not exists(select 1 from pg_constraint where conname='kanonha_club_scope_valid') then
  alter table public.kanonha_clubs add constraint kanonha_club_scope_valid
   check(length(university)<=120 and length(faculty)<=120 and (faculty='' or university<>''));
 end if;
 if not exists(select 1 from pg_constraint where conname='kanonha_club_logo_valid') then
  alter table public.kanonha_clubs add constraint kanonha_club_logo_valid
   check(logo_path='' or logo_path=id::text||'/logo.webp');
 end if;
end $$;
grant select(university,faculty,logo_path) on public.kanonha_clubs to anon,authenticated;
grant update(logo_path) on public.kanonha_clubs to authenticated;
grant delete on public.kanonha_memberships to authenticated;
drop policy if exists kanonha_member_cancel_or_leave on public.kanonha_memberships;
create policy kanonha_member_cancel_or_leave on public.kanonha_memberships
 for delete to authenticated using ((select auth.uid())=user_id and status in ('pending','approved'));
drop policy if exists kanonha_member_reapply on public.kanonha_memberships;
create policy kanonha_member_reapply on public.kanonha_memberships
 for update to authenticated using ((select auth.uid())=user_id and status='rejected')
 with check ((select auth.uid())=user_id and status='pending'
 and exists(select 1 from public.kanonha_clubs c where c.id=club_id and c.is_active));
create or replace function kanonha_private.audit_membership_decision()
returns trigger language plpgsql security invoker set search_path='' as $fn$
begin
 if new.user_id is distinct from old.user_id or new.club_id is distinct from old.club_id then
  raise exception 'Membership ownership cannot change';
 end if;
 if old.status='rejected' and new.status='pending' and old.user_id=auth.uid() then
  new.requested_at:=now();new.decided_by:=null;new.decided_at:=null;return new;
 end if;
 if old.status='pending' and new.status in ('approved','rejected')
   and exists(select 1 from public.kanonha_secretaries s
     where s.user_id=auth.uid() and s.club_id=old.club_id) then
  new.decided_by:=auth.uid();new.decided_at:=now();return new;
 end if;
 raise exception 'Invalid membership state transition or unauthorized secretary';
end;
$fn$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('kanonha-club-logos','kanonha-club-logos',true,2097152,array['image/webp'])
 on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,
 allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists kanonha_secretary_logo_insert on storage.objects;
create policy kanonha_secretary_logo_insert on storage.objects for insert to authenticated
 with check(bucket_id='kanonha-club-logos' and name ~ '^[0-9a-f-]{36}/logo[.]webp$'
 and exists(select 1 from public.kanonha_secretaries s
 join public.kanonha_clubs c on c.id=s.club_id where s.user_id=(select auth.uid())
 and c.is_active and s.club_id::text=split_part(name,'/',1)));
drop policy if exists kanonha_secretary_logo_select on storage.objects;
create policy kanonha_secretary_logo_select on storage.objects for select to authenticated
 using(bucket_id='kanonha-club-logos'
 and exists(select 1 from public.kanonha_secretaries s
 where s.user_id=(select auth.uid()) and s.club_id::text=split_part(name,'/',1)));
drop policy if exists kanonha_secretary_logo_update on storage.objects;
create policy kanonha_secretary_logo_update on storage.objects for update to authenticated
 using(bucket_id='kanonha-club-logos' and name ~ '^[0-9a-f-]{36}/logo[.]webp$'
 and exists(select 1 from public.kanonha_secretaries s
 join public.kanonha_clubs c on c.id=s.club_id where s.user_id=(select auth.uid())
 and c.is_active and s.club_id::text=split_part(name,'/',1)))
 with check(bucket_id='kanonha-club-logos' and name ~ '^[0-9a-f-]{36}/logo[.]webp$'
 and exists(select 1 from public.kanonha_secretaries s
 join public.kanonha_clubs c on c.id=s.club_id where s.user_id=(select auth.uid())
 and c.is_active and s.club_id::text=split_part(name,'/',1)));
commit;
