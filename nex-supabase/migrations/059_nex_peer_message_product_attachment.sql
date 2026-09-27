-- ============================================================================
-- NEX-native Migration 059 · Bridge 11 · Product attachment type
-- ============================================================================
--
-- Extends the peer message attachment_type CHECK to include 'product'.
-- Product cards are first-class chat citizens per NEX doctrine ("chat
-- IS the commerce space") · sending a product inquiry attaches a
-- product snapshot to the message so the card renders inline in the
-- bubble stream.
--
-- Snapshot schema (stored in attachment_meta):
--   {
--     "product_id":         "uuid",
--     "business_id":        "uuid",
--     "business_slug":      "aisha-vintage-cameras",
--     "name":               "Leica M3",
--     "price_pence":         285000000,
--     "currency":           "IDR",
--     "image_url":          "https://…",
--     "short_description":  "1954 · double-stroke · CLA'd 2024"
--   }
--
-- attachment_url points at the product's image (so existing thumbnail
-- helpers still work) and attachment_type marks it as a product so
-- the client dispatches to the product-card renderer instead of the
-- image renderer.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '059';
--     ALTER TABLE nex_peer_message
--       DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_type_check;
--     ALTER TABLE nex_peer_message
--       ADD CONSTRAINT nex_peer_message_attachment_type_check
--       CHECK (attachment_type IS NULL
--              OR attachment_type IN ('image', 'video', 'audio'));
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_peer_message
  DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_type_check;

ALTER TABLE nex_peer_message
  ADD CONSTRAINT nex_peer_message_attachment_type_check
  CHECK (
    attachment_type IS NULL
    OR attachment_type IN ('image', 'video', 'audio', 'product')
  );

COMMENT ON COLUMN nex_peer_message.attachment_type IS
  'image | video | audio | product · client dispatches renderer.
   ''product'' means attachment_meta carries a product snapshot
   (name, price, image, description) and the bubble renders an
   inline product card. Sealed 2026-09-27 · Bridge 11.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '059',
    'Bridge 11 · product attachment type on nex_peer_message',
    'Founder-authorised 2026-09-27. Product-in-chat commerce. Snapshot lives in attachment_meta so cards stay renderable even if the product is later deleted.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'nex_peer_message_attachment_type_check';
