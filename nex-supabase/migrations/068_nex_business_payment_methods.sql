-- ============================================================================
-- NEX-native Migration 068 · Bridge 16a · Seller-selected payment methods
-- ============================================================================
--
-- Adds `accepted_payment_methods text[]` to nex_business so sellers can
-- declare which of the five NEX safe-trade chips they support. Buyers
-- see the chips on the shop landing and in the order-quote card.
--
-- Doctrine (sealed 2026-09-28 · doctrine_nex_never_handles_payments):
--   NEX never handles payments. Buyer is always safe: they never pay
--   before receiving unless a third party they trust is holding the
--   money. The five chips satisfy that promise.
--
-- Canonical chip slugs (kept short so they fit URL / analytics):
--   cod            · Cash on Delivery (driver collects at door)
--   qris_delivery  · QRIS on Delivery (buyer scans QR when package arrives)
--   courier_cod    · Courier COD (JNE/J&T/SiCepat/AnterAja holds + remits)
--   meetup         · Meet in Person (buyer inspects live, pays cash)
--   escrow         · Rekber / Xendit / Midtrans / DOKU (buyer picks provider)
--   paypal         · PayPal G&S (international · Bisnis-only)
--
-- Default = ['cod'] · every new shop is COD-out-of-the-box which is
-- the safest possible starting point for buyer trust.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '068';
--     ALTER TABLE nex_business DROP COLUMN IF EXISTS accepted_payment_methods;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_business
  ADD COLUMN IF NOT EXISTS accepted_payment_methods text[]
    NOT NULL DEFAULT ARRAY['cod']::text[];

-- Constrain values to the canonical vocabulary. Extending later is a
-- simple constraint DROP + re-ADD.
ALTER TABLE nex_business
  DROP CONSTRAINT IF EXISTS nex_business_accepted_payment_methods_check;

ALTER TABLE nex_business
  ADD CONSTRAINT nex_business_accepted_payment_methods_check
  CHECK (
    accepted_payment_methods <@ ARRAY[
      'cod',
      'qris_delivery',
      'courier_cod',
      'meetup',
      'escrow',
      'paypal'
    ]::text[]
    AND array_length(accepted_payment_methods, 1) >= 1
  );

COMMENT ON COLUMN nex_business.accepted_payment_methods IS
  'Buyer-facing safe-trade chips the seller supports. Subset of
   {cod, qris_delivery, courier_cod, meetup, escrow, paypal}. Default
   ["cod"]. Sealed 2026-09-28 · Bridge 16a. Doctrine: NEX never handles
   payments · buyer is always safe.';

-- Backfill any legacy rows that might have somehow got a NULL despite
-- the DEFAULT (shouldn't happen but cheap to be robust).
UPDATE nex_business
  SET accepted_payment_methods = ARRAY['cod']::text[]
  WHERE accepted_payment_methods IS NULL
     OR array_length(accepted_payment_methods, 1) IS NULL
     OR array_length(accepted_payment_methods, 1) < 1;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '068',
    'Bridge 16a · nex_business.accepted_payment_methods for safe-trade chip selector',
    'Founder-authorised 2026-09-28. Sellers declare which of the five NEX-supported buyer-safety chips they accept (cod, qris_delivery, courier_cod, meetup, escrow, paypal). Default cod-only. Buyers see the chips on the shop landing and safe-trade page.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'nex_business' AND column_name = 'accepted_payment_methods';
--   SELECT accepted_payment_methods FROM nex_business LIMIT 5;
