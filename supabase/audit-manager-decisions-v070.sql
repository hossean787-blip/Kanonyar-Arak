-- Manager actions use the verified manager's Auth uid, supplied only by the
-- authenticated Edge Function. Student clients cannot update decided_by.
create or replace function kanonha_private.audit_membership_decision()
returns trigger language plpgsql security invoker set search_path='' as $fn$
begin
  if old.status <> 'pending' or new.status not in ('approved', 'rejected')
    or new.club_id <> old.club_id or new.user_id <> old.user_id then
    raise exception 'Invalid membership state transition';
  end if;
  new.decided_by := coalesce(auth.uid(), new.decided_by);
  new.decided_at := now();
  return new;
end;
$fn$;
revoke all on function kanonha_private.audit_membership_decision() from public,anon,authenticated;
