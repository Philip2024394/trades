-- Trade Center Picks — drop the `in_stock` status.
--
-- "In stock" is implicit: if a product is on the picks banner at all,
-- it's available. The status enum exists to flag a PROMOTIONAL signal
-- (promo / new arrival / just landed / pre-order). Keeping "in stock"
-- diluted that signal. Migration drops the row from the CHECK
-- constraint and converts any existing `in_stock` rows to `new_arrival`
-- as a safe default — the merchant can edit later if they want.

UPDATE hammerex_xrated_trade_center_picks
SET status = 'new_arrival'
WHERE status = 'in_stock';

ALTER TABLE hammerex_xrated_trade_center_picks
  DROP CONSTRAINT IF EXISTS hammerex_xrated_trade_center_picks_status_check;

ALTER TABLE hammerex_xrated_trade_center_picks
  ADD CONSTRAINT hammerex_xrated_trade_center_picks_status_check
  CHECK (status IN ('on_promo','new_arrival','just_arrived','pre_order'));
