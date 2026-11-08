-- These identity tables intentionally have no app-role access. Explicit service
-- policies document the server-only boundary and suppress misleading no-policy lint.
create policy "credentials_service_only" on public.kanonha_student_credentials
  for all to service_role using (true) with check (true);
create policy "auth_attempts_service_only" on public.kanonha_auth_attempts
  for all to service_role using (true) with check (true);
