-- Trade Center Picks — replace the boolean delivery_available with a
-- 3-value option enum (next_day / same_day / collection_only) so the
-- merchant can communicate exactly what shipping the customer can
-- expect — instead of just a binary "yes we deliver" tick.
--
-- delivery_available stays for backwards compat (old picks still show
-- the chip when the new column is null). New picks should set
-- delivery_option; legacy picks where delivery_available=true get
-- migrated to delivery_option='next_day' as a sensible default.

ALTER TABLE hammerex_xrated_trade_center_picks
  ADD COLUMN IF NOT EXISTS delivery_option text
    CHECK (delivery_option IS NULL OR delivery_option IN
      ('next_day', 'same_day', 'collection_only'));
