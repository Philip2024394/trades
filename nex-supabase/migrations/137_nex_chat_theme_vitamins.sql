-- ============================================================================
-- NEX-native Migration 137 · Vitamins chat theme
-- ============================================================================
--
-- Registers the "vitamins" chat theme in nex_chat_theme so it appears in
-- the chat-themes-library picker and so emoji/sticker/intro tables that
-- FK into nex_chat_theme can carry vitamins-themed assets later.
--
-- Visual direction (founder-sealed 2026-10-04):
--   · Wallpaper · an energetic lifestyle still with a woman holding
--     Vitamin C, a splash of water, and five vitamin tubes (B Complex,
--     C, D3, Zn+C) with vibrant fruit garnish (orange, raspberry,
--     lemon, lime) over a warm orange glow. Uploaded to the
--     nex-chat-theme-hero bucket by the companion script
--     scripts/upload-vitamins-theme-assets.mjs.
--   · Bubbles · orange frosted glass (outgoing) · yellow + fruit
--     accents from the wallpaper carry the yellow-frost feel.
--     Incoming bubble rim is sealed frosted gray at the shell layer
--     (Bridge 4 · sealed 2026-09-27) · outgoing uses bubble_rim_hex.
--     "Outlined" bubbleStyle preset gives the frosted-glass look
--     (transparent bg + warm orange rim).
--   · Accent  · vibrant orange #FF8C1A picked from the glowing
--     background of the wallpaper.
--   · Composer · warm orange rim · structurally same as the Haunted
--     Hotel composer (bubbles layout · standard Portrait Bloom).
--
-- Tier/category match Joker + Haunted Hotel + Pink Dream + Motorbike:
--   · tier     = 'gratis'   (free-tier eligible)
--   · category = 'premium'  (premium-styled specialty theme)
--
-- hero_image_url points at the Supabase storage URL where the
-- companion upload script places the wallpaper. This matches the
-- Phase 4A pattern for theme assets (nex-chat-theme-hero bucket).
--
-- intro_video_url is left NULL on INSERT. The companion upload script
-- places the MP4 at nex-theme-intro/vitamins/intro.mp4 and then
-- UPDATEs this row with the public URL · same two-step pattern used by
-- Joker/HH/PD during the Phase 4A asset sweep and Motorbike.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '137';
--     -- Only safe to delete if no accounts have selected vitamins.
--     -- Check first:
--     --   SELECT count(*) FROM nex_account WHERE chat_theme='vitamins';
--     -- Then (if zero AND no sticker/emoji rows depend on it):
--     --   DELETE FROM nex_theme_sticker WHERE theme_id='vitamins';
--     --   DELETE FROM nex_theme_emoji   WHERE theme_id='vitamins';
--     --   DELETE FROM nex_chat_theme    WHERE id='vitamins';
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
  'vitamins',
  'Vitamins',
  'Citrus glow · effervescent fizz · daily wellness',
  '#FF8C1A',
  '#FFB84D',
  '#FFB84D',
  'gratis',
  'premium',
  'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-theme-hero/vitamins.png',
  true,
  70,
  '{"bubbleStyle": {"preset": "outlined"}, "particleDrift": {"color": "rgba(255,170,80,0.52)", "count": 18, "size": 4, "speedSeconds": 14}, "sparkle": {"color": "rgba(255,230,160,0.85)", "count": 26, "size": 2, "twinkleSeconds": 2.5}}'::jsonb,
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
    '137',
    'Vitamins chat theme registered in nex_chat_theme',
    'Founder-authorised 2026-10-04. Mirrors Joker/Haunted-Hotel/Pink-Dream/Motorbike shipment pattern. Wallpaper = woman-with-vitamins lifestyle still (B Complex / C / D3 / Zn+C tubes + fruits + orange glow). Bubbles use outlined preset for warm orange frosted glass. Accent #FF8C1A (vibrant orange from the background glow). Rim #FFB84D (warm orange frost). particleDrift (18 soft orange particles · effervescent) + sparkle (26 pale yellow fizz twinkles) for the dissolving-tablet atmosphere. intro_video_url set in a follow-up UPDATE by the companion upload script.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
