-- Safe extension of v210: reversible pause/resume and attendance-aware audit.
begin;
alter table public.kanonha_surveys drop constraint if exists kanonha_surveys_status_check;
alter table public.kanonha_surveys add constraint kanonha_surveys_status_check
 check(status in ('draft','published','paused','cancelled','archived'));
alter table public.kanonha_surveys drop constraint if exists kanonha_surveys_no_early_approval;
alter table public.kanonha_surveys add constraint kanonha_surveys_no_early_approval
 check(status in ('published','paused','archived') or not results_approved);
alter table public.kanonha_survey_audit drop constraint if exists kanonha_survey_audit_action_check;
alter table public.kanonha_survey_audit add constraint kanonha_survey_audit_action_check
 check(action in('created','edited','published','approved','unapproved',
 'cancelled','archived','deleted','duplicated','paused','resumed'));

create or replace function public.kanonha_survey_validate()
returns trigger language plpgsql set search_path='' as $body$
begin
 if tg_op='UPDATE' then
   if old.status in ('published','paused') then
     if (to_jsonb(new)-'results_approved'-'updated_at'-'status') is distinct from
        (to_jsonb(old)-'results_approved'-'updated_at'-'status') then
       raise exception 'published_survey_is_locked' using errcode='23514';
     end if;
     if new.status not in ('published','paused','cancelled','archived') then
       raise exception 'invalid_survey_transition' using errcode='23514';end if;
     if new.status='published' and old.status='paused' and clock_timestamp()>=old.ends_at then
       raise exception 'cannot_resume_expired_survey' using errcode='23514';end if;
     if new.status='archived' and clock_timestamp()<old.ends_at then
       raise exception 'archive_requires_finished_survey' using errcode='23514';end if;
     if new.results_approved is distinct from old.results_approved then
       if old.kind<>'competition' or clock_timestamp()<old.ends_at
          or new.status='cancelled' then
         raise exception 'results_approval_not_allowed' using errcode='23514';end if;
     end if;
   elsif old.status in ('cancelled','archived') then
     raise exception 'final_survey_is_locked' using errcode='23514';
   elsif old.status='draft' then
     if new.status not in ('draft','published') or new.results_approved then
       raise exception 'invalid_draft_transition' using errcode='23514';end if;
     if new.created_by is distinct from old.created_by or
        new.published_at is distinct from old.published_at then
       raise exception 'immutable_survey_metadata' using errcode='23514';end if;
     if new.status='published' then
       if new.ends_at<=clock_timestamp() or new.starts_at>=new.ends_at then
         raise exception 'survey_deadline_invalid' using errcode='23514';end if;
       if (select count(*) from public.kanonha_survey_options o where o.survey_id=new.id)<2 then
         raise exception 'survey_requires_two_options' using errcode='23514';end if;
       new.published_at=now();
     end if;
   end if;
   if new.audience_faculty_id is not null and
      not exists(select 1 from public.kanonha_faculties f
        where f.id=new.audience_faculty_id and f.university_id=new.audience_university_id)
   then raise exception 'audience_faculty_university_mismatch' using errcode='23514';end if;
   new.updated_at=now();
 end if;
 return new;
end $body$;
revoke all on function public.kanonha_survey_validate() from public,anon,authenticated;

create or replace function public.kanonha_survey_audit_trg()
returns trigger language plpgsql security definer set search_path='' as $body$
declare v_action text;
begin
 if tg_op='INSERT' then v_action='created';
 elsif tg_op='DELETE' then v_action='deleted';
 elsif new.status is distinct from old.status then
  v_action=case new.status when 'published' then
      case when old.status='paused' then 'resumed' else 'published' end
     when 'paused' then 'paused' when 'cancelled' then 'cancelled'
     when 'archived' then 'archived' else 'edited' end;
 elsif new.results_approved is distinct from old.results_approved then
  v_action=case when new.results_approved then 'approved' else 'unapproved' end;
 else v_action='edited';
 end if;
 insert into public.kanonha_survey_audit(survey_id,actor_id,action,info)
 values(case when tg_op='DELETE' then old.id else new.id end,
  (select auth.uid()),v_action,jsonb_build_object('kind',
    case when tg_op='DELETE' then old.kind else new.kind end));
 return case when tg_op='DELETE' then old else new end;
end $body$;
revoke all on function public.kanonha_survey_audit_trg() from public,anon,authenticated;

drop policy if exists kanonha_surveys_read on public.kanonha_surveys;
create policy kanonha_surveys_read on public.kanonha_surveys
 for select to anon,authenticated using(
  exists(select 1 from public.kanonha_admins adm where adm.user_id=(select auth.uid()))
  or (status in ('published','paused','archived')
   and (audience_university_id is null or exists(
    select 1 from public.kanonha_academic_details d
     join public.kanonha_universities u on u.id=audience_university_id
    where d.user_id=(select auth.uid()) and lower(btrim(d.university))=lower(btrim(u.name))))
   and (audience_faculty_id is null or exists(
    select 1 from public.kanonha_academic_details d
     join public.kanonha_faculties f on f.id=audience_faculty_id
    where d.user_id=(select auth.uid()) and lower(btrim(d.faculty))=lower(btrim(f.name))))
  )
 );
create or replace function public.kanonha_survey_results(p_survey_id uuid)
returns table(option_id uuid,rating_count bigint,rating_sum bigint)
language sql stable security definer set search_path='' as $body$
 select o.id,count(v.id)::bigint,coalesce(sum(v.stars),0)::bigint
 from public.kanonha_survey_options o
 join public.kanonha_surveys s on s.id=o.survey_id
 left join public.kanonha_survey_votes v on v.option_id=o.id and v.survey_id=s.id
 where s.id=p_survey_id and (select auth.uid()) is not null
 and (exists(select 1 from public.kanonha_admins a where a.user_id=(select auth.uid()))
  or (s.status in ('published','paused','archived')
    and (s.kind='regular' or
         (s.kind='competition' and clock_timestamp()>=s.ends_at and s.results_approved))
    and (s.audience_university_id is null or exists (
      select 1 from public.kanonha_academic_details d
        join public.kanonha_universities u on u.id=s.audience_university_id
      where d.user_id=(select auth.uid())
        and lower(btrim(d.university))=lower(btrim(u.name))))
    and (s.audience_faculty_id is null or exists (
      select 1 from public.kanonha_academic_details d
        join public.kanonha_faculties f on f.id=s.audience_faculty_id
      where d.user_id=(select auth.uid())
        and lower(btrim(d.faculty))=lower(btrim(f.name))))
  ))
 group by o.id,o.sort_order order by o.sort_order,o.id
$body$;
revoke all on function public.kanonha_survey_results(uuid) from public,anon,authenticated;
grant execute on function public.kanonha_survey_results(uuid) to authenticated;
commit;