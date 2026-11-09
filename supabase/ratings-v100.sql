-- Independent Kanonha student rating system, v1.0
-- One immutable 1–5 star vote per authenticated student and rated target.
-- Rating aggregates expose no voter identities.
create schema if not exists kanonha_private;
revoke all on schema kanonha_private from public, anon, authenticated;

create table if not exists public.kanonha_rating_targets (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('club','professor','faculty')),
  source_id uuid,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  subtitle text not null default '' check (char_length(subtitle) <= 120),
  is_active boolean not null default true,
  rating_count integer not null default 0 check (rating_count >= 0),
  rating_sum integer not null default 0 check (rating_sum >= 0 and rating_sum <= rating_count * 5),
  created_at timestamptz not null default now(),
  constraint kanonha_rating_target_source_unique unique (category,source_id),
  constraint kanonha_rating_target_source_kind check
    ((category = 'professor' and source_id is null) or
     (category in ('club','faculty') and source_id is not null))
);

create table if not exists public.kanonha_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references public.kanonha_rating_targets(id) on delete restrict,
  stars smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  constraint kanonha_rating_one_vote unique (user_id,target_id)
);
create index if not exists kanonha_ratings_target_idx on public.kanonha_ratings(target_id);
create index if not exists kanonha_ratings_user_idx on public.kanonha_ratings(user_id);
create index if not exists kanonha_rating_targets_category_idx
  on public.kanonha_rating_targets(category,is_active);

alter table public.kanonha_rating_targets enable row level security;
alter table public.kanonha_ratings enable row level security;
revoke all on public.kanonha_rating_targets from anon,authenticated;
revoke all on public.kanonha_ratings from anon,authenticated;
grant select on public.kanonha_rating_targets to anon,authenticated;
grant insert (category,title,subtitle,is_active)
  on public.kanonha_rating_targets to authenticated;
grant select,insert on public.kanonha_ratings to authenticated;

create policy kanonha_rating_targets_public_read
  on public.kanonha_rating_targets for select to anon,authenticated
  using (is_active);
create policy kanonha_rating_admin_add_professor
  on public.kanonha_rating_targets for insert to authenticated
  with check (
    category='professor' and source_id is null and rating_count=0 and rating_sum=0
    and exists (select 1 from public.kanonha_admins a where a.user_id=(select auth.uid()))
  );
create policy kanonha_ratings_student_read_own
  on public.kanonha_ratings for select to authenticated
  using (user_id=(select auth.uid()));
create policy kanonha_ratings_student_one_insert
  on public.kanonha_ratings for insert to authenticated
  with check (
    user_id=(select auth.uid())
    and exists (select 1 from public.kanonha_profiles p where p.user_id=(select auth.uid()))
    and exists (select 1 from public.kanonha_rating_targets t
      where t.id=target_id and t.is_active)
  );
-- No UPDATE/DELETE policy or grant: votes cannot be edited or re-cast.

create or replace function kanonha_private.refresh_rating_counters()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    update public.kanonha_rating_targets
       set rating_count=rating_count+1,rating_sum=rating_sum+new.stars
     where id=new.target_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.kanonha_rating_targets
       set rating_count=rating_count-1,rating_sum=rating_sum-old.stars
     where id=old.target_id;
    return old;
  else
    update public.kanonha_rating_targets
       set rating_count=rating_count-1,rating_sum=rating_sum-old.stars
     where id=old.target_id;
    update public.kanonha_rating_targets
       set rating_count=rating_count+1,rating_sum=rating_sum+new.stars
     where id=new.target_id;
    return new;
  end if;
end;
$function$;
revoke all on function kanonha_private.refresh_rating_counters() from public,anon,authenticated;
create trigger kanonha_ratings_count_changes
after insert or update or delete on public.kanonha_ratings
for each row execute function kanonha_private.refresh_rating_counters();

-- Keep club and faculty targets in sync with authoritative university data.
create or replace function kanonha_private.sync_club_rating_target()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    update public.kanonha_rating_targets set is_active=false
      where category='club' and source_id=old.id;
    return old;
  end if;
  insert into public.kanonha_rating_targets(category,source_id,title,subtitle,is_active)
    values ('club',new.id,new.name,'',new.is_active)
    on conflict (category,source_id) do update
      set title=excluded.title,is_active=excluded.is_active;
  return new;
end;
$function$;
revoke all on function kanonha_private.sync_club_rating_target() from public,anon,authenticated;
create trigger kanonha_club_rating_sync
after insert or update of name,is_active or delete on public.kanonha_clubs
for each row execute function kanonha_private.sync_club_rating_target();

create or replace function kanonha_private.sync_faculty_rating_target()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare university_name text;
begin
  if tg_op = 'DELETE' then
    update public.kanonha_rating_targets set is_active=false
      where category='faculty' and source_id=old.id;
    return old;
  end if;
  select name into university_name from public.kanonha_universities
    where id=new.university_id;
  insert into public.kanonha_rating_targets(category,source_id,title,subtitle,is_active)
    values ('faculty',new.id,new.name,coalesce(university_name,''),true)
    on conflict (category,source_id) do update
      set title=excluded.title,subtitle=excluded.subtitle,is_active=true;
  return new;
end;
$function$;
revoke all on function kanonha_private.sync_faculty_rating_target() from public,anon,authenticated;
create trigger kanonha_faculty_rating_sync
after insert or update of name,university_id or delete on public.kanonha_faculties
for each row execute function kanonha_private.sync_faculty_rating_target();

insert into public.kanonha_rating_targets(category,source_id,title,subtitle,is_active)
select 'club',id,name,'',is_active from public.kanonha_clubs
on conflict (category,source_id) do update
  set title=excluded.title,is_active=excluded.is_active;
insert into public.kanonha_rating_targets(category,source_id,title,subtitle,is_active)
select 'faculty',f.id,f.name,u.name,true
from public.kanonha_faculties f
join public.kanonha_universities u on u.id=f.university_id
on conflict (category,source_id) do update
  set title=excluded.title,subtitle=excluded.subtitle,is_active=excluded.is_active;
-- Professors are added only by a verified manager, never invented or crowdsourced.
