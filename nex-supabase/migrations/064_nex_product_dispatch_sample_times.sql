-- ============================================================================
-- NEX-native Migration 064 · Product dispatch + sample-request times
-- ============================================================================
--
-- Sellers tell buyers up front how long a piece takes to ship and,
-- when samples are on offer, how long a sample request takes to
-- fulfil. Both are free-form text so sellers can write what fits
-- their operation:
--
--   dispatch_time         "24-48 hours" · "3-5 business days" · "Same day for Jakarta pickup"
--   sample_request_time   "5-7 days" · "Samples ready weekly · next batch Friday"
--
-- Nullable · empty rows just don't render on the product surfaces.
-- Nothing else in the system depends on these strings · they are
-- purely buyer-facing signals.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '064';
--     ALTER TABLE nex_product
--       DROP COLUMN IF EXISTS dispatch_time,
--       DROP COLUMN IF EXISTS sample_request_time;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_product
  ADD COLUMN IF NOT EXISTS dispatch_time text,
  ADD COLUMN IF NOT EXISTS sample_request_time text;

COMMENT ON COLUMN nex_product.dispatch_time IS
  'Free-form buyer-facing text · how long between order confirmation
   and dispatch. e.g. "24-48 hours" or "3-5 business days".
   Sealed 2026-09-28 · Bridge 13c.';
COMMENT ON COLUMN nex_product.sample_request_time IS
  'Free-form buyer-facing text · how long a sample request takes
   to fulfil when the seller offers samples. e.g. "5-7 days" or
   "Samples ready weekly · next batch Friday".';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '064',
    'nex_product · dispatch_time + sample_request_time text columns',
    'Founder-authorised 2026-09-28. Buyers see turnaround expectations up front · reduces "how long?" round-trips in chat.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'nex_product'
--      AND column_name IN ('dispatch_time','sample_request_time');
