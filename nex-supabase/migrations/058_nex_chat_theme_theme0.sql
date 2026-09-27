-- ============================================================================
-- NEX-native Migration 058 · Theme 0 · The NEX standard arrival theme
-- ============================================================================
--
-- Formalises the existing 'default' theme as "Theme 0" · the clean,
-- dark-navy surface every new user arrives to see. Deliberately quiet
-- and empty:
--   · no hero wallpaper (bare #020914 dark navy shell)
--   · no wallpaper_config (no moon glow, no crows, no ambient overlay)
--   · NEX-cyan accent (#00AFFF) so bubbles + composer read as
--     signature NEX identity
--   · sort_order 0 · appears first in the theme picker before Theme 1
--
-- The theme's DB id stays 'default' so no existing accounts break ·
-- only the surfaced name changes to "Theme 0" and the position in the
-- picker moves to the top. Any future re-branding of the ID can be
-- done atomically with an account UPDATE.
--
-- Doctrine · Theme 0 is where scarcity lives. Theme 1 (Night Sky) is
-- the first environment · Theme 2, 3… will each be their own world.
-- Users pick their environment via /nex-native/settings/theme; Theme
-- 0 is what they see before they ever choose.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '058';
--     UPDATE nex_chat_theme SET name='Origin', sort_order=10
--       WHERE id='default';
--   COMMIT;
-- ============================================================================

BEGIN;

UPDATE nex_chat_theme
   SET name = 'Theme 0',
       tagline = 'The NEX standard · dark navy sky · your arrival home',
       -- Ensure the arrival theme carries NO wallpaper + NO overlay ·
       -- Theme 0's whole point is a quiet, empty canvas.
       hero_image_url = NULL,
       wallpaper_config = NULL,
       accent_hex = '#00AFFF',
       bubble_rim_hex = NULL,
       composer_rim_hex = NULL,
       sort_order = 0,
       is_active = true,
       tier = 'gratis',
       category = 'standard',
       updated_at = now()
 WHERE id = 'default';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '058',
    'Theme 0 · NEX standard arrival theme · renamed from Origin · dark navy · no wallpaper · sort_order 0',
    'Founder-authorised 2026-09-27. The arrival theme every new user sees before they pick their own environment. Quiet by design.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT id, name, sort_order, hero_image_url, wallpaper_config
--     FROM nex_chat_theme WHERE id='default';
--   SELECT id, name FROM nex_chat_theme ORDER BY sort_order LIMIT 3;
