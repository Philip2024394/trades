-- ============================================================================
-- NEX-native Migration 076 · Bridge 21 · Seller return policy
-- ============================================================================
--
-- Every seller gets a return policy · defaults comply with Indonesia
-- consumer protection law (Undang-Undang No 8 tahun 1999):
--   · 7-day return window for defective / wrong-item / not-as-
--     described / damaged-in-transit
--   · Refund within 3 working days once return is accepted
--   · Buyer pays return shipping unless item is defective
--   · No restocking fee by default
--
-- The seller can extend windows and add custom notes but they cannot
-- weaken the legal-minimum policy · the buyer page always shows the
-- minimum with a note if the seller's policy is below it.
--
-- Stored as a jsonb column so we can evolve keys without schema
-- migrations. Rendered on:
--   · /nex-native/[businessSlug]/returns (dedicated buyer page)
--   · /nex-native/[businessSlug]/[productId] (small Returns pill link)
--   · Safe-trade "check seller's return policy" links here
--   · /manage/shop (seller edits inline)
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '076';
--     ALTER TABLE nex_business DROP COLUMN IF EXISTS return_policy;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS return_policy jsonb NOT NULL DEFAULT jsonb_build_object(
    'accepts_returns',        true,
    'window_days',            7,
    'refund_days',            3,
    'accepts_reasons',        jsonb_build_array(
                                'defective',
                                'wrong_item',
                                'not_as_described',
                                'damaged_in_transit'
                              ),
    'shipping_paid_by',       'buyer_unless_defective',
    'restocking_fee_percent', 0,
    'non_returnable',         jsonb_build_array(),
    'notes',                  null
  );

COMMENT ON COLUMN nex_business.return_policy IS
  'Seller return policy · JSONB. Keys:
     accepts_returns        boolean · default true
     window_days            integer · 0-90 · default 7 (Indonesian
                            legal min)
     refund_days            integer · 1-14 · default 3 (Indonesian
                            legal min)
     accepts_reasons        text[] · subset of {defective,
                            wrong_item, not_as_described,
                            damaged_in_transit, changed_mind,
                            sized_wrong, arrived_late}
     shipping_paid_by       "buyer" | "seller" | "split" |
                            "buyer_unless_defective" (default)
     restocking_fee_percent integer · 0-25 · default 0
     non_returnable         text[] · category tags the seller
                            excludes from returns (e.g.
                            perishable, custom_made, digital)
     notes                  text · free-form seller additions
   Sealed 2026-09-28 · Bridge 21.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '076',
    'Bridge 21 · nex_business.return_policy JSONB with Indonesian legal-min defaults',
    'Founder-authorised 2026-09-28. Every seller gets a return policy · default complies with UU No 8/1999 · 7-day return window + 3-day refund + defective/wrong-item/not-as-described accepted. Seller edits inline on /manage/shop · buyers see it on /[shop]/returns and via a pill on every product detail page.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
