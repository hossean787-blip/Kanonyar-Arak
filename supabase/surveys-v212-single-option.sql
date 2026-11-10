-- Survey v2.1.2: allow one real catalog option for independent 1-to-5-star evaluations.
-- Preserves existing admin authorization, audit, audience, voting, privacy and uniqueness rules.
-- Apply after surveys-v211-pausing.sql. No user data is modified.
begin;
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
       if (select count(*) from public.kanonha_survey_options o where o.survey_id=new.id)<1 then
         raise exception 'survey_requires_at_least_one_option' using errcode='23514';end if;
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

create or replace function public.kanonha_survey_save(
 p_survey_id uuid,p_title text,p_description text,p_category text,p_kind text,
 p_starts_at timestamptz,p_ends_at timestamptz,p_min_rank_votes integer,
 p_university_id uuid,p_faculty_id uuid,p_sources uuid[]
) returns uuid language plpgsql security definer set search_path='' as $body$
declare v_id uuid;v_source uuid;v_index integer:=0;v_count integer;
declare v_title text;v_description text;
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.kanonha_admins a where a.user_id=(select auth.uid())) then
  raise exception 'manager_only' using errcode='42501';
 end if;
 v_title=btrim(coalesce(p_title,''));
 v_description=btrim(coalesce(p_description,''));
 v_count=coalesce(array_length(p_sources,1),0);
 if char_length(v_title) not between 4 and 120 or
    char_length(v_description)>500 or
    p_category not in('club','faculty','professor') or
    p_kind not in('regular','competition') or
    p_starts_at is null or p_ends_at is null or
    p_starts_at>=p_ends_at or p_ends_at<=clock_timestamp() or
    p_min_rank_votes not between 1 and 100 or v_count not between 1 and 12 or
    (select count(distinct v) from unnest(p_sources) v)<>v_count then
    raise exception 'invalid_survey_form' using errcode='23514';
 end if;
 if p_faculty_id is not null and not exists (
  select 1 from public.kanonha_faculties f where f.id=p_faculty_id
    and f.university_id=p_university_id) then
    raise exception 'audience_mismatch' using errcode='23514';
 end if;
 if p_university_id is not null and not exists(
  select 1 from public.kanonha_universities u where u.id=p_university_id) then
    raise exception 'university_unknown' using errcode='23514';
 end if;
 if p_survey_id is null then
  insert into public.kanonha_surveys
   (title,description,category,kind,starts_at,ends_at,min_rank_votes,
    audience_university_id,audience_faculty_id,created_by)
  values(v_title,v_description,p_category,p_kind,p_starts_at,p_ends_at,p_min_rank_votes,
    p_university_id,p_faculty_id,(select auth.uid()))
  returning id into v_id;
 else
  update public.kanonha_surveys set
   title=v_title,description=v_description,category=p_category,kind=p_kind,
   starts_at=p_starts_at,ends_at=p_ends_at,min_rank_votes=p_min_rank_votes,
   audience_university_id=p_university_id,audience_faculty_id=p_faculty_id
   where id=p_survey_id and status='draft' returning id into v_id;
  if v_id is null then raise exception 'draft_not_found' using errcode='23514';end if;
  delete from public.kanonha_survey_options o where o.survey_id=v_id;
 end if;
 foreach v_source in array p_sources loop
  if p_category='club' then
   select c.name into v_title from public.kanonha_clubs c where c.id=v_source and c.is_active;
  elsif p_category='faculty' then
   select f.name into v_title from public.kanonha_faculties f where f.id=v_source;
  else
   select t.title into v_title from public.kanonha_rating_targets t
     where t.id=v_source and t.category='professor' and t.is_active;
  end if;
  if v_title is null then
    raise exception 'catalog_item_not_available' using errcode='23514';
  end if;
  insert into public.kanonha_survey_options(survey_id,source_id,title,sort_order)
    values(v_id,v_source,v_title,v_index);
  v_index=v_index+1;
  v_title=null;
 end loop;
 return v_id;
end $body$;
revoke all on function public.kanonha_survey_save(uuid,text,text,text,text,timestamptz,timestamptz,integer,uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.kanonha_survey_save(uuid,text,text,text,text,timestamptz,timestamptz,integer,uuid,uuid,uuid[]) to authenticated;
commit;
