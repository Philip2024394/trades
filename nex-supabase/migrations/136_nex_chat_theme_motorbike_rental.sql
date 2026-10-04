-- ============================================================================
-- NEX-native Migration 136 · Motorbike Rental/Sale chat theme
-- ============================================================================
--
-- Registers the "motorbike-rental" chat theme in nex_chat_theme so it
-- appears in the chat-themes-library picker and so emoji/sticker/intro
-- tables that FK into nex_chat_theme can carry motorbike-themed assets
-- in future phases.
--
-- Visual direction (founder-sealed 2026-10-04):
--   · Wallpaper · a black sport motorbike on rain-slicked city streets,
--     dusk cityscape, cyan headlight glow, pink-magenta sunset accents.
--     Uploaded to the nex-chat-theme-hero bucket by the companion script
--     scripts/upload-motorbike-theme-assets.mjs.
--   · Bubbles  · black frosted (incoming) + silver metallic frosted
--     (outgoing). The incoming bubble rim is a sealed frosted gray at
--     the shell level (Bridge 4 · sealed 2026-09-27); the outgoing uses
--     bubble_rim_hex. "Outlined" bubbleStyle preset gives the metallic
--     frosted glass look (transparent bg + silver rim).
--   · Accent  · electric cyan #4FC3F7 picked from the bike's headlight.
--   · Composer · silver rim · structurally same as Haunted Hotel's
--     composer (bubbles layout · standard Portrait Bloom composer).
--
-- Tier/category match Joker + Haunted Hotel + Pink Dream pattern:
--   · tier     = 'gratis'   (free-tier eligible)
--   · category = 'premium'  (premium-styled specialty theme)
--
-- hero_image_url points at the Supabase storage URL where the companion
-- upload script places the wallpaper. This matches the Phase 4A pattern
-- for theme assets (nex-chat-theme-hero bucket · public read).
--
-- intro_video_url is left NULL on INSERT. The companion upload script
-- places the MP4 at nex-theme-intro/motorbike-rental/intro.mp4 and then
-- UPDATEs this row with the public URL · same two-step pattern used by
-- Joker/HH/PD during the Phase 4A asset sweep.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '136';
--     -- Only safe to delete if no accounts have selected motorbike-rental.
--     -- Check first:
--     --   SELECT count(*) FROM nex_account WHERE chat_theme='motorbike-rental';
--     -- Then (if zero AND no sticker/emoji rows depend on it):
--     --   DELETE FROM nex_theme_sticker WHERE theme_id='motorbike-rental';
--     --   DELETE FROM nex_theme_emoji   WHERE theme_id='motorbike-rental';
--     --   DELETE FROM nex_chat_theme    WHERE id='motorbike-rental';
--   COMMIT;
-- ============================================================================

BEGIN;

INSERT INTO public.nex_chat_theme (
  id,
  name,
  tagline,
  accent_hex,
  bubble_rim_hex,
  composer_rim_hex,
  tier,
  category,
  hero_image_url,
  is_active,
  sort_order,
  wallpaper_config,
  layout_style
) VALUES (
  'motorbike-rental',
  'Motorbike Rental/Sale',
  'Rain-slicked city streets · cyan headlight · chrome frost',
  '#4FC3F7',
  '#B8C5D1',
  '#B8C5D1',
  'gratis',
  'premium',
  'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-theme-hero/motorbike-rental.png',
  true,
  60,
  '{"bubbleStyle": {"preset": "outlined"}, "particleDrift": {"color": "rgba(180,200,220,0.42)", "count": 14, "size": 3, "speedSeconds": 20}, "sparkle": {"color": "rgba(220,235,255,0.75)", "count": 20, "size": 2, "twinkleSeconds": 3}}'::jsonb,
  'bubbles'
)
ON CONFLICT (id) DO UPDATE SET
  name             = EXCLUDED.name,
  tagline          = EXCLUDED.tagline,
  accent_hex       = EXCLUDED.accent_hex,
  bubble_rim_hex   = EXCLUDED.bubble_rim_hex,
  composer_rim_hex = EXCLUDED.composer_rim_hex,
  category         = EXCLUDED.category,
  hero_image_url   = EXCLUDED.hero_image_url,
  is_active        = EXCLUDED.is_active,
  sort_order       = EXCLUDED.sort_order,
  wallpaper_config = EXCLUDED.wallpaper_config,
  layout_style     = EXCLUDED.layout_style,
  updated_at       = now();

INSERT INTO public.nex_migration_history (version, description, notes)
  VALUES (
    '136',
    'Motorbike Rental/Sale chat theme registered in nex_chat_theme',
    'Founder-authorised 2026-10-04. Mirrors Joker/Haunted-Hotel/Pink-Dream shipment pattern. Wallpaper = rain-slicked city with cyan-headlight sport bike. Bubbles use outlined preset for metallic-frost look. Accent #4FC3F7 (electric cyan from headlight). Rim #B8C5D1 (metallic silver with cool blue tint). particleDrift + sparkle give city-at-dusk atmosphere. intro_video_url set in a follow-up UPDATE by the companion upload script.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
