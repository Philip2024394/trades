-- ============================================================================
-- NEX-native Migration 108 · nex_business.shipping_scope
-- ============================================================================
--
-- Purpose:
--   Persist how the seller fulfils orders so the cover page can render
--   a truthful label ("Local Delivery" / "Local Delivery / Export" /
--   etc.) rather than a hand-typed string.
--
-- Founder direction 2026-09-30:
--   Every shop / restaurant / service provider MUST have the option to
--   pick their shipping scope when setting up. Six values cover the
--   real-world spread:
--
--     · local_delivery      · buyer-local courier / rider only
--     · local_and_export    · local delivery PLUS international export
--     · international_only  · ships internationally only (e.g. drop-ship)
--     · pickup_only         · buyer collects, no delivery at all
--     · dine_in             · restaurant / cafe / bar seat-only
--     · digital             · digital goods, no physical shipping
--
-- Nullable · legacy rows default to NULL. The cover default falls
-- back to "Local Delivery" when NULL so no shop looks broken during
-- rollout. Sellers set the value on /manage/shop.
--
-- No RLS changes · the column travels with the parent row's policies.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '108';
--     ALTER TABLE nex_business
--       DROP CONSTRAINT IF EXISTS nex_business_shipping_scope_check,
--       DROP COLUMN IF EXISTS shipping_scope;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS shipping_scope text;

ALTER TABLE nex_business
  DROP CONSTRAINT IF EXISTS nex_business_shipping_scope_check;

ALTER TABLE nex_business
  ADD CONSTRAINT nex_business_shipping_scope_check
  CHECK (
    shipping_scope IS NULL
    OR shipping_scope IN (
      'local_delivery',
      'local_and_export',
      'international_only',
      'pickup_only',
      'dine_in',
      'digital'
    )
  );

COMMENT ON COLUMN nex_business.shipping_scope IS
  'How the shop fulfils orders. Enum: local_delivery · local_and_export · international_only · pickup_only · dine_in · digital. NULL = unset (cover defaults to Local Delivery). Sealed 2026-09-30.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '108',
    'nex_business.shipping_scope · 6-value CHECK · nullable',
    'Founder-authorised 2026-09-30. Drives the cover page shipping-scope label ("Local Delivery" / "Local Delivery / Export" etc.). Sellers pick on /manage/shop.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'nex_business' AND column_name = 'shipping_scope';
--   SELECT conname FROM pg_constraint
--    WHERE conname = 'nex_business_shipping_scope_check';
