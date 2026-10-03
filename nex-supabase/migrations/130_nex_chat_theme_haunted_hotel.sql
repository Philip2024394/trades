-- ============================================================================
-- NEX-native Migration 130 · Haunted Hotel chat theme
-- ============================================================================
--
-- Registers the "haunted-hotel" chat theme so it appears in the theme
-- picker at /nex-native/settings/theme, and so emoji/sticker tables
-- that FK into nex_chat_theme can carry haunted-hotel-themed assets.
--
-- Context:
--   · The Haunted Hotel aesthetic already exists as a NEX Vault doorway
--     skin at /nex-native/vault/haunted-hotel (SKIN_HAUNTED_HOTEL in
--     src/app/nex-native/vault/_doorway-skin.ts). Until this migration,
--     the aesthetic was reachable ONLY via that direct Vault URL · it
--     was not a user-selectable chat theme.
--   · The 2026-10-03 legal↔implementation audit flagged this gap as
--     an informational note ("No row named 'haunted-hotel' exists in
--     the live catalog yet"). Founder authorised 2026-10-03.
--
-- Palette mirrors the sealed Vault doorway skin:
--   · base         #0a0604   (near-black with a warm umber lift)
--   · accent       #f0c87a   (warm amber / candlelight gold)
--   · bubble rim   #f0c87a
--   · composer rim #f0c87a
--   · font ambition: Playfair Display serif (applied at render time
--     via the theme-render contract · schema does not store fonts)
--
-- Tier/category match pink-dream's shipment pattern:
--   · tier     = 'gratis'   (free-tier eligible · same as pink-dream)
--   · category = 'premium'  (premium-styled specialty theme)
--
-- hero_image_url points at the existing Vault doorway image rather
-- than introducing a new asset. This gives chat preview surfaces the
-- same visual anchor as the Vault doorway, consistent with the
-- "One NEX Identity" doctrine (2026-09-30 · chat_theme governs every
-- signed-in surface).
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '130';
--     -- Only safe to delete if no accounts have selected haunted-hotel.
--     -- Check first:
--     --   SELECT count(*) FROM nex_account WHERE chat_theme='haunted-hotel';
--     -- Then (if zero AND no sticker/emoji rows depend on it):
--     --   DELETE FROM nex_theme_sticker WHERE theme_id='haunted-hotel';
--     --   DELETE FROM nex_theme_emoji   WHERE theme_id='haunted-hotel';
--     --   DELETE FROM nex_chat_theme    WHERE id='haunted-hotel';
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
  sort_order
) VALUES (
  'haunted-hotel',
  'Haunted Hotel',
  'Gothic hallways · amber candlelight · after-hours luxury',
  '#f0c87a',
  '#f0c87a',
  '#f0c87a',
  'gratis',
  'premium',
  '/nex-native/vault/haunted-hotel-doorway.png',
  true,
  50
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
  updated_at       = now();

INSERT INTO public.nex_migration_history (version, description, notes)
  VALUES (
    '130',
    'Haunted Hotel chat theme registered in nex_chat_theme',
    'Founder-authorised 2026-10-03 after legal-audit informational note. Mirrors pink-dream shipment pattern. Palette reuses sealed Vault doorway SKIN_HAUNTED_HOTEL. hero_image_url points at the existing Vault doorway asset for visual consistency with the One NEX Identity doctrine.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
