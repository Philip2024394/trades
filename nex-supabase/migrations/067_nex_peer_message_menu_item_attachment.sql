-- ============================================================================
-- NEX-native Migration 067 · Bridge 15c · Menu-item attachment type
-- ============================================================================
--
-- Extends the peer message attachment_type CHECK to include 'menu_item'.
-- Mirrors Bridge 11 (product attachment) for restaurants + cafes ·
-- dishes are first-class chat citizens per NEX doctrine ("chat IS the
-- ordering space") · tapping "Chat about X" on a menu dish attaches a
-- menu-item snapshot to the message so the card renders inline in the
-- bubble stream.
--
-- Snapshot schema (stored in attachment_meta):
--   {
--     "menu_item_id":       "uuid",
--     "business_id":        "uuid",
--     "business_slug":      "priya-mumbai-cafe",
--     "section_name":       "Chai & Filter Coffee",
--     "name":               "Masala Chai",
--     "price_pence":         15000,
--     "currency":           "IDR",
--     "image_url":          "https://…",
--     "short_description":  "Cardamom · ginger · fresh milk · brewed strong",
--     "spice_level":         0,
--     "dietary_tags":       ["vegetarian"],
--     "portion_note":       "300ml"
--   }
--
-- attachment_url points at the dish image (so existing thumbnail
-- helpers still work) and attachment_type marks it as menu_item so
-- the client dispatches to the menu-item card renderer instead of
-- the image renderer.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '067';
--     ALTER TABLE nex_peer_message
--       DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_type_check;
--     ALTER TABLE nex_peer_message
--       ADD CONSTRAINT nex_peer_message_attachment_type_check
--       CHECK (attachment_type IS NULL
--              OR attachment_type IN ('image', 'video', 'audio', 'product'));
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_peer_message
  DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_type_check;

ALTER TABLE nex_peer_message
  ADD CONSTRAINT nex_peer_message_attachment_type_check
  CHECK (
    attachment_type IS NULL
    OR attachment_type IN ('image', 'video', 'audio', 'product', 'menu_item')
  );

COMMENT ON COLUMN nex_peer_message.attachment_type IS
  'image | video | audio | product | menu_item · client dispatches renderer.
   ''product'' means attachment_meta carries a product snapshot; ''menu_item''
   means it carries a dish snapshot (name, price, image, dietary, spice,
   portion) and the bubble renders an inline dish card. Sealed 2026-09-28 ·
   Bridge 15c.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '067',
    'Bridge 15c · menu_item attachment type on nex_peer_message',
    'Founder-authorised 2026-09-28. Dish-in-chat for restaurants + cafes. Snapshot lives in attachment_meta so cards stay renderable even if the dish is later deleted or edited.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'nex_peer_message_attachment_type_check';
