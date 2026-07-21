-- Trust ladder — Bronze → Silver → Gold → Platinum.
--
-- Every merchant lives on this ladder. Each tier unlocks REAL perks
-- (algorithmic boost, featured slots, badge display, response-time
-- badge, custom colour). Revenue paths built in:
--   1. £14.99/mo Pro subscription required for Gold
--   2. £24.99/mo Business subscription required for Platinum
--   3. £4.99 one-time skip-verification-queue fee
--   4. £2.99 one-time custom badge colour (Platinum only)
--   5. Featured-slot rotation (Gold+) drives boost purchases
--
-- Ladder tier is CACHED on the listing for fast public surface reads;
-- computed nightly by /api/cron/recompute-trust-ladders and updated
-- live when a review lands or a subscription changes.

-- ─── Cached tier + score on the listing ──────────────────────
ALTER TABLE public.hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS trust_tier         TEXT      NOT NULL DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS trust_score        INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust_updated_at   TIMESTAMPTZ,
  -- Custom badge colour — Platinum-only unlock (£2.99 one-time).
  -- Null = use tier default (bronze/silver/gold/platinum). When set,
  -- the canteen page + yard sort UI use this hex for the badge chip.
  ADD COLUMN IF NOT EXISTS trust_badge_color  TEXT,
  -- Skip-queue purchase — merchant paid £4.99 to jump the manual
  -- verification queue. Set by the Stripe webhook.
  ADD COLUMN IF NOT EXISTS trust_skip_queue_paid_at TIMESTAMPTZ;

ALTER TABLE public.hammerex_trade_off_listings
  DROP CONSTRAINT IF EXISTS hammerex_trade_off_listings_trust_tier_check;
ALTER TABLE public.hammerex_trade_off_listings
  ADD CONSTRAINT hammerex_trade_off_listings_trust_tier_check CHECK (
    trust_tier IN ('bronze', 'silver', 'gold', 'platinum')
  );

CREATE INDEX IF NOT EXISTS idx_trade_off_listings_trust_tier
  ON public.hammerex_trade_off_listings (trust_tier, trust_score DESC)
  WHERE status = 'live';

-- ─── Per-merchant criteria snapshot ──────────────────────────
-- One row per criterion. Recomputed nightly + on trigger events
-- (review submitted, subscription started, insurance verified etc).
-- Powers the "how do I get to Gold" progress bar in the dashboard.
CREATE TABLE IF NOT EXISTS public.hammerex_merchant_trust_criteria (
  merchant_slug   TEXT NOT NULL,
  criterion_slug  TEXT NOT NULL,   -- profile_complete, whatsapp_verified,
                                    -- min_photos_3, min_reviews_1,
                                    -- min_reviews_10, min_avg_rating_4_0,
                                    -- min_reviews_25, min_avg_rating_4_5,
                                    -- days_active_30, tier_pro_sub,
                                    -- tier_business_sub, insurance_verified,
                                    -- trade_body_verified, id_verified
  met             BOOLEAN NOT NULL DEFAULT FALSE,
  value_snapshot  JSONB,           -- e.g. { "count": 8 } for review counts
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (merchant_slug, criterion_slug)
);

CREATE INDEX IF NOT EXISTS idx_trust_criteria_merchant
  ON public.hammerex_merchant_trust_criteria (merchant_slug);

-- ─── Ladder promotion / demotion history ─────────────────────
-- Audit trail — every tier change lands here. Powers merchant
-- notifications ("You made Gold!") + admin support ("why did I
-- drop from Silver to Bronze?").
CREATE TABLE IF NOT EXISTS public.hammerex_merchant_trust_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug  TEXT NOT NULL,
  from_tier      TEXT NOT NULL,
  to_tier        TEXT NOT NULL,
  reason         TEXT,             -- 'review_added' | 'subscription_started' |
                                    -- 'nightly_recompute' | 'skip_queue_paid'
  score_before   INTEGER,
  score_after    INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_history_merchant_recent
  ON public.hammerex_merchant_trust_history (merchant_slug, created_at DESC);

ALTER TABLE public.hammerex_merchant_trust_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_merchant_trust_history  ENABLE ROW LEVEL SECURITY;
