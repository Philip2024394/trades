-- ============================================================================
-- NEX-native Migration 138 · Cakes chat theme
-- ============================================================================
--
-- Registers the "cakes" chat theme in nex_chat_theme so it appears in
-- the chat-themes-library picker and so emoji/sticker/intro tables that
-- FK into nex_chat_theme can carry cakes-themed assets later.
--
-- Visual direction (founder-sealed 2026-10-05):
--   · Wallpaper · a bakery-shop still life · chocolate ganache, red
--     velvet, strawberry vanilla, oreo, carrot, lemon cheesecake and
--     blueberry cheesecake slices on white plates arranged on warm
--     wood. Uploaded to the nex-chat-theme-hero bucket by the
--     companion script scripts/upload-cakes-theme-assets.mjs.
--   · Bubbles · gradient preset for a warm cake-crumb feel · caramel
--     rim fades into chocolate-brown glass (outgoing). Incoming bubble
--     rim is the sealed frosted gray at the shell layer (Bridge 4 ·
--     sealed 2026-09-27). Only outgoing bubbles + composer carry the
--     theme colour.
--   · Accent  · warm caramel #C68B5F picked from the baked crust +
--     toffee notes across the wallpaper.
--   · Composer · cream rim · structurally same as Haunted Hotel +
--     Vitamins (bubbles layout · standard Portrait Bloom).
--   · particleDrift · soft butter-cream swirls rising slowly.
--   · sparkle     · icing-sugar dust at low opacity.
--
-- Tier/category match the recent specialty themes (Vitamins / Motorbike
-- / Haunted Hotel / Pink Dream / Joker):
--   · tier     = 'gratis'   (free-tier eligible)
--   · category = 'premium'  (premium-styled specialty theme)
--
-- hero_image_url points at the Supabase storage URL where the
-- companion upload script places the wallpaper. Matches the Phase 4A
-- pattern.
--
-- intro_video_url is left NULL on INSERT. The companion upload script
-- places the MP4 at nex-theme-intro/cakes/intro.mp4 and then UPDATEs
-- this row with the public URL · same two-step pattern used by
-- Joker/HH/PD/Motorbike/Vitamins.
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '138';
--     -- Only safe to delete if no accounts have selected cakes.
--     -- Check first:
--     --   SELECT count(*) FROM nex_account WHERE chat_theme='cakes';
--     -- Then (if zero AND no sticker/emoji rows depend on it):
--     --   DELETE FROM nex_theme_sticker WHERE theme_id='cakes';
--     --   DELETE FROM nex_theme_emoji   WHERE theme_id='cakes';
--     --   DELETE FROM nex_chat_theme    WHERE id='cakes';
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
  'cakes',
  'Cakes',
  'Warm bakery · chocolate ganache · sugar dust',
  '#C68B5F',
  '#E8C8A8',
  '#E8C8A8',
  'gratis',
  'premium',
  'https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-theme-hero/cakes.png',
  true,
  80,
  '{"bubbleStyle": {"preset": "gradient"}, "particleDrift": {"color": "rgba(255,220,180,0.42)", "count": 14, "size": 4, "speedSeconds": 18}, "sparkle": {"color": "rgba(255,240,210,0.75)", "count": 22, "size": 2, "twinkleSeconds": 3.2}}'::jsonb,
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
    '138',
    'Cakes chat theme registered in nex_chat_theme',
    'Founder-authorised 2026-10-05. Mirrors Joker/Haunted-Hotel/Pink-Dream/Motorbike/Vitamins shipment pattern. Wallpaper = bakery still life (chocolate ganache / red velvet / strawberry vanilla / oreo / carrot / lemon + blueberry cheesecake slices on warm wood). Bubbles use gradient preset for warm cake-crumb feel. Accent #C68B5F (caramel/toffee from baked crust). Rim #E8C8A8 (cream frosting). particleDrift (14 soft butter-cream swirls · speed 18s) + sparkle (22 icing-sugar twinkles · fade 3.2s) for the warm bakery atmosphere. intro_video_url set in a follow-up UPDATE by the companion upload script.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
