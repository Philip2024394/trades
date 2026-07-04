-- Payment webhook diagnostic log.
--
-- Every incoming webhook lands here regardless of verification result.
-- Merchants use /studio/payments/webhooks to debug provider setup —
-- signature failures, missing brand credentials, replay issues.
--
-- Retention: rows expire after 30 days via a scheduled job (not
-- installed here — merchants can add a pg_cron entry per env).

create table if not exists studio_payment_webhook_events (
  id            uuid primary key default gen_random_uuid(),
  provider_id   text not null,
  brand_id      uuid,                      -- may be null if signature failed across all brands
  event_type    text,                      -- provider-declared event type, e.g. "checkout.session.completed"
  external_ref  text,                      -- provider's session/charge/order id
  matched_order_id uuid references studio_payment_orders(id) on delete set null,
  signature_verified boolean not null default false,
  http_status   int,
  outcome       text not null,             -- 'updated' | 'ignored' | 'failed' | 'no-processor'
  outcome_detail text,
  payload_preview text,                    -- first 4KB of the raw body
  headers_preview jsonb not null default '{}'::jsonb,
  latency_ms    int,
  received_at   timestamptz not null default now()
);

create index if not exists idx_studio_payment_webhook_events_brand
  on studio_payment_webhook_events (brand_id, received_at desc);
create index if not exists idx_studio_payment_webhook_events_provider
  on studio_payment_webhook_events (provider_id, received_at desc);
create index if not exists idx_studio_payment_webhook_events_outcome
  on studio_payment_webhook_events (outcome, received_at desc);
