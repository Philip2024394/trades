-- NEX Brain · Phase 5 · Cloud Worker Runtime
-- 003_worker_heartbeats.sql · Philip 2026-08-06
--
-- One row per running worker process (Fly machine, local dev server,
-- laptop worker script). host_id is the primary key so each process
-- upserts its own row. Dashboard queries WHERE last_seen_at > now()-60s
-- to determine which workers are alive.
--
-- Kept intentionally small — this is telemetry, not brain state. If
-- the table is empty, every worker looks offline; that's a correct
-- signal to Philip that nothing is running.

create table if not exists worker_heartbeats (
  host_id            text primary key,
  last_seen_at       timestamptz not null default now(),
  uptime_ms          bigint      not null default 0,
  cycles_total       integer     not null default 0,
  cycles_failed      integer     not null default 0,
  last_error         text,
  last_cycle_summary jsonb,
  metadata           jsonb
);

create index if not exists idx_worker_heartbeats_last_seen
  on worker_heartbeats (last_seen_at desc);

alter table worker_heartbeats enable row level security;

do $$
begin
  create policy worker_heartbeats_service_role on worker_heartbeats
    for all
    using (auth.jwt() ->> 'role' = 'service_role')
    with check (auth.jwt() ->> 'role' = 'service_role');
exception when duplicate_object then null;
end $$;

comment on table worker_heartbeats is
  'Cloud worker runtime heartbeat table. One row per host_id. A row older than 60s means the worker has stopped, crashed, or lost DB connectivity.';
