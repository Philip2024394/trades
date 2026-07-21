-- Analytics Engine + Marketplace Liquidity Engine · shared events table.
-- Phase 1.1 + 1.2 of the engine-first roadmap.
--
-- One event-store powers:
--   • Analytics Engine (raw event capture, aggregate views)
--   • Marketplace Liquidity Engine (7-stage lifecycle contract:
--     demand_created → supply_available → supply_contacted →
--     supply_responded → match_created → match_completed →
--     revenue_generated)
--   • Network Health Centre · Coverage Map · Growth Engine ·
--     Revenue Centre · War Room dashboards
--
-- Every product (Trade Centre, SiteBook, Marketplace, Delivery, Rentals,
-- Beauty, Massage) emits events into this table. Product-specific slug
-- (e.g. "sitebook.post_created") plus a lifecycle_stage (e.g.
-- "demand_created") lets any dashboard filter both ways.
--
-- Append-only. NEVER updated in place. Old events are the record.

CREATE TABLE IF NOT EXISTS public.hammerex_events (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Product-specific slug — namespaced verb, e.g.:
  --   sitebook.post_created · sitebook.trade_replied · sitebook.job_completed
  --   yard.beacon_created · yard.beacon_responded · yard.beacon_matched
  --   marketplace.product_viewed · marketplace.order_created · marketplace.order_completed
  --   trade.signup · homeowner.signup · merchant.signup · merchant.tier_upgraded
  --   canteen.post_created · washer.top_up · referral.attributed
  event_slug        TEXT           NOT NULL,

  -- Product namespace — for cross-product filtering.
  -- "sitebook" | "yard" | "trade_center" | "canteen" | "auth" |
  -- "billing" | "referral" | "shadow_scraper" | "admin" | "system"
  product           TEXT           NOT NULL,

  -- Marketplace Liquidity Engine stage — nullable when the event
  -- doesn't map to a lifecycle stage (e.g. auth events, admin actions).
  -- CHECK enforces the canonical 7 stages.
  lifecycle_stage   TEXT
                     CHECK (lifecycle_stage IS NULL OR lifecycle_stage IN (
                       'demand_created',
                       'supply_available',
                       'supply_contacted',
                       'supply_responded',
                       'match_created',
                       'match_completed',
                       'revenue_generated'
                     )),

  -- WHO — polymorphic actor. actor_kind:
  --   "homeowner" | "trade" | "merchant" | "admin" | "system" |
  --   "guest" (unauthenticated) | "scheduled" (cron)
  actor_kind        TEXT           NOT NULL,
  actor_id          TEXT,                              -- nullable for guest / system
  actor_display     TEXT,                              -- denormalised for dashboards

  -- TARGET — polymorphic. Optional (some events have no target).
  target_kind       TEXT,                              -- "post" | "listing" | "trade" | "project" | ...
  target_id         TEXT,
  target_display    TEXT,

  -- GEOGRAPHIC context — critical for Coverage Map + city dashboards.
  -- Normalised to lowercase slugs for reliable grouping.
  city              TEXT,                              -- "manchester" | "leeds" | ...
  postcode_area     TEXT,                              -- "M1" | "LS2" | ... (outward code)

  -- CATEGORY context — Coverage Map + growth engine slices.
  trade_category    TEXT,                              -- "plumber" | "electrician" | ...

  -- REVENUE — cash value in pence. Populated when
  -- lifecycle_stage = 'revenue_generated'. Currency defaults GBP.
  revenue_pence     INTEGER,
  revenue_currency  TEXT           NOT NULL DEFAULT 'GBP',

  -- ACQUISITION attribution — for Growth Engine Centre.
  --   "shadow_drip" | "referral" | "seo" | "organic" | "direct" |
  --   "paid" | "referred_by:<slug>" | ...
  acquisition_channel  TEXT,

  -- FLEXIBLE payload for product-specific fields
  metadata          JSONB,

  -- TIMESTAMPS — occurred_at is when the event happened; ingested_at
  -- is when we wrote it. Usually the same, differ if backfilled.
  occurred_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  ingested_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Hot-path indexes — each dashboard query pattern
CREATE INDEX IF NOT EXISTS idx_events_recent
  ON public.hammerex_events (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_slug_recent
  ON public.hammerex_events (event_slug, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_product_recent
  ON public.hammerex_events (product, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_lifecycle_recent
  ON public.hammerex_events (lifecycle_stage, occurred_at DESC)
  WHERE lifecycle_stage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_city_category
  ON public.hammerex_events (city, trade_category, occurred_at DESC)
  WHERE city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_actor
  ON public.hammerex_events (actor_kind, actor_id, occurred_at DESC)
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_target
  ON public.hammerex_events (target_kind, target_id, occurred_at DESC)
  WHERE target_id IS NOT NULL;

ALTER TABLE public.hammerex_events ENABLE ROW LEVEL SECURITY;
-- Service-role only. Reads via dashboard API layer.
