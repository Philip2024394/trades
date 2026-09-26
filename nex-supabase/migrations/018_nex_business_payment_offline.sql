-- ============================================================================
-- NEX-native Migration 018 · offline-payment fields on nex_business
-- ============================================================================
--
-- Purpose:
--   Wave A Slice 4b · unblocked by Founder offline-payment doctrine
--   2026-09-24. Customers place orders as normal · payment is settled
--   OUT-OF-BAND between seller and buyer · NEX is not the counterparty.
--
--   Adds three nullable merchant-editable fields to nex_business:
--     · payment_instructions · text (max 2000 chars · storage cap enforced
--       by CHECK · shown to buyer on order status page · merchant explains
--       how to pay — bank transfer details, etc.)
--     · accepts_cod           · boolean · default false · merchant flag ·
--       "cash on delivery" available
--     · accepts_pickup        · boolean · default false · merchant flag ·
--       "collect + pay in person" available
--
-- Doctrine references:
--   · doctrine_nex_payment_offline_2026_09_24 · sealed 2026-09-24
--   · Identity Doctrine · public_phone / public_email remain ATTRIBUTES ·
--     never relationship keys · this migration adds NO new relationships
--   · ADR-0003b Cl. 8 · 0% platform fee default unchanged · offline flow
--     doesn't change commercial percentages
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '018';
--     ALTER TABLE nex_business DROP CONSTRAINT IF EXISTS nex_business_payment_instructions_length;
--     ALTER TABLE nex_business
--       DROP COLUMN IF EXISTS payment_instructions,
--       DROP COLUMN IF EXISTS accepts_cod,
--       DROP COLUMN IF EXISTS accepts_pickup;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS payment_instructions text,
  ADD COLUMN IF NOT EXISTS accepts_cod           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_pickup        boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nex_business_payment_instructions_length'
       AND conrelid = 'nex_business'::regclass
  ) THEN
    ALTER TABLE nex_business
      ADD CONSTRAINT nex_business_payment_instructions_length CHECK (
        payment_instructions IS NULL OR char_length(payment_instructions) <= 2000
      );
  END IF;
END $$;

COMMENT ON COLUMN nex_business.payment_instructions IS
  'Merchant-editable free-text payment instructions shown to buyer on order status page · max 2000 chars · nullable · ATTRIBUTE only.';
COMMENT ON COLUMN nex_business.accepts_cod IS
  'Merchant flag · true when the merchant accepts cash-on-delivery for their orders · defaults false · Founder offline-payment doctrine 2026-09-24.';
COMMENT ON COLUMN nex_business.accepts_pickup IS
  'Merchant flag · true when the merchant supports customer pickup with in-person payment · defaults false · Founder offline-payment doctrine 2026-09-24.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '018',
    'nex_business · payment_instructions + accepts_cod + accepts_pickup (offline payment)',
    'Wave A Slice 4b · Founder offline-payment doctrine sealed 2026-09-24. NEX is NOT the payment counterparty · seller and buyer settle out-of-band via NEX Chat, bank transfer, COD, or in-person pickup. No PSP integration in MVP.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification:
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'nex_business'
--      AND column_name IN ('payment_instructions','accepts_cod','accepts_pickup')
--    ORDER BY column_name;
--     -- expect: 3 rows · booleans default false · payment_instructions text nullable
--
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'nex_business'::regclass
--      AND conname = 'nex_business_payment_instructions_length';
--     -- expect: 1 row
-- ============================================================================
