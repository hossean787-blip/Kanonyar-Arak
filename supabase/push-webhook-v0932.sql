-- Kanonha: gated notification delivery webhook using pg_net + Supabase Vault.
-- No service credentials appear in this migration or the app.
-- Secret name to provision (server API key only): kanonha_fcm_sender_apikey.
-- Until the Vault secret is present and >=32 chars, the trigger is intentionally inert.
begin;
create extension if not exists pg_net with schema extensions;
create schema if not exists kanonha_private;
revoke all on schema kanonha_private from public,anon,authenticated;
create or replace function kanonha_private.enqueue_fcm_notification()
returns trigger language plpgsql security definer
set search_path = '' as $kanonha$
declare
  server_key text;
begin
  -- Only send identifiers; the Edge Function reloads the delivery and campaign
  -- from the database with its own server credentials.
  select v.decrypted_secret into server_key
  from vault.decrypted_secrets v
  where v.name = 'kanonha_fcm_sender_apikey'
  limit 1;

  if server_key is null or length(server_key) < 32 then
    return new;
  end if;

  perform net.http_post(
    url := 'https://cnqcysnjinghzzrzanpj.supabase.co/functions/v1/kanonha-fcm-delivery',
    headers := jsonb_build_object('Content-Type','application/json','apikey',server_key),
    body := jsonb_build_object('type','INSERT','schema','public',
      'table','kanonha_notification_deliveries',
      'record',jsonb_build_object('id',new.id),
      'old_record',null),
    timeout_milliseconds := 3000
  );
  return new;
exception when others then
  -- Never fail the in-app notification transaction because FCM is unavailable.
  raise warning 'Kanonha FCM queue failed; in-app notification preserved';
  return new;
end;
$kanonha$;
revoke all on function kanonha_private.enqueue_fcm_notification() from public,anon,authenticated;
drop trigger if exists kanonha_fcm_delivery_webhook on public.kanonha_notification_deliveries;
create trigger kanonha_fcm_delivery_webhook
after insert on public.kanonha_notification_deliveries
for each row execute function kanonha_private.enqueue_fcm_notification();
commit;
