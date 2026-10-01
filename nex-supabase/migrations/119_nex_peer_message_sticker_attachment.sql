-- ============================================================================
-- NEX-native Migration 119 · nex_peer_message · sticker attachment type
-- ============================================================================
--
-- Extends nex_peer_message.attachment_type CHECK to allow 'sticker'
-- alongside the existing image / video / audio / product / menu_item /
-- cart_order / product_share types. Companion to Migration 118
-- (nex_theme_sticker) · without this CHECK extension inserts carrying
-- attachment_type='sticker' would fail at the DB layer.
--
-- Founder-sealed 2026-10-01 · aligned with the live sendPeerStickerAction
-- (Server Action) which resolves the authoritative sticker record from
-- nex_theme_sticker and inserts the snapshot into attachment_meta.sticker.
--
-- Rollback:
--   BEGIN;
--     ALTER TABLE nex_peer_message
--       DROP CONSTRAINT IF EXISTS nex_peer_message_attachment_type_check;
--     ALTER TABLE nex_peer_message
--       ADD CONSTRAINT nex_peer_message_attachment_type_check
--       CHECK (
--         attachment_type IS NULL
--         OR attachment_type IN (
--           'image', 'video', 'audio',
--           'product', 'menu_item', 'cart_order', 'product_share'
--         )
--       );
--     DELETE FROM nex_migration_history WHERE version = '119';
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
      'cart_order',
      'product_share',
      'sticker'
    )
  );

COMMENT ON COLUMN nex_peer_message.attachment_type IS
  'image | video | audio | product | menu_item | cart_order | product_share | sticker ·
   client dispatches renderer. sticker uses attachment_url for the
   image + attachment_meta.sticker for the frozen snapshot
   (theme_id, slug, label, sticker_type, aspect_ratio).
   Sealed 2026-10-01 · Bridge ThemeSticker.';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '119',
    'Bridge ThemeSticker · extend nex_peer_message.attachment_type CHECK to allow sticker',
    'Founder-authorised 2026-10-01. Companion to Migration 118 (nex_theme_sticker). Live sendPeerStickerAction resolves authoritative sticker from DB · browser-posted URL / label / type / aspect are never trusted.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
