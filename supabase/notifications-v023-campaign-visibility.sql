-- Kanonha 0.9.27: fix RLS correlation for the authenticated recipient inbox.
-- Prior unqualified id resolved to the delivery row, preventing campaign visibility.
begin;
drop policy if exists kanonha_notification_campaign_visible on public.kanonha_notification_campaigns;
create policy kanonha_notification_campaign_visible
 on public.kanonha_notification_campaigns for select to authenticated
 using (exists (
   select 1 from public.kanonha_notification_deliveries as delivery
    where delivery.campaign_id = kanonha_notification_campaigns.id
      and delivery.user_id = (select auth.uid())
 ));
commit;
