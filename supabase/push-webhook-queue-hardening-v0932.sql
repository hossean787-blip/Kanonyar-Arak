-- Kanonha: contain transient Firebase server API keys in pg_net's HTTP queue.
-- pg_net's default schema grants are broader than Kanonha's least-privilege policy.
-- The only caller of net.http_post is the private SECURITY DEFINER trigger owned by postgres.
begin;
revoke all on schema net from public, anon, authenticated;
revoke all on all tables in schema net from public, anon, authenticated;
revoke all on all sequences in schema net from public, anon, authenticated;
revoke all on all functions in schema net from public, anon, authenticated;
commit;
