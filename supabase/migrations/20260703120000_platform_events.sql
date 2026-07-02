-- Platform Runtime — durable event log.
--
-- Every published event is written here. Consumers replay by
-- monotonic sequence: "give me every event with seq > my_last_seq".
--
-- Design notes:
--   • bigserial `seq` gives us strict ordering across all events
--     regardless of clock skew — the canonical cursor for replay.
--   • `id` is a UUID so external consumers (webhook receivers, log
--     shippers) get a stable per-event identifier that doesn't leak
--     the sequence number.
--   • `merchant_id` is nullable — platform-wide events (App installed
--     across many merchants, catalogue changes) have no owner.
--   • `published_by_app` is nullable — platform-emitted events
--     ("installed_apps.changed") have no App attribution.
--   • Retention is not enforced by DDL. A retention job in a later
--     phase will archive/prune based on event kind + age.

create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  seq bigserial not null unique,
  event text not null,
  payload_json jsonb,
  merchant_id uuid references public.hammerex_trade_off_listings(id) on delete cascade,
  published_by_app text,
  published_at timestamptz not null default now()
);

-- Replay from a specific sequence — the hot path.
create index if not exists platform_events_seq_idx
  on public.platform_events (seq);

-- "Every event of this kind since seq X" — dashboards, App consumers.
create index if not exists platform_events_event_seq_idx
  on public.platform_events (event, seq);

-- "Everything that happened to this merchant since seq X" — powers
-- per-merchant activity streams.
create index if not exists platform_events_merchant_seq_idx
  on public.platform_events (merchant_id, seq)
  where merchant_id is not null;

-- "Every event this App emitted" — Phase-6 App analytics dashboard.
create index if not exists platform_events_publisher_seq_idx
  on public.platform_events (published_by_app, seq)
  where published_by_app is not null;
