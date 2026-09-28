-- ============================================================================
-- NEX-native Migration 085 · Bridge 34 · Theme layout_style
-- ============================================================================
--
-- Adds a `layout_style` column to nex_chat_theme so a theme catalog row
-- carries not just its COLOURS + WALLPAPER but also its FEED SHAPE.
--
-- Founder direction 2026-09-28: sealed theme designs at
-- /nex-native/themes/theme-1 (Sky Cards) and /nex-native/themes/pink-dream
-- (Timeline Ribbon) must be the design every user with that
-- chat_theme sees on their actual peer chat surface. Colours-only
-- theming isn't enough · the FEED SHAPE must also travel with the
-- theme id.
--
-- Values (CHECK-constrained):
--   'bubbles'          · classic Portrait Bloom bubble feed · default
--                        for every existing theme so nothing changes
--                        for users who haven't picked theme-1 or
--                        pink-dream.
--   'sky_cards'        · cloud-shaped panels attached to left/right
--                        screen edges · sealed as Theme 1 (Night Sky).
--   'timeline_ribbon'  · tab-slate panels attached to left/right screen
--                        edges · sealed as Theme 4 (Pink Dream).
--
-- Seed values:
--   theme-1     → 'sky_cards'
--   pink-dream  → 'timeline_ribbon'
--   everything else → 'bubbles' (default)
--
-- Application binding · PortraitBloomShell reads this column via
-- chat-theme-service.resolveThemeColours and swaps the bubble
-- rendering for the theme-specific feed shape when set.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '085';
--     ALTER TABLE nex_chat_theme
--       DROP CONSTRAINT IF EXISTS nex_chat_theme_layout_style_known,
--       DROP COLUMN IF EXISTS layout_style;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_chat_theme
  ADD COLUMN IF NOT EXISTS layout_style text NOT NULL DEFAULT 'bubbles';

ALTER TABLE nex_chat_theme
  DROP CONSTRAINT IF EXISTS nex_chat_theme_layout_style_known;

ALTER TABLE nex_chat_theme
  ADD CONSTRAINT nex_chat_theme_layout_style_known
    CHECK (layout_style IN ('bubbles', 'sky_cards', 'timeline_ribbon'));

COMMENT ON COLUMN nex_chat_theme.layout_style IS
  'Feed shape for this theme · bubbles (default) | sky_cards (Night
   Sky · Theme 1) | timeline_ribbon (Pink Dream · Theme 4). Drives
   the message-row renderer chosen by PortraitBloomShell. Sealed
   2026-09-28 · Bridge 34.';

-- Seed values · idempotent updates for the two themes with
-- non-default feed shapes. Missing rows are silently skipped
-- because these theme rows are seeded by earlier migrations
-- (057 theme-1, 081 pink-dream).
UPDATE nex_chat_theme SET layout_style = 'sky_cards'
  WHERE id = 'theme-1' AND layout_style <> 'sky_cards';

UPDATE nex_chat_theme SET layout_style = 'timeline_ribbon'
  WHERE id = 'pink-dream' AND layout_style <> 'timeline_ribbon';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '085',
    'Bridge 34 · nex_chat_theme.layout_style · feed shape travels with theme id',
    'Founder-authorised 2026-09-28. Sealed theme designs (Sky Cards · Timeline Ribbon) now propagate from the preview pages to every user with the matching chat_theme.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT id, layout_style FROM nex_chat_theme ORDER BY id;
--   -- expect: theme-1 sky_cards · pink-dream timeline_ribbon · rest bubbles
