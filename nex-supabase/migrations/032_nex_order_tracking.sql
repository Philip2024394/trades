-- ============================================================================
-- NEX-native Migration 032 · nex_order.dispatch_tracking_url · Slice 4g
-- ============================================================================
-- Wave B Slice 4g · merchant-provided dispatch / tracking URL surfaced to
-- the customer on the /nex-native/orders/[orderId] page. Purely informational
-- URL string · we don't parse carrier or interpret status · that's the
-- merchant's responsibility.
--
-- Storage:
--   · text nullable · null = no tracking url set
--   · CHECK length <= 1024 (defence against pathological input · matches
--     other URL fields in nex_business e.g. website_url).
--   · Deeper URL pattern (http/https prefix) validated app-side in
--     order-service.updateOrderTracking.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '032';
--     ALTER TABLE nex_order DROP CONSTRAINT IF EXISTS nex_order_tracking_length;
--     ALTER TABLE nex_order DROP COLUMN IF EXISTS dispatch_tracking_url;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_order
  ADD COLUMN IF NOT EXISTS dispatch_tracking_url text;

ALTER TABLE nex_order
  DROP CONSTRAINT IF EXISTS nex_order_tracking_length;
ALTER TABLE nex_order
  ADD CONSTRAINT nex_order_tracking_length
    CHECK (dispatch_tracking_url IS NULL OR char_length(dispatch_tracking_url) <= 1024);

COMMENT ON COLUMN nex_order.dispatch_tracking_url IS
  'Merchant-provided dispatch or tracking URL · ≤1024 · surfaced to customer on order status page · null = not set.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '032',
    'nex_order.dispatch_tracking_url · optional merchant tracking URL · ≤1024',
    'Wave B Slice 4g · deep URL shape validation (http/https prefix) lives in order-service.updateOrderTracking.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
