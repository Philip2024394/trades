-- Hero library additions — 14 new images across carpenter,
-- construction, and social-media-marketing themes. Direct ImageKit
-- URLs (Philip's authored source) — no copy needed.
--
-- Uses `hammerex_feed_tile_library` — the shared image pool that
-- feeds the Site Editor library drawer + Site Interest marketplace.
-- Social-media themed images are tagged `has_brand_marks=true`
-- (they show Instagram / Facebook logos) so the Site Interest
-- store filter excludes them for generic sale. They're still
-- available in the editor for merchants whose trade is social-media
-- marketing / marketing-agency.

INSERT INTO public.hammerex_feed_tile_library (
  slug, url, alt, trade_slugs, tier, has_brand_marks, is_banner,
  width_px, height_px, natural_aspect, fits_frames, active, text_tone
) VALUES

-- ─── Normal carpenter workshop scenes (4) ─────────────────────
('hero-carpenter-workshop-01', 'https://ik.imagekit.io/5vv5pw26q/Untitleddsdsaaaaaaadsasdsdadasddzxc.png',
 'Carpenter working at wooden workbench with tools in warm-lit workshop',
 ARRAY['carpenter','carpentry','joinery','joiner','wood-worker','bespoke-carpentry'],
 3, FALSE, FALSE, 480, 490, 0.980, ARRAY['ig-feed','fb-square','canteen-post'], TRUE, 'white'),

('hero-carpenter-workshop-02', 'https://ik.imagekit.io/5vv5pw26q/Untitleddsdsaaaaaaadsasdsdadasdd.png',
 'Carpenter measuring and marking a plank at his workbench',
 ARRAY['carpenter','carpentry','joinery','joiner','wood-worker','bespoke-carpentry'],
 3, FALSE, FALSE, 490, 488, 1.004, ARRAY['ig-feed','fb-square','canteen-post'], TRUE, 'white'),

('hero-carpenter-workshop-03', 'https://ik.imagekit.io/5vv5pw26q/Untitleddsdsaaaaaaadsasd.png',
 'Carpenter focused on precision joinery work at a well-lit bench',
 ARRAY['carpenter','carpentry','joinery','joiner','wood-worker','bespoke-carpentry'],
 3, FALSE, FALSE, 480, 485, 0.990, ARRAY['ig-feed','fb-square','canteen-post'], TRUE, 'white'),

('hero-carpenter-workshop-04', 'https://ik.imagekit.io/5vv5pw26q/Untitleddsdsaaaaaaa.png',
 'Carpenter shaping timber with hand tools in traditional workshop',
 ARRAY['carpenter','carpentry','joinery','joiner','wood-worker','bespoke-carpentry'],
 3, FALSE, FALSE, 486, 485, 1.002, ARRAY['ig-feed','fb-square','canteen-post'], TRUE, 'white'),

-- ─── 3D specialty images (2) ──────────────────────────────────
('hero-staircase-fitting-3d', 'https://ik.imagekit.io/5vv5pw26q/Untitleddsdsaaaaaaadsasdsdad.png',
 '3D-rendered carpenter fitting a modern staircase — clean visualisation',
 ARRAY['staircase-installer','staircase-maker','stair-fitter','carpenter','joinery','bespoke-staircase'],
 3, FALSE, FALSE, 472, 487, 0.969, ARRAY['ig-feed','fb-square','canteen-post'], TRUE, 'white'),

('hero-toolbox-3d', 'https://ik.imagekit.io/5vv5pw26q/Untitleddsdsaaaaaaadsasdsdadasd.png',
 '3D-rendered toolbox filled with hand tools — universal construction visual',
 ARRAY['carpenter','construction-general','handyman','trade-supply','toolbox'],
 3, FALSE, FALSE, 481, 483, 0.996, ARRAY['ig-feed','fb-square','canteen-post'], TRUE, 'white'),

-- ─── Carpenter signage (2) ────────────────────────────────────
('hero-carpenter-sign-01', 'https://ik.imagekit.io/5vv5pw26q/fsdfsdfsdd.png',
 'Wooden carpenter shop sign with rustic craft details',
 ARRAY['carpenter','carpentry','joinery','joiner','shop-signage'],
 3, FALSE, FALSE, 819, 757, 1.082, ARRAY['fb-feed','ig-feed'], TRUE, 'white'),

('hero-carpenter-sign-02', 'https://ik.imagekit.io/5vv5pw26q/fsdfsdfsd.png',
 'Traditional hand-painted carpenter sign hanging outside workshop',
 ARRAY['carpenter','carpentry','joinery','joiner','shop-signage'],
 3, FALSE, FALSE, 819, 753, 1.088, ARRAY['fb-feed','ig-feed'], TRUE, 'white'),

-- ─── Building banner (1) ──────────────────────────────────────
('hero-building-banner-01', 'https://ik.imagekit.io/5vv5pw26q/vcxvxcv.png',
 'Portrait building banner featuring construction imagery',
 ARRAY['construction-general','builder','building-contractor'],
 3, FALSE, TRUE, 512, 785, 0.652, ARRAY['ig-portrait','ig-story','fb-story','canteen-post'], TRUE, 'white'),

-- ─── Social-media themed (6) ──────────────────────────────────
-- All contain Instagram / Facebook logos → has_brand_marks=TRUE
-- so Site Interest marketplace excludes them. Editor still shows
-- them to merchants tagged with social-media-marketing trades.
('hero-social-site-01', 'https://ik.imagekit.io/5vv5pw26q/Untitledasdasaaaaacccwweqweweqweqwwewdsasasdadssddasasdasdaasdssdasdsdfsdasddasdsdfsasda.png',
 'Construction site with social media logos raining down from the sky — marketing metaphor',
 ARRAY['social-media-marketing','marketing-agency','digital-marketing','construction-marketing','trade-marketing'],
 3, TRUE, TRUE, 1057, 614, 1.721, ARRAY['fb-feed'], TRUE, 'white'),

('hero-social-facebook-icon-01', 'https://ik.imagekit.io/5vv5pw26q/Untitledasdasaaaaacccwweqweweqweqwwewdsasasdadssddasasdasdaasdssdasdsdfsdasddasdsdfs.png',
 'Facebook icon centered on a construction site scene',
 ARRAY['social-media-marketing','marketing-agency','facebook-ads','construction-marketing'],
 3, TRUE, TRUE, 1100, 614, 1.792, ARRAY['fb-feed'], TRUE, 'white'),

('hero-social-track-machine-01', 'https://ik.imagekit.io/5vv5pw26q/Untitledasdasaaaaacccwweqweweqweqwwewdsasasdadssddasasdasdaasdssdasdsdfsdasddasd.png',
 'Track machine loading soil with facebook signs poured into truck bed',
 ARRAY['social-media-marketing','marketing-agency','facebook-ads','construction-marketing','plant-hire'],
 3, TRUE, TRUE, 1040, 608, 1.711, ARRAY['fb-feed'], TRUE, 'white'),

('hero-social-tree-instagram-01', 'https://ik.imagekit.io/5vv5pw26q/Untitledasdasaaaaacccwweqweweqweqwwewdsasasdadssddasasdasdaasdssdasdsdfsdasd.png',
 'Magical tree growing Instagram icons on its branches with pond and gazebo',
 ARRAY['social-media-marketing','marketing-agency','instagram-marketing','digital-marketing','content-creator'],
 3, TRUE, FALSE, 733, 860, 0.852, ARRAY['ig-portrait','canteen-post'], TRUE, 'white'),

('hero-social-helicopter-01', 'https://ik.imagekit.io/5vv5pw26q/Untitledasdasaaaaacccwweqweweqweqwwewdsasasdadssddasasdasdaasdssdasdsdfsd.png',
 'Helicopter carrying a facebook banner over a construction site',
 ARRAY['social-media-marketing','marketing-agency','facebook-ads','construction-marketing'],
 3, TRUE, TRUE, 758, 819, 0.925, ARRAY['ig-feed','ig-portrait','canteen-post'], TRUE, 'white'),

('hero-social-plumber-tv-01', 'https://ik.imagekit.io/5vv5pw26q/Untitledasdasaaaaacccwweqweweqweqwwewdsasasdadssddasasdasdaasdssdasd.png',
 'Plumber fixing an outdoor water pump while facebook plays on the indoor TV',
 ARRAY['social-media-marketing','marketing-agency','plumber','facebook-ads','trade-marketing'],
 3, TRUE, FALSE, 819, 758, 1.081, ARRAY['ig-feed','fb-feed','canteen-post'], TRUE, 'white')

ON CONFLICT (slug) DO NOTHING;
