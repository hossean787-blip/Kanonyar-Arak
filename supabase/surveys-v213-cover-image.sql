
-- Kanonha survey cover images. Manager-owned optional WebP covers; unrelated projects untouched.
begin;
alter table public.kanonha_surveys
 add column if not exists cover_path text;
alter table public.kanonha_surveys
 drop constraint if exists kanonha_surveys_cover_path_check;
alter table public.kanonha_surveys
 add constraint kanonha_surveys_cover_path_check
 check(cover_path is null or cover_path=id::text||'/cover.webp');
grant select(cover_path) on public.kanonha_surveys to anon,authenticated;
grant update(cover_path) on public.kanonha_surveys to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kanonha-survey-covers','kanonha-survey-covers',true,2097152,array['image/webp']::text[])
on conflict (id) do update
set public=excluded.public,file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists kanonha_survey_cover_insert on storage.objects;
create policy kanonha_survey_cover_insert on storage.objects
 for insert to authenticated with check (
 bucket_id='kanonha-survey-covers'
 and storage.objects.name ~ '^[0-9a-f-]{36}/cover[.]webp$'
 and exists(select 1 from public.kanonha_surveys s
  join public.kanonha_admins a on a.user_id=(select auth.uid())
  where s.id::text=split_part(storage.objects.name,'/',1) and s.status='draft')
 );
drop policy if exists kanonha_survey_cover_select on storage.objects;
create policy kanonha_survey_cover_select on storage.objects
 for select to authenticated using (
 bucket_id='kanonha-survey-covers'
 and storage.objects.name ~ '^[0-9a-f-]{36}/cover[.]webp$'
 and exists(select 1 from public.kanonha_surveys s
  join public.kanonha_admins a on a.user_id=(select auth.uid())
  where s.id::text=split_part(storage.objects.name,'/',1) and s.status='draft')
 );
drop policy if exists kanonha_survey_cover_update on storage.objects;
create policy kanonha_survey_cover_update on storage.objects
 for update to authenticated
 using (
 bucket_id='kanonha-survey-covers'
 and storage.objects.name ~ '^[0-9a-f-]{36}/cover[.]webp$'
 and exists(select 1 from public.kanonha_surveys s
  join public.kanonha_admins a on a.user_id=(select auth.uid())
  where s.id::text=split_part(storage.objects.name,'/',1) and s.status='draft')
 )
 with check (
 bucket_id='kanonha-survey-covers'
 and storage.objects.name ~ '^[0-9a-f-]{36}/cover[.]webp$'
 and exists(select 1 from public.kanonha_surveys s
  join public.kanonha_admins a on a.user_id=(select auth.uid())
  where s.id::text=split_part(storage.objects.name,'/',1) and s.status='draft')
 );
drop policy if exists kanonha_survey_cover_delete on storage.objects;
create policy kanonha_survey_cover_delete on storage.objects
 for delete to authenticated using (
 bucket_id='kanonha-survey-covers'
 and storage.objects.name ~ '^[0-9a-f-]{36}/cover[.]webp$'
 and exists(select 1 from public.kanonha_surveys s
  join public.kanonha_admins a on a.user_id=(select auth.uid())
  where s.id::text=split_part(storage.objects.name,'/',1) and s.status='draft')
 );
commit;
