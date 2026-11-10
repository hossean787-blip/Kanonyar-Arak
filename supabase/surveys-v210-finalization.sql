-- Survey 2.1 upgrade. Additive and backward-compatible with existing saved votes.
-- Managed on production database; no other project tables are used.
begin;
alter table public.kanonha_surveys
 add column if not exists starts_at timestamptz not null default now(),
 add column if not exists audience_university_id uuid references public.kanonha_universities(id),
 add column if not exists audience_faculty_id uuid references public.kanonha_faculties(id),
 add column if not exists min_rank_votes integer not null default 5,
 add column if not exists copied_from uuid references public.kanonha_surveys(id);
alter table public.kanonha_surveys drop constraint if exists kanonha_surveys_status_check;
alter table public.kanonha_surveys add constraint kanonha_surveys_status_check
 check(status in ('draft','published','cancelled','archived'));
alter table public.kanonha_surveys drop constraint if exists kanonha_surveys_no_early_approval;
alter table public.kanonha_surveys add constraint kanonha_surveys_no_early_approval
 check(status in ('published','archived') or not results_approved);
alter table public.kanonha_surveys add constraint kanonha_surveys_window_check
 check(ends_at>starts_at and min_rank_votes between 1 and 100);
alter table public.kanonha_surveys add constraint kanonha_surveys_audience_pair_check
 check(audience_faculty_id is null or audience_university_id is not null);
alter table public.kanonha_survey_options
 add column if not exists source_id uuid;
create unique index if not exists kanonha_survey_options_source_unique
 on public.kanonha_survey_options(survey_id,source_id)
 where source_id is not null;
create index if not exists kanonha_surveys_audience_idx
 on public.kanonha_surveys(status,starts_at,ends_at,audience_university_id);

create table if not exists public.kanonha_survey_audit (
 id bigserial primary key,
 survey_id uuid,
 actor_id uuid,
 action text not null check(action in
  ('created','edited','published','approved','unapproved','cancelled','archived','deleted','duplicated')),
 occurred_at timestamptz not null default now(),
 info jsonb not null default '{}'::jsonb
);
alter table public.kanonha_survey_audit enable row level security;
revoke all on public.kanonha_survey_audit from public,anon,authenticated;
grant select (id,survey_id,actor_id,action,occurred_at,info) on public.kanonha_survey_audit to authenticated;
drop policy if exists kanonha_survey_audit_manager_read on public.kanonha_survey_audit;
create policy kanonha_survey_audit_manager_read on public.kanonha_survey_audit
 for select to authenticated using(
  exists(select 1 from public.kanonha_admins a where a.user_id=(select auth.uid()))
 );

-- Role-scoped, self-reported academic matching (the app collects campus data on signup).
-- An unassigned audience means all logged-in students may participate.
drop policy if exists kanonha_surveys_read on public.kanonha_surveys;
create policy kanonha_surveys_read on public.kanonha_surveys
 for select to anon,authenticated using(
  exists(select 1 from public.kanonha_admins adm where adm.user_id=(select auth.uid()))
  or (
   status in ('published','archived')
   and (audience_university_id is null or exists (
     select 1 from public.kanonha_academic_details d
       join public.kanonha_universities u on u.id=audience_university_id
     where d.user_id=(select auth.uid())
       and lower(btrim(d.university))=lower(btrim(u.name))
   ))
   and (audience_faculty_id is null or exists(
     select 1 from public.kanonha_academic_details d
       join public.kanonha_faculties f on f.id=audience_faculty_id
     where d.user_id=(select auth.uid())
       and lower(btrim(d.faculty))=lower(btrim(f.name))
   ))
  )
 );
drop policy if exists kanonha_survey_votes_student_insert on public.kanonha_survey_votes;
create policy kanonha_survey_votes_student_insert on public.kanonha_survey_votes
 for insert to authenticated with check (
  user_id=(select auth.uid())
  and exists(select 1 from public.kanonha_profiles p where p.user_id=(select auth.uid()))
  and exists(select 1 from public.kanonha_surveys s
    where s.id=survey_id and s.status='published'
      and clock_timestamp()>=s.starts_at and clock_timestamp()<s.ends_at)
  and exists(select 1 from public.kanonha_survey_options o
    where o.id=option_id and o.survey_id=survey_id)
 );
grant select (starts_at,audience_university_id,audience_faculty_id,min_rank_votes,copied_from)
 on public.kanonha_surveys to anon,authenticated;
grant update(starts_at,audience_university_id,audience_faculty_id,min_rank_votes)
 on public.kanonha_surveys to authenticated;
grant select(source_id) on public.kanonha_survey_options to anon,authenticated;
grant insert(source_id),update(source_id) on public.kanonha_survey_options to authenticated;

-- Existing survey deadline/approval guard, extended for cancellation and archives.
create or replace function public.kanonha_survey_validate()
returns trigger language plpgsql set search_path='' as $body$
begin
 if tg_op='UPDATE' then
  if old.status='published' then
    if (to_jsonb(new)-'results_approved'-'updated_at'-'status') is distinct from
       (to_jsonb(old)-'results_approved'-'updated_at'-'status') then
      raise exception 'published_survey_is_locked' using errcode='23514';
    end if;
    if new.status not in ('published','cancelled','archived') then
      raise exception 'invalid_survey_transition' using errcode='23514';
    end if;
    if new.status='archived' and clock_timestamp()<old.ends_at then
      raise exception 'archive_requires_finished_survey' using errcode='23514';
    end if;
    if new.results_approved is distinct from old.results_approved then
      if old.kind<>'competition' or clock_timestamp()<old.ends_at
         or new.status='cancelled' then
        raise exception 'results_approval_not_allowed' using errcode='23514';
      end if;
    end if;
  elsif old.status in ('cancelled','archived') then
    raise exception 'final_survey_is_locked' using errcode='23514';
  elsif old.status='draft' then
    if new.status not in ('draft','published') or new.results_approved then
      raise exception 'invalid_draft_transition' using errcode='23514';
    end if;
    if new.created_by is distinct from old.created_by or
       new.published_at is distinct from old.published_at then
      raise exception 'immutable_survey_metadata' using errcode='23514';
    end if;
    if new.status='published' then
      if new.ends_at<=clock_timestamp() or new.starts_at>=new.ends_at then
        raise exception 'survey_deadline_invalid' using errcode='23514';
      end if;
      if (select count(*) from public.kanonha_survey_options o where o.survey_id=new.id)<2 then
        raise exception 'survey_requires_two_options' using errcode='23514';
      end if;
      new.published_at=now();
    end if;
  end if;
  if new.audience_faculty_id is not null and
     not exists(select 1 from public.kanonha_faculties f
       where f.id=new.audience_faculty_id
         and f.university_id=new.audience_university_id) then
    raise exception 'audience_faculty_university_mismatch' using errcode='23514';
  end if;
  new.updated_at=now();
 end if;
 return new;
end
$body$;
revoke all on function public.kanonha_survey_validate() from public,anon,authenticated;

-- Normalize option titles from the trusted in-project catalogs. Legacy rows stay intact.
create or replace function public.kanonha_survey_option_validate()
returns trigger language plpgsql security definer set search_path='' as $body$
declare v_category text;v_status text;v_title text;
begin
 select s.category,s.status into v_category,v_status
 from public.kanonha_surveys s where s.id=new.survey_id;
 if v_status is distinct from 'draft' then
   raise exception 'cannot_edit_published_survey_options' using errcode='23514';
 end if;
 if new.source_id is not null then
   if v_category='club' then
      select c.name into v_title from public.kanonha_clubs c
       where c.id=new.source_id and c.is_active;
   elsif v_category='faculty' then
      select f.name into v_title from public.kanonha_faculties f
       where f.id=new.source_id;
   elsif v_category='professor' then
      select t.title into v_title from public.kanonha_rating_targets t
       where t.id=new.source_id and t.category='professor' and t.is_active;
   end if;
   if v_title is null then
      raise exception 'survey_option_source_not_in_catalog' using errcode='23514';
   end if;
   new.title=v_title;
 end if;
 return new;
end $body$;
revoke all on function public.kanonha_survey_option_validate() from public,anon,authenticated;
drop trigger if exists kanonha_survey_option_validate_trg on public.kanonha_survey_options;
create trigger kanonha_survey_option_validate_trg
 before insert or update on public.kanonha_survey_options
 for each row execute function public.kanonha_survey_option_validate();

create or replace function public.kanonha_survey_audit_trg()
returns trigger language plpgsql security definer set search_path='' as $body$
declare v_action text;
begin
 if tg_op='INSERT' then v_action='created';
 elsif tg_op='DELETE' then v_action='deleted';
 elsif new.status is distinct from old.status then
    v_action=case new.status when 'published' then 'published'
       when 'cancelled' then 'cancelled' when 'archived' then 'archived'
       else 'edited' end;
 elsif new.results_approved is distinct from old.results_approved then
    v_action=case when new.results_approved then 'approved' else 'unapproved' end;
 else v_action='edited';
 end if;
 insert into public.kanonha_survey_audit(survey_id,actor_id,action,info)
 values(case when tg_op='DELETE' then old.id else new.id end,
        (select auth.uid()),v_action,
        jsonb_build_object('kind',case when tg_op='DELETE' then old.kind else new.kind end));
 return case when tg_op='DELETE' then old else new end;
end $body$;
revoke all on function public.kanonha_survey_audit_trg() from public,anon,authenticated;
drop trigger if exists kanonha_survey_audit_trigger on public.kanonha_surveys;
create trigger kanonha_survey_audit_trigger
 after insert or update or delete on public.kanonha_surveys
 for each row execute function public.kanonha_survey_audit_trg();

-- Replaces the v2 report with audience/status-aware privacy.
create or replace function public.kanonha_survey_results(p_survey_id uuid)
returns table(option_id uuid,rating_count bigint,rating_sum bigint)
language sql stable security definer set search_path='' as $body$
 select o.id,count(v.id)::bigint,coalesce(sum(v.stars),0)::bigint
 from public.kanonha_survey_options o
 join public.kanonha_surveys s on s.id=o.survey_id
 left join public.kanonha_survey_votes v on v.option_id=o.id and v.survey_id=s.id
 where s.id=p_survey_id and (select auth.uid()) is not null
 and (exists(select 1 from public.kanonha_admins a where a.user_id=(select auth.uid()))
  or (s.status in ('published','archived')
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

-- Catalog is visible exclusively to the manager, never a student-service role.
create or replace function public.kanonha_survey_catalog(p_category text)
returns table(source_id uuid,category text,title text,subtitle text)
language sql stable security definer set search_path='' as $body$
 select v.id,v.category,v.title,v.subtitle from (
   select c.id,'club'::text category,c.name title,
     coalesce(nullif(c.university,''),'کانون فعال') subtitle
     from public.kanonha_clubs c where c.is_active
   union all
   select f.id,'faculty',f.name,u.name from public.kanonha_faculties f
       join public.kanonha_universities u on u.id=f.university_id
   union all
   select t.id,'professor',t.title,coalesce(t.subtitle,'')
       from public.kanonha_rating_targets t
       where t.category='professor' and t.is_active
 ) v
 where v.category=p_category
   and exists(select 1 from public.kanonha_admins adm where adm.user_id=(select auth.uid()))
 order by v.title,v.id
$body$;
revoke all on function public.kanonha_survey_catalog(text) from public,anon,authenticated;
grant execute on function public.kanonha_survey_catalog(text) to authenticated;

-- Atomic create/update: survey metadata and real candidate option set commit together.
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
    p_min_rank_votes not between 1 and 100 or v_count not between 2 and 12 or
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

create or replace function public.kanonha_survey_duplicate(p_id uuid)
returns uuid language plpgsql security definer set search_path='' as $body$
declare s public.kanonha_surveys%rowtype;v_id uuid;
declare sources uuid[];
begin
 if (select auth.uid()) is null or not exists(
    select 1 from public.kanonha_admins a where a.user_id=(select auth.uid())) then
  raise exception 'manager_only' using errcode='42501';end if;
 select * into s from public.kanonha_surveys where id=p_id;
 if not found then raise exception 'survey_not_found' using errcode='22023';end if;
 select array_agg(o.source_id order by sort_order) into sources
   from public.kanonha_survey_options o where o.survey_id=p_id;
 if sources is null or array_position(sources,null) is not null then
   raise exception 'legacy_survey_cannot_duplicate_without_catalog' using errcode='23514';
 end if;
 select public.kanonha_survey_save(null,'کپی '||left(s.title,110),s.description,s.category,
    s.kind,clock_timestamp(),clock_timestamp()+interval '7 days',s.min_rank_votes,
    s.audience_university_id,s.audience_faculty_id,sources) into v_id;
 update public.kanonha_surveys set copied_from=p_id where id=v_id;
 insert into public.kanonha_survey_audit(survey_id,actor_id,action)
 values(v_id,(select auth.uid()),'duplicated');
 return v_id;
end $body$;
revoke all on function public.kanonha_survey_duplicate(uuid) from public,anon,authenticated;
grant execute on function public.kanonha_survey_duplicate(uuid) to authenticated;

create or replace function public.kanonha_survey_participation(p_id uuid)
returns table(eligible_students bigint,voters bigint)
language sql stable security definer set search_path='' as $body$
 select
  (select count(*) from public.kanonha_profiles p
   where s.audience_university_id is null
     or exists(select 1 from public.kanonha_academic_details d
     join public.kanonha_universities u on u.id=s.audience_university_id
     where d.user_id=p.user_id and lower(btrim(d.university))=lower(btrim(u.name)))
    and (s.audience_faculty_id is null or exists(
     select 1 from public.kanonha_academic_details d
     join public.kanonha_faculties f on f.id=s.audience_faculty_id
     where d.user_id=p.user_id and lower(btrim(d.faculty))=lower(btrim(f.name))))),
  (select count(*) from public.kanonha_survey_votes v where v.survey_id=s.id)
 from public.kanonha_surveys s where s.id=p_id
 and exists(select 1 from public.kanonha_admins a where a.user_id=(select auth.uid()))
$body$;
revoke all on function public.kanonha_survey_participation(uuid) from public,anon,authenticated;
grant execute on function public.kanonha_survey_participation(uuid) to authenticated;
commit;