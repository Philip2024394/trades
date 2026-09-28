-- Bridge 24 · Pink Dream chat theme · sealed 2026-09-28.
-- ------------------------------------------------------
-- Registers the "pink-dream" chat theme so it appears in the picker
-- at /nex-native/settings/theme. Reference design supplied 2026-09-28
-- (Founder-authored master prompt · Pink Dream Chat UI System).
--
-- The palette is dark purple incoming bubbles + pink outgoing
-- bubbles with a translucent glass composer, painted over a warm
-- sunset bedroom wallpaper.
--
-- Wallpaper file lives at /public/nex-themes/pink-dream.png so it
-- serves from the same origin as the app. The picker + chat shell
-- resolve hero_image_url straight to that static path.

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
  'pink-dream',
  'Pink Dream',
  'Sunset bedroom · pink neon glow · romantic and premium',
  '#FF3F9F',
  '#FF8BC5',
  '#FF77BC',
  'gratis',
  'premium',
  '/nex-themes/pink-dream.png',
  true,
  40
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
    '081',
    'Bridge 24 · Pink Dream chat theme registered in nex_chat_theme',
    'Founder-authorised 2026-09-28. Reference design theme4.png / thme4draft.png · sunset bedroom + pink neon + dark-purple incoming bubbles + pink outgoing bubbles.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
