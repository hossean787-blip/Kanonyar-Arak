-- Kanonha independent student surveys v2.0.
-- Non-destructive: legacy rating tables and votes are left unchanged.
create table if not exists public.kanonha_surveys (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(btrim(title)) between 4 and 120),
 description text not null default '' check (char_length(description)<=500),
 category text not null check (category in ('club','professor','faculty')),
 kind text not null check (kind in ('regular','competition')),
 status text not null default 'draft' check (status in ('draft','published')),
 ends_at timestamptz not null,
 results_approved boolean not null default false,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 published_at timestamptz,
 constraint kanonha_surveys_no_early_approval check (status='published' or not results_approved),
 constraint kanonha_surveys_published_at check (status='draft' or published_at is not null)
);
create index if not exists kanonha_surveys_status_ends_idx
 on public.kanonha_surveys(status,ends_at);
create table if not exists public.kanonha_survey_options (
 id uuid primary key default gen_random_uuid(),
 survey_id uuid not null references public.kanonha_surveys(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 2 and 120),
 sort_order integer not null default 0 check (sort_order between 0 and 99),
 created_at timestamptz not null default now(),
 constraint kanonha_survey_options_pair unique (survey_id,id)
);
create index if not exists kanonha_survey_options_survey_idx
 on public.kanonha_survey_options(survey_id,sort_order);
create table if not exists public.kanonha_survey_votes (
 id uuid primary key default gen_random_uuid(),
 survey_id uuid not null,
 option_id uuid not null,
 user_id uuid not null default auth.uid() references auth.users(id),
 stars smallint not null check (stars between 1 and 5),
 created_at timestamptz not null default now(),
 constraint kanonha_survey_one_vote_per_person unique (survey_id,user_id),
 constraint kanonha_survey_vote_valid_option foreign key (survey_id,option_id)
  references public.kanonha_survey_options(survey_id,id) on delete restrict
);
create index if not exists kanonha_survey_votes_option_idx on public.kanonha_survey_votes(option_id);

alter table public.kanonha_surveys enable row level security;
alter table public.kanonha_survey_options enable row level security;
alter table public.kanonha_survey_votes enable row level security;
revoke all on public.kanonha_surveys,public.kanonha_survey_options,public.kanonha_survey_votes from public,anon,authenticated;
grant select (id,title,description,category,kind,status,ends_at,results_approved,published_at,created_at)
 on public.kanonha_surveys to anon,authenticated;
grant insert (title,description,category,kind,ends_at) on public.kanonha_surveys to authenticated;
grant update (title,description,category,kind,status,ends_at,results_approved)
 on public.kanonha_surveys to authenticated;
grant delete on public.kanonha_surveys to authenticated;
grant select (id,survey_id,title,sort_order) on public.kanonha_survey_options to anon,authenticated;
grant insert (survey_id,title,sort_order),update (title,sort_order),delete
 on public.kanonha_survey_options to authenticated;
grant select (survey_id,option_id,stars) on public.kanonha_survey_votes to authenticated;
grant insert (survey_id,option_id,stars) on public.kanonha_survey_votes to authenticated;

drop policy if exists kanonha_surveys_read on public.kanonha_surveys;
create policy kanonha_surveys_read on public.kanonha_surveys
 for select to anon,authenticated using (
  status='published' or exists (select 1 from public.kanonha_admins a where a.user_id=(select auth.uid()))
 );
drop policy if exists kanonha_surveys_manager_insert on public.kanonha_surveys;
create policy kanonha_surveys_manager_insert on public.kanonha_surveys
 for insert to authenticated with check (
  created_by=(select auth.uid()) and status='draft' and not results_approved
  and exists (select 1 from public.kanonha_admins a where a.user_id=(select auth.uid()))
 );
drop policy if exists kanonha_surveys_manager_update on public.kanonha_surveys;
create policy kanonha_surveys_manager_update on public.kanonha_surveys
 for update to authenticated
 using (exists (select 1 from public.kanonha_admins a where a.user_id=(select auth.uid())))
 with check (exists (select 1 from public.kanonha_admins a where a.user_id=(select auth.uid())));
drop policy if exists kanonha_surveys_manager_delete on public.kanonha_surveys;
create policy kanonha_surveys_manager_delete on public.kanonha_surveys
 for delete to authenticated using (
  status='draft' and exists (select 1 from public.kanonha_admins a where a.user_id=(select auth.uid()))
 );
drop policy if exists kanonha_survey_options_read on public.kanonha_survey_options;
create policy kanonha_survey_options_read on public.kanonha_survey_options
 for select to anon,authenticated using (
  exists (select 1 from public.kanonha_surveys s where s.id=survey_id)
 );
drop policy if exists kanonha_survey_options_manager_insert on public.kanonha_survey_options;
create policy kanonha_survey_options_manager_insert on public.kanonha_survey_options
 for insert to authenticated with check (
  exists (select 1 from public.kanonha_surveys s where s.id=survey_id and s.status='draft')
  and exists (select 1 from public.kanonha_admins a where a.user_id=(select auth.uid()))
 );
drop policy if exists kanonha_survey_options_manager_update on public.kanonha_survey_options;
create policy kanonha_survey_options_manager_update on public.kanonha_survey_options
 for update to authenticated
 using (
  exists (select 1 from public.kanonha_surveys s where s.id=survey_id and s.status='draft')
  and exists (select 1 from public.kanonha_admins a where a.user_id=(select auth.uid()))
 )
 with check (
  exists (select 1 from public.kanonha_surveys s where s.id=survey_id and s.status='draft')
  and exists (select 1 from public.kanonha_admins a where a.user_id=(select auth.uid()))
 );
drop policy if exists kanonha_survey_options_manager_delete on public.kanonha_survey_options;
create policy kanonha_survey_options_manager_delete on public.kanonha_survey_options
 for delete to authenticated using (
  exists (select 1 from public.kanonha_surveys s where s.id=survey_id and s.status='draft')
  and exists (select 1 from public.kanonha_admins a where a.user_id=(select auth.uid()))
 );
drop policy if exists kanonha_survey_votes_own_read on public.kanonha_survey_votes;
create policy kanonha_survey_votes_own_read on public.kanonha_survey_votes
 for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists kanonha_survey_votes_student_insert on public.kanonha_survey_votes;
create policy kanonha_survey_votes_student_insert on public.kanonha_survey_votes
 for insert to authenticated with check (
  user_id=(select auth.uid())
  and exists (select 1 from public.kanonha_profiles p where p.user_id=(select auth.uid()))
  and exists (
   select 1 from public.kanonha_surveys s
   where s.id=survey_id and s.status='published' and clock_timestamp()<s.ends_at
  )
  and exists (
   select 1 from public.kanonha_survey_options o
   where o.id=option_id and o.survey_id=survey_id
  )
 );
-- No vote UPDATE or DELETE privilege/policy: votes cannot be edited, transferred or erased.
create or replace function public.kanonha_survey_validate()
returns trigger language plpgsql set search_path='' as $body$
begin
 if tg_op='UPDATE' then
  if old.status='published' then
   if (to_jsonb(new)-'results_approved'-'updated_at') is distinct from
      (to_jsonb(old)-'results_approved'-'updated_at') then
    raise exception 'published_survey_is_locked' using errcode='23514';
   end if;
   if new.results_approved is distinct from old.results_approved then
    if old.kind<>'competition' or clock_timestamp()<old.ends_at then
      raise exception 'results_approval_not_allowed_before_competition_end'
        using errcode='23514';
    end if;
   end if;
  else
   if new.created_by is distinct from old.created_by then
    raise exception 'survey_owner_cannot_change' using errcode='23514';
   end if;
   if new.results_approved then
    raise exception 'draft_results_cannot_be_published' using errcode='23514';
   end if;
   if new.status='published' then
    if new.ends_at<=clock_timestamp() then
      raise exception 'survey_deadline_must_be_in_future' using errcode='23514';
    end if;
    if (select count(*) from public.kanonha_survey_options o where o.survey_id=new.id)<2 then
      raise exception 'survey_requires_at_least_two_options' using errcode='23514';
    end if;
    new.published_at=now();
   end if;
  end if;
  new.updated_at=now();
 end if;
 return new;
end
$body$;
revoke all on function public.kanonha_survey_validate() from public,anon,authenticated;
drop trigger if exists kanonha_survey_validate_trg on public.kanonha_surveys;
create trigger kanonha_survey_validate_trg before update on public.kanonha_surveys
 for each row execute function public.kanonha_survey_validate();

-- Only admin can preview; competition results remain inaccessible to students
-- until the deadline AND a separate manager approval.
create or replace function public.kanonha_survey_results(p_survey_id uuid)
returns table(option_id uuid,rating_count bigint,rating_sum bigint)
language sql stable security definer set search_path='' as $body$
 select o.id,
        count(v.id)::bigint,
        coalesce(sum(v.stars),0)::bigint
 from public.kanonha_survey_options o
 join public.kanonha_surveys s on s.id=o.survey_id
 left join public.kanonha_survey_votes v on v.option_id=o.id and v.survey_id=s.id
 where s.id=p_survey_id
   and (select auth.uid()) is not null
   and (
     exists(select 1 from public.kanonha_admins a where a.user_id=(select auth.uid()))
     or (s.status='published' and
      (s.kind='regular' or (s.kind='competition' and s.ends_at<=now() and s.results_approved)))
   )
 group by o.id,o.sort_order
 order by o.sort_order,o.id
$body$;
revoke all on function public.kanonha_survey_results(uuid) from public,anon,authenticated;
grant execute on function public.kanonha_survey_results(uuid) to authenticated;
