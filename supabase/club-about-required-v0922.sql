-- Standalone Kanonha project — require an about-club description.
-- Preserve existing legacy blank descriptions and logo-only updates.
begin;
create or replace function kanonha_private.require_club_about()
returns trigger language plpgsql security invoker set search_path='' as $fn$
begin
 if length(btrim(coalesce(new.description,'')))=0 then
  raise exception 'club_about_required' using errcode='23514';
 end if;
 return new;
end;
$fn$;
drop trigger if exists kanonha_club_about_required on public.kanonha_clubs;
create trigger kanonha_club_about_required
before insert or update of name,description,category on public.kanonha_clubs
for each row execute function kanonha_private.require_club_about();
commit;
