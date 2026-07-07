-- XRatedTrade OS — Ecosystem Banner Engine (V2 Ecosystem Foundation, part 4/5).
--
-- Every free business app displays rotating ecosystem banners across
-- multiple slots. Every click stays inside XRatedTrade. Premium
-- businesses can either self-promote, promote a Trade Circle partner,
-- or donate their slot back to the ecosystem.
--
-- Four objects:
--   os_business_banners       — the merchant's own banner definitions
--   os_banner_slots           — slot inventory per host business
--   os_banner_impressions     — rendered event log (append-only)
--   os_banner_clicks          — click event log (append-only, chain-tracked)
--
-- Referral chain tracking (chain_position, chain_root) captures how
-- visitors bounce through the ecosystem. This becomes anchor-hub
-- economics data and Premium referral analytics.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. os_business_banners — merchant-owned banner definitions
--
-- mode:
--   'self_promote'      → the merchant's own banner, promoting themselves
--   'promote_partner'   → paid promotion of a specific Trade Circle partner
--   'ecosystem_donate'  → slot returned to the ecosystem rotation
--
-- Free-tier merchants always operate as if in 'ecosystem_donate' mode
-- (they don't own a custom banner) — the mode enum is authoritative
-- for Premium only.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_business_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES os_business_listings(id) ON DELETE CASCADE,

  mode text NOT NULL DEFAULT 'self_promote'
    CHECK (mode IN ('self_promote','promote_partner','ecosystem_donate')),

  -- Creative
  image_url text,
  headline text,
  subline text,
  cta_label text,
  cta_target_business_id uuid REFERENCES os_business_listings(id) ON DELETE SET NULL,
  cta_target_url text,                      -- overrides business route if set

  -- When mode='promote_partner', which partner
  promoted_business_id uuid REFERENCES os_business_listings(id) ON DELETE SET NULL,

  -- Scheduling
  active boolean NOT NULL DEFAULT true,
  scheduled_from timestamptz,
  scheduled_to timestamptz,

  -- Denormalised counters (updated via server routes, not triggers)
  impressions_last_30d integer NOT NULL DEFAULT 0,
  clicks_last_30d integer NOT NULL DEFAULT 0,
  donation_impressions_last_30d integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_business_banners_business_idx
  ON os_business_banners (business_id, active);
CREATE INDEX IF NOT EXISTS os_business_banners_mode_idx
  ON os_business_banners (mode) WHERE active = true;
CREATE INDEX IF NOT EXISTS os_business_banners_schedule_idx
  ON os_business_banners (scheduled_from, scheduled_to) WHERE active = true;

-- ---------------------------------------------------------------------
-- 2. os_banner_slots — slot inventory per host business
--
-- Each free / donating app exposes N slot positions across its pages.
-- The rotation service reads slot_position + host_business_id to
-- choose what to render. Slots exist as rows so admin can enable /
-- disable individual positions later without code changes.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_banner_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_business_id uuid NOT NULL REFERENCES os_business_listings(id) ON DELETE CASCADE,
  slot_position text NOT NULL
    CHECK (slot_position IN (
      'hero',
      'mid_home',
      'service_rail',
      'product_rail',
      'gallery_interstitial',
      'review_footer',
      'trade_circle_footer'
    )),
  active boolean NOT NULL DEFAULT true,

  -- Slot-specific config (frequency caps, weightings) can go here later
  config jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT os_banner_slots_host_position_uk
    UNIQUE (host_business_id, slot_position)
);

CREATE INDEX IF NOT EXISTS os_banner_slots_host_idx
  ON os_banner_slots (host_business_id) WHERE active = true;

-- ---------------------------------------------------------------------
-- 3. os_banner_impressions — append-only impression log
--
-- Written asynchronously by the render layer. High write volume — we
-- keep the row narrow, no updates, no cascade deletes. Old rows can
-- be aggregated to daily buckets by a scheduled job.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_banner_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_business_id uuid NOT NULL,
  slot_position text NOT NULL,
  target_business_id uuid NOT NULL,
  banner_id uuid,                           -- nullable: some renders are ecosystem
  visitor_session_id text NOT NULL,
  shown_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_banner_impressions_host_shown_idx
  ON os_banner_impressions (host_business_id, shown_at DESC);
CREATE INDEX IF NOT EXISTS os_banner_impressions_target_shown_idx
  ON os_banner_impressions (target_business_id, shown_at DESC);
CREATE INDEX IF NOT EXISTS os_banner_impressions_session_idx
  ON os_banner_impressions (visitor_session_id, shown_at DESC);

-- ---------------------------------------------------------------------
-- 4. os_banner_clicks — append-only click log with chain metadata
--
-- chain_position = 1 for the first banner clicked in a session
-- chain_root     = the first host_business_id in that chain
--
-- These two columns turn the click log into a graph traversal record.
-- Anchor-hub economics ("this builders merchant is the root of 12,000
-- chains/week") derive from aggregating on chain_root.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_banner_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_business_id uuid NOT NULL,
  slot_position text NOT NULL,
  target_business_id uuid NOT NULL,
  banner_id uuid,
  visitor_session_id text NOT NULL,
  chain_position integer NOT NULL DEFAULT 1,
  chain_root uuid,                          -- first host in this session's chain
  referer_url text,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_banner_clicks_host_clicked_idx
  ON os_banner_clicks (host_business_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS os_banner_clicks_target_clicked_idx
  ON os_banner_clicks (target_business_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS os_banner_clicks_session_idx
  ON os_banner_clicks (visitor_session_id, chain_position);
CREATE INDEX IF NOT EXISTS os_banner_clicks_chain_root_idx
  ON os_banner_clicks (chain_root, clicked_at DESC)
  WHERE chain_root IS NOT NULL;

-- ---------------------------------------------------------------------
-- 5. Touch triggers (for mutable tables only)
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'os_business_banners',
      'os_banner_slots'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION os_touch_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- Impression / click logs are append-only — no touch trigger, no updated_at.

-- ---------------------------------------------------------------------
-- 6. RLS — service-role only
-- ---------------------------------------------------------------------
ALTER TABLE os_business_banners      ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_banner_slots          ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_banner_impressions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_banner_clicks         ENABLE ROW LEVEL SECURITY;

COMMIT;
