-- Crown banners — social-media-marketing themed (4).
--
-- Finished art with construction crews + heavy machinery interacting
-- with Instagram / Facebook logos. Intended for merchants whose
-- trade is social-media-marketing / marketing-agency — banners land
-- on the canvas as-is; merchant adds their own text overlay via
-- the Text tool. No phone_slot (nothing to auto-fill).

INSERT INTO public.hammerex_site_editor_templates (
  slug, label, category, frame_slug, state_json, thumbnail_url,
  is_crown, trade_slugs, image_url, phone_slot, display_order
) VALUES

('crown-social-bulldozer', 'Bulldozer × Facebook', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/crown-social-bulldozer.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/crown-social-bulldozer.png', TRUE,
 ARRAY['social-media-marketing','marketing-agency','facebook-ads','construction-marketing','trade-marketing','digital-marketing'],
 '/crown-banners/crown-social-bulldozer.png',
 NULL,
 1400),

('crown-social-truck', 'Truck × Facebook', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/crown-social-truck.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/crown-social-truck.png', TRUE,
 ARRAY['social-media-marketing','marketing-agency','facebook-ads','construction-marketing','trade-marketing','digital-marketing'],
 '/crown-banners/crown-social-truck.png',
 NULL,
 1401),

('crown-social-guys-ig', 'Construction Crew × Instagram', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/crown-social-guys-ig.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/crown-social-guys-ig.png', TRUE,
 ARRAY['social-media-marketing','marketing-agency','instagram-marketing','construction-marketing','trade-marketing','digital-marketing','content-creator'],
 '/crown-banners/crown-social-guys-ig.png',
 NULL,
 1402),

('crown-social-crane-ig', 'Crane × Instagram Lift', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/crown-social-crane-ig.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/crown-social-crane-ig.png', TRUE,
 ARRAY['social-media-marketing','marketing-agency','instagram-marketing','construction-marketing','trade-marketing','digital-marketing','content-creator'],
 '/crown-banners/crown-social-crane-ig.png',
 NULL,
 1403)

ON CONFLICT (slug) DO NOTHING;
