-- Mobile number is collected WITHOUT OTP; it is self-reported, not verified.
-- Protected by the same owner-only RLS as academic details.
alter table public.kanonha_academic_details
  add column if not exists mobile text not null default '09999999999'
  check (mobile ~ '^09[0-9]{9}$');
alter table public.kanonha_academic_details
  alter column mobile drop default;
grant select (mobile) on public.kanonha_academic_details to authenticated;
grant update (mobile) on public.kanonha_academic_details to authenticated;
