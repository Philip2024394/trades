-- ============================================================================
-- NEX-native Migration 074 · Bridge 18 · Liked products
-- ============================================================================
--
-- Buyers can heart products they encounter (shared in chat by a
-- friend, browsed on any shop landing) and revisit the collection
-- on /nex-native/liked. Unique (liker, product) pair so a heart is
-- idempotent · toggling flips the state cleanly.
--
-- Referential integrity:
--   · ON DELETE CASCADE from nex_account · when a user deletes
--     their account, their likes vanish with them
--   · ON DELETE CASCADE from nex_product · when a seller archives
--     a product, the like disappears (it can no longer be opened)
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '074';
--     DROP TABLE IF EXISTS nex_liked_product;
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_liked_product (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liker_account_id    uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES nex_product(id) ON DELETE CASCADE,
  liked_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (liker_account_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_nex_liked_product_liker
  ON nex_liked_product (liker_account_id, liked_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_liked_product_product
  ON nex_liked_product (product_id);

COMMENT ON TABLE nex_liked_product IS
  'Buyer-facing product likes · toggled via a heart on the product
   card or bubble · surfaced on /nex-native/liked. Sealed
   2026-09-28 · Bridge 18.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '074',
    'Bridge 18 · nex_liked_product · buyer-hearted product collection',
    'Founder-authorised 2026-09-28. Buyers can save products from any shop (shared in chat or discovered on a landing) to a personal liked list at /nex-native/liked. Bulk-delete + per-item delete + open-in-shop.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
