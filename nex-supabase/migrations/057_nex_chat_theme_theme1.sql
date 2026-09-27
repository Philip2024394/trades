-- ============================================================================
-- NEX-native Migration 057 · Theme 1 · Night Sky
-- ============================================================================
--
-- Seals the first fully-configured NEX theme as its own catalogue
-- entry — separate from the sealed Rose row. Theme 1 owns the
-- theme3.png night-sky wallpaper, the moon halo, the blue bubble
-- rim, and the orange composer rim. Every detail lives in the DB
-- so re-seeding or a fresh clone reproduces the theme exactly.
--
-- Also migrates Maria Santos from Rose (chat_theme='pink') to
-- Theme 1 (chat_theme='theme-1') so her chat surface reflects the
-- theme she was designed to preview.
--
-- Rose is left in place as its own theme · the pink accent record
-- returns to its clean state (no wallpaper, no wallpaper_config).
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '057';
--     UPDATE nex_account SET chat_theme='pink'
--      WHERE chat_theme='theme-1';
--     DELETE FROM nex_chat_theme WHERE id='theme-1';
--     -- (Optionally restore Rose's previous wallpaper if needed)
--   COMMIT;
-- ============================================================================

BEGIN;

-- Drop the hardcoded chat_theme CHECK constraint · it whitelists
-- 'default','titanium','pink','gold','night' and blocks every new
-- theme we add to nex_chat_theme. The theme catalogue table is the
-- source of truth · we don't need a CHECK duplicate. Aurora, sunset,
-- obsidian, and now theme-1 all bypass this constraint by design.
ALTER TABLE nex_account
  DROP CONSTRAINT IF EXISTS nex_account_chat_theme_known;

-- Insert Theme 1 · Night Sky.
INSERT INTO nex_chat_theme (
  id,
  name,
  tagline,
  accent_hex,
  bubble_rim_hex,
  composer_rim_hex,
  tier,
  category,
  hero_image_url,
  wallpaper_config,
  is_active,
  sort_order
)
VALUES (
  'theme-1',
  'Theme 1',
  'Night sky · moon over the mountains · crows drifting through the dark',
  '#7EB6FF',
  '#009FEF',
  '#FF7800',
  'gratis',
  'standard',
  'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-theme-hero/maria-santos-hero-1790481483761.png',
  jsonb_build_object(
    'moonGlow', jsonb_build_object(
      'x', '72%',
      'y', 'calc(11% - 15px)',
      'size', 180,
      'color', 'rgba(225, 238, 255, 0.6)'
    )
  ),
  true,
  1
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  accent_hex = EXCLUDED.accent_hex,
  bubble_rim_hex = EXCLUDED.bubble_rim_hex,
  composer_rim_hex = EXCLUDED.composer_rim_hex,
  tier = EXCLUDED.tier,
  category = EXCLUDED.category,
  hero_image_url = EXCLUDED.hero_image_url,
  wallpaper_config = EXCLUDED.wallpaper_config,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Restore Rose to its clean pink-accent state · no wallpaper.
UPDATE nex_chat_theme
   SET hero_image_url = NULL,
       wallpaper_config = NULL,
       updated_at = now()
 WHERE id = 'pink';

-- Move Maria to Theme 1 so her chat surface uses the new theme.
UPDATE nex_account
   SET chat_theme = 'theme-1'
 WHERE id = 'd3e7f000-0001-4a00-b000-000000000001';

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '057',
    'Theme 1 · Night Sky · theme3.png wallpaper + moon halo + blue bubble rim + orange composer rim · Maria moved from Rose to Theme 1 · Rose restored to clean state',
    'Founder-authorised 2026-09-27. First fully-configured NEX theme sealed as its own catalogue entry.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Post-apply verification:
--   SELECT id, name, sort_order FROM nex_chat_theme ORDER BY sort_order;
--   SELECT id, display_name, chat_theme FROM nex_account
--    WHERE id='d3e7f000-0001-4a00-b000-000000000001';
