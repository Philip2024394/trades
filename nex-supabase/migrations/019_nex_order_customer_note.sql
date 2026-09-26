-- ============================================================================
-- NEX-native Migration 019 · nex_order.customer_note · buyer note at placement
-- ============================================================================
--
-- Purpose:
--   Wave A Slice 4c · let the buyer attach a short note when placing an
--   order (e.g. "please deliver Tuesday" · "let me know pickup times").
--   Visible to the merchant on the fulfilment queue and to the buyer on
--   their own order status page.
--
-- Doctrine:
--   · Anti-fabrication · nullable · never invented for the buyer
--   · Immutable at order layer: buyer sets it at placement · we do NOT
--     expose an "edit note" action in Slice 4c (deferred · can be added
--     later without schema change if desired)
--   · Storage-layer cap: 500 chars (CHECK). App-side trim + normalisation.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '019';
--     ALTER TABLE nex_order DROP CONSTRAINT IF EXISTS nex_order_customer_note_length;
--     ALTER TABLE nex_order DROP COLUMN IF EXISTS customer_note;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_order
  ADD COLUMN IF NOT EXISTS customer_note text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_order_customer_note_length'
       AND conrelid = 'nex_order'::regclass
  ) THEN
    ALTER TABLE nex_order
      ADD CONSTRAINT nex_order_customer_note_length CHECK (
        customer_note IS NULL OR char_length(customer_note) <= 500
      );
  END IF;
END $$;

COMMENT ON COLUMN nex_order.customer_note IS
  'Optional buyer note set at order placement · max 500 chars · visible to both merchant fulfilment queue and buyer order status page · not editable after placement in the pilot.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '019',
    'nex_order.customer_note · nullable text · 500 char cap',
    'Wave A Slice 4c · Founder-authorised keypad build 2026-09-24. Buyer attaches a short delivery/pickup/context note at placement time. Not editable after placement in the pilot.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'nex_order' AND column_name = 'customer_note';
--     -- expect: customer_note · text · YES
--
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'nex_order'::regclass
--      AND conname = 'nex_order_customer_note_length';
--     -- expect: 1 row
-- ============================================================================
