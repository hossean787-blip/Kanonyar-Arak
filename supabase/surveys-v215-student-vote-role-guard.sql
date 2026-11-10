-- Survey authorization hardening: only global managers create/edit; only students vote.
-- A manager who also has a student profile is never an eligible voter.
-- The vote insert policy matches the existing student survey-read audience restrictions.
begin;
drop policy if exists kanonha_survey_votes_student_insert on public.kanonha_survey_votes;
create policy kanonha_survey_votes_student_insert on public.kanonha_survey_votes
 for insert to authenticated
 with check (
   user_id=(select auth.uid())
   and exists (
     select 1 from public.kanonha_profiles student
     where student.user_id=(select auth.uid())
   )
   and not exists (
     select 1 from public.kanonha_admins manager
     where manager.user_id=(select auth.uid())
   )
   and exists (
     select 1 from public.kanonha_surveys s
     where s.id=kanonha_survey_votes.survey_id
       and s.status='published'
       and (
         s.kind='regular'
         or (
           s.kind='competition'
           and clock_timestamp()>=s.starts_at
           and clock_timestamp()<s.ends_at
         )
       )
       and (
         s.audience_university_id is null
         or exists (
           select 1 from public.kanonha_academic_details d
           join public.kanonha_universities u
             on u.id=s.audience_university_id
           where d.user_id=(select auth.uid())
             and lower(btrim(d.university))=lower(btrim(u.name))
         )
       )
       and (
         s.audience_faculty_id is null
         or exists (
           select 1 from public.kanonha_academic_details d
           join public.kanonha_faculties f
             on f.id=s.audience_faculty_id
           where d.user_id=(select auth.uid())
             and lower(btrim(d.faculty))=lower(btrim(f.name))
         )
       )
       and exists (
         select 1 from public.kanonha_survey_options o
         where o.id=kanonha_survey_votes.option_id
           and o.survey_id=s.id
       )
   )
 );
commit;
