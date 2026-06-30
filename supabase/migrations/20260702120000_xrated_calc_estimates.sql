-- Shareable Material Calculator estimates.
--
-- Each row captures a calculator run a customer wanted to share — the
-- inputs they entered, the output (lines + warnings + materials total),
-- and a link back to the listing + originating product. The shared
-- estimate page at /shared-estimate/<id> reads this row and renders a
-- read-only view the customer can text to their contractor or save for
-- later.
--
-- Public-readable (no auth needed to view a shared link). Writes
-- restricted to the service role via the API.

CREATE TABLE IF NOT EXISTS hammerex_xrated_calc_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES hammerex_trade_off_listings(id) ON DELETE CASCADE,
  product_id uuid NULL REFERENCES hammerex_xrated_products(id) ON DELETE SET NULL,
  calculator_type text NOT NULL,
  inputs jsonb NOT NULL,
  output jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xrated_calc_estimates_listing
  ON hammerex_xrated_calc_estimates(listing_id, created_at DESC);

ALTER TABLE hammerex_xrated_calc_estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calc_estimates_public_read ON hammerex_xrated_calc_estimates;
CREATE POLICY calc_estimates_public_read
  ON hammerex_xrated_calc_estimates
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS calc_estimates_service_all ON hammerex_xrated_calc_estimates;
CREATE POLICY calc_estimates_service_all
  ON hammerex_xrated_calc_estimates
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
