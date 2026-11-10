-- Kanonha: assigned secretaries may set their club's university and faculty.
-- No other fields (roles, active state, IDs) gain additional privileges.
-- Repeatable and aligned with the existing secretary_can_update_assigned_club RLS policy.

grant update (university, faculty) on public.kanonha_clubs to authenticated;

create or replace function kanonha_private.validate_club_academic_choice()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  if btrim(new.university) = '' or not exists (
    select 1 from public.kanonha_universities u where u.name = new.university
  ) then
    raise exception 'University must be chosen from the academic catalog' using errcode = '23514';
  end if;
  if btrim(new.faculty) <> '' and not exists (
    select 1
      from public.kanonha_universities u
      join public.kanonha_faculties f on f.university_id = u.id
     where u.name = new.university and f.name = new.faculty
  ) then
    raise exception 'Faculty does not belong to the selected university' using errcode = '23514';
  end if;
  -- Managers may retain "all faculties". Secretaries must choose one faculty.
  if (select auth.uid()) is not null
     and exists (
       select 1 from public.kanonha_secretaries s
        where s.user_id = (select auth.uid()) and s.club_id = new.id
     )
     and btrim(new.faculty) = '' then
    raise exception 'Secretary must select a faculty' using errcode = '23514';
  end if;
  return new;
end;
$fn$;

drop trigger if exists kanonha_club_academic_choice on public.kanonha_clubs;
create trigger kanonha_club_academic_choice
before update of university, faculty on public.kanonha_clubs
for each row execute function kanonha_private.validate_club_academic_choice();
