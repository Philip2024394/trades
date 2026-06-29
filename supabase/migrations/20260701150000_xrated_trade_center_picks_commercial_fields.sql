-- Trade Center Picks — six optional commercial-detail columns powering
-- the new dedicated /<slug>/picks/<pickId> detail page.
--
-- All columns nullable: missing fields render NOTHING on the public
-- page (silence is the default — no "Not specified" prompt). Labels
-- generalise across merchant categories (shed → hand tool → workwear →
-- paving), so "Installation available" not "Site fitting" and
-- "Delivery available" not "Yard delivery".

ALTER TABLE hammerex_xrated_trade_center_picks
  ADD COLUMN IF NOT EXISTS long_description text
    CHECK (long_description IS NULL OR char_length(long_description) <= 1200),
  ADD COLUMN IF NOT EXISTS cta_price_pence integer
    CHECK (cta_price_pence IS NULL OR cta_price_pence >= 0),
  ADD COLUMN IF NOT EXISTS cta_price_label text
    CHECK (cta_price_label IS NULL OR char_length(cta_price_label) <= 60),
  ADD COLUMN IF NOT EXISTS arrival_window_label text
    CHECK (arrival_window_label IS NULL OR char_length(arrival_window_label) <= 60),
  ADD COLUMN IF NOT EXISTS delivery_available boolean,
  ADD COLUMN IF NOT EXISTS installation_available boolean;
