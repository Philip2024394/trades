-- Platform Runtime — app_events table.
--
-- Every App-emitted analytics event lands here via
-- runtime.recordAppEvent (SDK's trackAppEvent is the developer-facing
-- wrapper). Kept separate from studio_layout_events so Studio-internal
-- telemetry stays uncluttered.
--
-- App event names are free-form strings so Apps can emit whatever
-- domain events they want ("customer.subscribed", "quote.requested"),
-- while the Event Bus (Phase 6) becomes the schema-registered source
-- of truth. In the meantime app_events is the audit log.

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.hammerex_trade_off_listings(id) on delete cascade,
  app_slug text not null,
  event_name text not null,
  payload_json jsonb,
  created_at timestamptz not null default now()
);

-- Fast merchant activity feed.
create index if not exists app_events_merchant_created_idx
  on public.app_events (merchant_id, created_at desc);

-- Fast per-App analytics roll-up ("this App fired X events this month").
create index if not exists app_events_app_created_idx
  on public.app_events (app_slug, created_at desc);

-- Fast filter on a single event name (dashboards drilling into
-- "customer.subscribed" over time).
create index if not exists app_events_event_name_idx
  on public.app_events (event_name, created_at desc);
