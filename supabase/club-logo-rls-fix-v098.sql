-- Kanonha dedicated project only. Hotfix v0.9.8
-- Fix storage.objects RLS: unqualified "name" was bound to kanonha_clubs.name
-- in the join, blocking legitimate secretary logo uploads.
-- Non-destructive, idempotent policy replacement; does not touch stored files.
begin;
alter policy kanonha_secretary_logo_insert on storage.objects
with check (
 bucket_id='kanonha-club-logos'
 and storage.objects.name ~ '^[0-9a-f-]{36}/logo[.]webp$'
 and exists (
  select 1 from public.kanonha_secretaries s
  join public.kanonha_clubs c on c.id=s.club_id
  where s.user_id=(select auth.uid()) and c.is_active
   and s.club_id::text=split_part(storage.objects.name,'/',1)
 )
);
alter policy kanonha_secretary_logo_update on storage.objects
using (
 bucket_id='kanonha-club-logos'
 and storage.objects.name ~ '^[0-9a-f-]{36}/logo[.]webp$'
 and exists (
  select 1 from public.kanonha_secretaries s
  join public.kanonha_clubs c on c.id=s.club_id
  where s.user_id=(select auth.uid()) and c.is_active
   and s.club_id::text=split_part(storage.objects.name,'/',1)
 )
)
with check (
 bucket_id='kanonha-club-logos'
 and storage.objects.name ~ '^[0-9a-f-]{36}/logo[.]webp$'
 and exists (
  select 1 from public.kanonha_secretaries s
  join public.kanonha_clubs c on c.id=s.club_id
  where s.user_id=(select auth.uid()) and c.is_active
   and s.club_id::text=split_part(storage.objects.name,'/',1)
 )
);
commit;
