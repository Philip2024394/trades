-- ============================================================================
-- NEX-native Migration 020 · nex_order.merchant_note · merchant-only note
-- ============================================================================
--
-- Purpose:
--   Wave A Slice 4f · symmetric counterpart to Slice 4c's customer_note.
--   The merchant attaches an internal note to an order (dispatch tracking
--   ID · special handling · dispute reason · anything the seller wants to
--   remember about this specific order). NOT visible to the customer.
--
-- Doctrine:
--   · Anti-fabrication · nullable · never invented for the merchant
--   · Visible only on the merchant fulfilment queue · NEVER rendered on
--     the customer-facing order status page (enforced in the UI layer)
--   · Editable at any state (unlike customer_note which is fixed at
--     placement) · merchants often update tracking IDs after paid
--   · Storage-layer cap: 500 chars (CHECK)
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '020';
--     ALTER TABLE nex_order DROP CONSTRAINT IF EXISTS nex_order_merchant_note_length;
--     ALTER TABLE nex_order DROP COLUMN IF EXISTS merchant_note;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_order
  ADD COLUMN IF NOT EXISTS merchant_note text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_order_merchant_note_length'
       AND conrelid = 'nex_order'::regclass
  ) THEN
    ALTER TABLE nex_order
      ADD CONSTRAINT nex_order_merchant_note_length CHECK (
        merchant_note IS NULL OR char_length(merchant_note) <= 500
      );
  END IF;
END $$;

COMMENT ON COLUMN nex_order.merchant_note IS
  'Merchant-internal note on an order · max 500 chars · nullable · editable at any state · NEVER shown on the customer-facing order status page.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '020',
    'nex_order.merchant_note · nullable text · 500 char cap',
    'Wave A Slice 4f · Founder-authorised keypad build 2026-09-24. Symmetric counterpart to customer_note (Slice 4c · migration 019). Merchant-only visibility · editable at any state.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'nex_order' AND column_name = 'merchant_note';
--     -- expect: merchant_note · text · YES
--
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'nex_order'::regclass
--      AND conname = 'nex_order_merchant_note_length';
--     -- expect: 1 row
-- ============================================================================
