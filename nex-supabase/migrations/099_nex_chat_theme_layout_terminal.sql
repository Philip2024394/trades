-- ============================================================================
-- NEX-native Migration 099 · Cyber Grid · terminal layout_style
-- ============================================================================
--
-- Adds `terminal` to the allowed set for nex_chat_theme.layout_style
-- so the Cyber Grid theme (Founder-set 2026-09-29) can carry its
-- terminal-log feed shape end-to-end (catalogue row → shell renderer).
--
-- Terminal layout preview page:
--   src/app/nex-native/themes/cyber-grid/page.tsx
--
-- Reference reading: theme5text (Founder-supplied 2026-09-29)
--   · monospace font
--   · every row: `> <name> [HH:MM]: <body>`
--   · names colour-coded per participant
--   · blinking cursor block at the composing prompt
--   · deep emerald-black background · theme5.png circuit wallpaper
--
-- Applied via scripts/apply-nex-migration-099.mjs (or inline `psql
-- $DATABASE_URL -f` if you have direct DB access).
--
-- Rollback (never in production):
--   BEGIN;
--     ALTER TABLE nex_chat_theme
--       DROP CONSTRAINT IF EXISTS nex_chat_theme_layout_style_known;
--     ALTER TABLE nex_chat_theme
--       ADD CONSTRAINT nex_chat_theme_layout_style_known
--         CHECK (layout_style IN ('bubbles', 'sky_cards', 'timeline_ribbon'));
--     UPDATE nex_chat_theme SET layout_style = 'bubbles' WHERE id = 'cyber-grid';
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_chat_theme
  DROP CONSTRAINT IF EXISTS nex_chat_theme_layout_style_known;

ALTER TABLE nex_chat_theme
  ADD CONSTRAINT nex_chat_theme_layout_style_known
    CHECK (layout_style IN ('bubbles', 'sky_cards', 'timeline_ribbon', 'terminal'));

COMMENT ON COLUMN nex_chat_theme.layout_style IS
  'Feed shape for this theme · bubbles (default) | sky_cards (Night
   Sky · Theme 1) | timeline_ribbon (Pink Dream · Theme 4) | terminal
   (Cyber Grid · Theme 5). Drives the message-row renderer chosen by
   PortraitBloomShell. Sealed 2026-09-28 · Bridge 34 · terminal added
   2026-09-29.';

UPDATE nex_chat_theme SET layout_style = 'terminal'
  WHERE id = 'cyber-grid' AND layout_style <> 'terminal';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '099',
    'Cyber Grid · nex_chat_theme.layout_style adds terminal · Founder-set 2026-09-29',
    'Extends layout_style CHECK constraint to allow terminal · flips cyber-grid row to terminal · preview at /nex-native/themes/cyber-grid.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-apply verification:
--   SELECT id, layout_style FROM nex_chat_theme WHERE id = 'cyber-grid';
--   -- expect: cyber-grid terminal
-- ============================================================================
