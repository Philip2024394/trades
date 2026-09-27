-- ============================================================================
-- NEX-native Migration 056 · Theme wallpaper configuration
-- ============================================================================
--
-- Adds a wallpaper_config JSONB column to nex_chat_theme so each theme
-- can carry its own environmental settings — moon glow position, size,
-- and colour — without hardcoding them in the shell. Enables future
-- themes to declare their own moon (or sun, or lantern, or nothing at
-- all) as part of the theme record itself.
--
-- Schema:
--   wallpaper_config jsonb · NULL when a theme has no environmental
--     overlay. When set, may contain:
--       moonGlow: { x: "72%", y: "calc(11% - 15px)", size: 180,
--                   color: "rgba(225, 238, 255, 0.6)" }
--
-- The shell reads this via the chat-theme-service and passes it into
-- AmbientMotion. Themes without wallpaper_config get no moon glow.
--
-- Seed:
--   Rose (id 'pink') gets the theme3.png moon glow config baked into
--   its row so the DB is the source of truth · no more hardcoded
--   values in the client.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '056';
--     ALTER TABLE nex_chat_theme DROP COLUMN IF EXISTS wallpaper_config;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE nex_chat_theme
  ADD COLUMN IF NOT EXISTS wallpaper_config jsonb;

COMMENT ON COLUMN nex_chat_theme.wallpaper_config IS
  'Per-theme environmental overlay settings. NULL for themes with no
   overlay. May contain moonGlow{ x, y, size, color }. Sealed
   2026-09-27 · migration 056.';

-- Seed Rose · theme3.png night-sky wallpaper · moon in the upper-right
-- at ~72% left, 11% top with a 15px lift · 180px cool-white halo.
UPDATE nex_chat_theme
   SET wallpaper_config = jsonb_build_object(
         'moonGlow', jsonb_build_object(
           'x', '72%',
           'y', 'calc(11% - 15px)',
           'size', 180,
           'color', 'rgba(225, 238, 255, 0.6)'
         )
       ),
       updated_at = now()
 WHERE id = 'pink';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '056',
    'wallpaper_config jsonb column on nex_chat_theme · Rose seeded with moon glow config',
    'Founder-authorised 2026-09-27. First theme (Rose) saves all details in the DB · moon glow no longer hardcoded in the shell. Future themes declare their own environmental overlay via this column.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT id, name, wallpaper_config FROM nex_chat_theme WHERE id = 'pink';
