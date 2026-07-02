-- Trade Connections add-on — phase 1.
--
-- Adds:
--   1. trade_connections_radius_km on the listing — merchant configures
--      how far from their yard (km) to surface trades. Default 25 km,
--      sensible UK suburban radius. Capped 1-200.
--   2. hammerex_xrated_trade_connections_events — per-event log of
--      every customer interaction with the Trade Connections carousel:
--        view_trade        — customer tapped a trade card
--        return_to_merchant — floating back-button used
--        whatsapp_trade   / call_trade — direct CTA tapped
--      Lets the merchant dashboard show "47 viewed / 31 returned / 8
--      bought" proof of value over time.

ALTER TABLE hammerex_trade_off_listings
  ADD COLUMN IF NOT EXISTS trade_connections_radius_km integer NOT NULL DEFAULT 25;

ALTER TABLE hammerex_trade_off_listings
  DROP CONSTRAINT IF EXISTS chk_trade_connections_radius;
ALTER TABLE hammerex_trade_off_listings
  ADD CONSTRAINT chk_trade_connections_radius
  CHECK (trade_connections_radius_km BETWEEN 1 AND 200);

CREATE TABLE IF NOT EXISTS hammerex_xrated_trade_connections_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_listing_id uuid NOT NULL REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  trade_listing_id uuid NULL REFERENCES hammerex_trade_off_listings(id) ON DELETE SET NULL,
  product_id uuid NULL REFERENCES hammerex_xrated_products(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (
    action IN ('view_trade', 'return_to_merchant', 'whatsapp_trade', 'call_trade')
  ),
  session_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tc_events_merchant
  ON hammerex_xrated_trade_connections_events(merchant_listing_id, created_at DESC);

ALTER TABLE hammerex_xrated_trade_connections_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tc_events_service ON hammerex_xrated_trade_connections_events;
CREATE POLICY tc_events_service
  ON hammerex_xrated_trade_connections_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
