-- Kanonha 0.9.33: credential-free pg_net queue.
-- An HMAC signature (valid for 180 seconds) replaces the reusable server API key.
-- Provision the SAME strong random 32+ character value in two protected stores:
--   Vault name: kanonha_fcm_webhook_hmac_secret
--   Edge Function secret: KANONHA_FCM_WEBHOOK_HMAC_SECRET
-- NEVER put the secret literal in this migration, source code or GitHub Actions.
begin;
create or replace function kanonha_private.enqueue_fcm_notification()
returns trigger language plpgsql security definer
set search_path = '' as $kanonha$
declare
  hmac_key text;
  epoch_text text;
  message text;
  signed_hex text;
begin
  select v.decrypted_secret into hmac_key
    from vault.decrypted_secrets v
   where v.name='kanonha_fcm_webhook_hmac_secret'
   limit 1;
  if hmac_key is null or length(hmac_key)<32 then
    return new;
  end if;
  epoch_text := (extract(epoch from clock_timestamp())::bigint)::text;
  message := new.id::text || ':' || epoch_text;
  signed_hex := encode(extensions.hmac(
     convert_to(message,'UTF8'),
     convert_to(hmac_key,'UTF8'),
     'sha256'
   ),'hex');
  perform net.http_post(
    url := 'https://cnqcysnjinghzzrzanpj.supabase.co/functions/v1/kanonha-fcm-delivery',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-kanonha-timestamp',epoch_text,
      'x-kanonha-signature',signed_hex),
    body := jsonb_build_object('type','INSERT','schema','public',
      'table','kanonha_notification_deliveries',
      'record',jsonb_build_object('id',new.id),
      'old_record',null),
    timeout_milliseconds := 3000
  );
  return new;
exception when others then
  raise warning 'Kanonha FCM queue failed; in-app notification preserved';
  return new;
end;
$kanonha$;
revoke all on function kanonha_private.enqueue_fcm_notification() from public,anon,authenticated;
commit;
