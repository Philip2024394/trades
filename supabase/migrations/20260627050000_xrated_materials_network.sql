-- Xrated Trades — Materials Network add-on (£3/mo).
--
-- Trust-based commission engine for builder's merchants. A tradesperson
-- picks up to 12 merchants they trust ("plasterboard from Joe's Yard,
-- adhesives from Manchester Builders"), customer browses the merchant
-- via /<slug>/materials/<merchantSlug>, sends a WhatsApp quote with
-- an attribution ref code, merchant marks fulfilled in-dashboard.
-- Last-click 24h sticky attribution. Soft disclosure on the public
-- materials page. No invitation rewards in v1.
--
-- Namespace: hammerex_xrated_merchant_*.
--
-- Tables:
-- 1. hammerex_xrated_merchant_picks       — tradesperson's curated list
-- 2. hammerex_xrated_merchant_referrals   — referral ledger + state
-- 3. hammerex_xrated_push_log             — stub notif log (Lead Alerts will replace)
--
-- Columns on hammerex_trade_off_listings:
-- merchant_commission_rate / merchant_commission_min_pence /
-- merchant_commission_terms / materials_network_opted_in_at /
-- materials_network_paused.
--
-- View: hammerex_xrated_tradie_earnings_v — read-side aggregate for the
-- tradesperson's earnings ledger. Privacy boundary: NEVER reads customer
-- name / wa / postcode fields.

-- ─── 1. merchant_picks ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hammerex_xrated_merchant_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tradie_listing_id uuid NOT NULL
    REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  merchant_listing_id uuid NOT NULL
    REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  intro_note text CHECK (intro_note IS NULL OR char_length(intro_note) <= 200),
  sort_order int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'live'
    CHECK (status IN ('live','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tradie_listing_id, merchant_listing_id),
  CHECK (tradie_listing_id <> merchant_listing_id)
);

CREATE INDEX IF NOT EXISTS idx_merchant_picks_tradie
  ON hammerex_xrated_merchant_picks (tradie_listing_id, sort_order)
  WHERE status = 'live';

-- ─── 2. merchant_referrals ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hammerex_xrated_merchant_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_code text UNIQUE NOT NULL,
  tradie_listing_id uuid NOT NULL
    REFERENCES hammerex_trade_off_listings(id),
  merchant_listing_id uuid NOT NULL
    REFERENCES hammerex_trade_off_listings(id),
  customer_session_id text,
  customer_wa_hash text,
  customer_name text,
  customer_wa_e164 text,
  cart_items_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_cart_total_pence int,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','fulfilled','declined','expired','disputed')),
  fulfilled_at timestamptz,
  fulfilled_order_value_pence int,
  commission_rate_at_fulfilment numeric(5,2),
  commission_pence int,
  fulfilled_note text,
  declined_reason text,
  declined_note text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_tradie
  ON hammerex_xrated_merchant_referrals (tradie_listing_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_merchant
  ON hammerex_xrated_merchant_referrals (merchant_listing_id, status, created_at DESC);
-- Dedupe support — 24h last-click sticky enforced at the API layer
-- (date_trunc isn't IMMUTABLE so we can't index on it). The composite
-- non-unique index keeps SELECT fast.
CREATE INDEX IF NOT EXISTS idx_referrals_dedupe
  ON hammerex_xrated_merchant_referrals
    (merchant_listing_id, customer_wa_hash, created_at DESC)
  WHERE status = 'pending' AND customer_wa_hash IS NOT NULL;

-- ─── 3. listing columns ─────────────────────────────────────────────
ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS merchant_commission_rate numeric(5,2)
    CHECK (
      merchant_commission_rate IS NULL
      OR (merchant_commission_rate >= 0 AND merchant_commission_rate <= 50)
    ),
  ADD COLUMN IF NOT EXISTS merchant_commission_min_pence int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS merchant_commission_terms text
    CHECK (
      merchant_commission_terms IS NULL
      OR char_length(merchant_commission_terms) <= 500
    ),
  ADD COLUMN IF NOT EXISTS materials_network_opted_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS materials_network_paused boolean NOT NULL DEFAULT false;

-- ─── 4. earnings view (privacy boundary: NO customer PII) ───────────
CREATE OR REPLACE VIEW hammerex_xrated_tradie_earnings_v AS
SELECT tradie_listing_id,
  COUNT(*) FILTER (WHERE status='pending')    AS pending_count,
  COALESCE(SUM(estimated_cart_total_pence) FILTER (WHERE status='pending'),0)
    AS pending_estimate_pence,
  COUNT(*) FILTER (WHERE status='fulfilled')  AS fulfilled_count,
  COALESCE(SUM(commission_pence) FILTER (WHERE status='fulfilled'),0)
    AS commission_total_pence,
  COUNT(*) FILTER (WHERE status='declined')   AS declined_count
FROM hammerex_xrated_merchant_referrals
GROUP BY tradie_listing_id;

-- ─── 5. push_log stub (Lead Alerts will replace with real web-push) ──
CREATE TABLE IF NOT EXISTS hammerex_xrated_push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL
    REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_log_listing
  ON hammerex_xrated_push_log (listing_id, created_at DESC);

-- ─── 6. updated_at touch trigger ────────────────────────────────────
DROP TRIGGER IF EXISTS hammerex_xrated_merchant_picks_touch
  ON hammerex_xrated_merchant_picks;
CREATE TRIGGER hammerex_xrated_merchant_picks_touch
  BEFORE UPDATE ON hammerex_xrated_merchant_picks
  FOR EACH ROW EXECUTE FUNCTION hammerex_xrated_touch_updated_at();
