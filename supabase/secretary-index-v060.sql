-- Index for audit-reference cleanup and membership administration.
create index if not exists kanonha_memberships_decided_by_idx on public.kanonha_memberships (decided_by) where decided_by is not null;
