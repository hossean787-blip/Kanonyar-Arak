-- Kanonha 0.9.31 - independent FCM device registration, no Firebase credentials in SQL.
-- Rollout: apply once to project cnqcysnjinghzzrzanpj; sender uses service role.
begin;
create table if not exists public.kanonha_push_devices (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 device_id uuid not null,
 token text not null check (char_length(token) between 20 and 4096),
 platform text not null default 'android' check (platform = 'android'),
 updated_at timestamptz not null default now(),
 constraint kanonha_push_one_account_device unique (user_id, device_id),
 constraint kanonha_push_one_token unique (token)
);
create index if not exists kanonha_push_devices_user_idx on public.kanonha_push_devices(user_id);
alter table public.kanonha_push_devices enable row level security;
revoke all on public.kanonha_push_devices from public, anon, authenticated;
grant select, insert, delete on public.kanonha_push_devices to authenticated;
grant update(token, updated_at) on public.kanonha_push_devices to authenticated;
drop policy if exists kanonha_push_own_select on public.kanonha_push_devices;
create policy kanonha_push_own_select on public.kanonha_push_devices
 for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists kanonha_push_own_insert on public.kanonha_push_devices;
create policy kanonha_push_own_insert on public.kanonha_push_devices
 for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists kanonha_push_own_update on public.kanonha_push_devices;
create policy kanonha_push_own_update on public.kanonha_push_devices
 for update to authenticated using (user_id = (select auth.uid()))
 with check (user_id = (select auth.uid()));
drop policy if exists kanonha_push_own_delete on public.kanonha_push_devices;
create policy kanonha_push_own_delete on public.kanonha_push_devices
 for delete to authenticated using (user_id = (select auth.uid()));
commit;
