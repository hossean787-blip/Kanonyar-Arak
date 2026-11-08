-- v0.8.0: atomic student-profile linkage to an already-verified director account.
-- Only service_role (via JWT-verified director Edge function) can execute.
-- No second Auth user is created. The synthetic alias reserves student/national IDs
-- but deliberately cannot log in: directors MUST authenticate via their email.
create or replace function public.kanonha_manager_attach_student(
  p_user_id uuid,
  p_full_name text,
  p_student_number text,
  p_national_digest text,
  p_birth_date date,
  p_university text,
  p_faculty text,
  p_major text,
  p_mobile text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
begin
  if not exists (select 1 from public.kanonha_admins a where a.user_id = p_user_id) then
    raise exception 'Not a verified director' using errcode = '42501';
  end if;
  if exists (select 1 from public.kanonha_profiles p where p.user_id = p_user_id)
    or exists (select 1 from public.kanonha_student_credentials c where c.user_id = p_user_id) then
    raise exception 'Student identity already linked' using errcode = '23505';
  end if;
  if char_length(btrim(p_full_name)) not between 2 and 80
    or p_student_number !~ '^[0-9]{6,20}$'
    or p_national_digest !~ '^[a-f0-9]{64}$'
    or p_birth_date >= current_date or p_birth_date < date '1920-01-01'
    or p_mobile !~ '^09[0-9]{9}$'
    or char_length(btrim(p_university)) not between 2 and 120
    or char_length(btrim(p_faculty)) not between 2 and 120
    or char_length(btrim(p_major)) not between 2 and 120 then
    raise exception 'Invalid student identity details' using errcode = '22023';
  end if;
  insert into public.kanonha_student_credentials
    (user_id, student_number, national_digest, internal_email)
  values (p_user_id, p_student_number, p_national_digest,
    'director-identity-' || p_user_id::text || '@student.kanonha.invalid');
  insert into public.kanonha_profiles (user_id,full_name,student_number)
    values (p_user_id,btrim(p_full_name),p_student_number);
  insert into public.kanonha_academic_details
    (user_id,birth_date,university,faculty,major,mobile)
    values (p_user_id,p_birth_date,btrim(p_university),btrim(p_faculty),btrim(p_major),p_mobile);
  return jsonb_build_object('linked',true,'user_id',p_user_id);
end;
$$;
revoke all on function public.kanonha_manager_attach_student(
  uuid,text,text,text,date,text,text,text,text
) from public, anon, authenticated;
grant execute on function public.kanonha_manager_attach_student(
  uuid,text,text,text,date,text,text,text,text
) to service_role;
