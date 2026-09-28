-- ============================================================================
-- NEX-native Migration 077 · Bridge 22 · Cart-order attachment type
-- ============================================================================
--
-- Extends nex_peer_message.attachment_type to include 'cart_order' ·
-- Bridge 22's Shopping Cart posts a rich, structured cart bubble
-- into the seller's peer chat when the buyer taps Send.
--
-- Snapshot lives in attachment_meta.cart:
--   {
--     "shop_id":            "uuid",
--     "shop_slug":          "aisha-vintage-cameras",
--     "shop_display_name":  "Aisha's Vintage Cameras",
--     "items": [
--       {
--         "kind":         "product" | "menu_item",
--         "id":           "uuid",
--         "name":         "Leica M3",
--         "price_pence":  28500000,
--         "currency":     "IDR",
--         "quantity":     1,
--         "variants":     ["Black paint", "Body + Summicron"],
--         "note":         "please pack extra bubble wrap",
--         "image_url":    "https://…"
--       }
--     ],
--     "buyer_notes":       "delivery to Kemang · Sat afternoon ok",
--     "subtotal_pence":    28500000,
--     "currency":          "IDR",
--     "item_count":        1
--   }
--
-- attachment_url is optional · when present, it points at the first
-- item's image for the bubble thumbnail. attachment_type='cart_order'
-- tells the client to render the rich cart card.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '077';
--     ALTER TABLE nex_peer_message
--       DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_type_check;
--     ALTER TABLE nex_peer_message
--       ADD CONSTRAINT nex_peer_message_attachment_type_check
--       CHECK (attachment_type IS NULL
--              OR attachment_type IN ('image','video','audio','product','menu_item'));
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_peer_message
  DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_type_check;

ALTER TABLE nex_peer_message
  ADD CONSTRAINT nex_peer_message_attachment_type_check
  CHECK (
    attachment_type IS NULL
    OR attachment_type IN (
      'image',
      'video',
      'audio',
      'product',
      'menu_item',
      'cart_order'
    )
  );

COMMENT ON COLUMN nex_peer_message.attachment_type IS
  'image | video | audio | product | menu_item | cart_order · client
   dispatches renderer. cart_order carries the whole cart in
   attachment_meta.cart · rich multi-item bubble. Sealed 2026-09-28 ·
   Bridge 22.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '077',
    'Bridge 22 · cart_order attachment type on nex_peer_message',
    'Founder-authorised 2026-09-28. Multi-item cart posted from /nex-native/cart into the seller''s peer chat · lands as a rich card with item list, quantities, per-item notes, buyer notes, subtotal.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
