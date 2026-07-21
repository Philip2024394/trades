-- Crown banners batch 4 — landscape + garden + interior trades.
--
-- Standard 1080×1080 crown banners (art-only, no phone_slot):
--   Paving supplies (4)
--   Tiling services (4)
--   Garden centre / landscaping (4)
--   Scaffolders / scaffolding (4)
--   Under-stair storage / cabinets (4)
--
-- Wide banner heroes (1080×~170, aspect ~6.5) go into
-- feed_tile_library tagged is_banner=TRUE for header / rail use:
--   Tiling long banners (4)
--
-- Landscape 2:1 heroes for feed_tile_library:
--   Tiler at work (1)
--   Garden centre / landscaping scenes (4)
--   Bonus: no-overlay garden hero (already counted in gardencentre)

-- ─── Crown banners (20 total, all art-only) ───────────────────
INSERT INTO public.hammerex_site_editor_templates (
  slug, label, category, frame_slug, state_json, thumbnail_url,
  is_crown, trade_slugs, image_url, phone_slot, display_order
) VALUES

-- Paving (4)
('crown-paving-01', 'Paving · Perfect Results', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/paving-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/paving-01.png', TRUE,
 ARRAY['paving','paving-supplier','paver','landscaper','driveway-installer','builders-merchant','aggregate-supplier','patio-installer'],
 '/crown-banners/paving-01.png', NULL, 2100),

('crown-paving-02', 'Paving Supplies · Quality Materials', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/paving-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/paving-02.png', TRUE,
 ARRAY['paving','paving-supplier','paver','landscaper','driveway-installer','builders-merchant','aggregate-supplier'],
 '/crown-banners/paving-02.png', NULL, 2101),

('crown-paving-03', 'Paving Bricks & Aggregates', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/paving-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/paving-03.png', TRUE,
 ARRAY['paving','paving-supplier','paver','landscaper','builders-merchant','aggregate-supplier'],
 '/crown-banners/paving-03.png', NULL, 2102),

('crown-paving-04', 'Landscaping Materials · Shop Now', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/paving-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/paving-04.png', TRUE,
 ARRAY['paving','paving-supplier','paver','landscaper','driveway-installer','builders-merchant'],
 '/crown-banners/paving-04.png', NULL, 2103),

-- Tiling (4)
('crown-tiling-01', 'Professional Tiling · Homes & Businesses', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/tiling-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/tiling-01.png', TRUE,
 ARRAY['tiler','tiling','wall-tiling','floor-tiling','bathroom-tiling','kitchen-tiling','porcelain-tiler','mosaic-tiler'],
 '/crown-banners/tiling-01.png', NULL, 2200),

('crown-tiling-02', 'Tiling · Turning Spaces Into Masterpieces', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/tiling-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/tiling-02.png', TRUE,
 ARRAY['tiler','tiling','wall-tiling','floor-tiling','bathroom-tiling','kitchen-tiling'],
 '/crown-banners/tiling-02.png', NULL, 2201),

('crown-tiling-03', 'Indoor & Outdoor Tiling · Fully Insured', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/tiling-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/tiling-03.png', TRUE,
 ARRAY['tiler','tiling','wall-tiling','floor-tiling','outdoor-tiling','porcelain-tiler'],
 '/crown-banners/tiling-03.png', NULL, 2202),

('crown-tiling-04', 'Wall & Floor Tiling · Quality Assured', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/tiling-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/tiling-04.png', TRUE,
 ARRAY['tiler','tiling','wall-tiling','floor-tiling','bathroom-tiling','kitchen-tiling'],
 '/crown-banners/tiling-04.png', NULL, 2203),

-- Garden centre / landscaping (4)
('crown-gardencentre-01', 'Garden Centre · Concept To Creation', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/gardencentre-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/gardencentre-01.png', TRUE,
 ARRAY['garden-centre','landscaper','landscaping','garden-designer','garden-supplier','plant-nursery','patio-installer'],
 '/crown-banners/gardencentre-01.png', NULL, 2300),

('crown-gardencentre-02', 'Landscape Perfection · Expert Touch', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/gardencentre-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/gardencentre-02.png', TRUE,
 ARRAY['garden-centre','landscaper','landscaping','garden-designer','garden-supplier'],
 '/crown-banners/gardencentre-02.png', NULL, 2301),

('crown-gardencentre-03', 'Transforming Outdoors · Elevating Lives', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/gardencentre-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/gardencentre-03.png', TRUE,
 ARRAY['garden-centre','landscaper','landscaping','garden-designer','patio-installer'],
 '/crown-banners/gardencentre-03.png', NULL, 2302),

('crown-gardencentre-04', 'Landscape Design · Reliable Service', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/gardencentre-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/gardencentre-04.png', TRUE,
 ARRAY['garden-centre','landscaper','landscaping','garden-designer'],
 '/crown-banners/gardencentre-04.png', NULL, 2303),

-- Scaffolders (4)
('crown-scaffolders-01', 'Scaffolding · Up High, On Point', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/scaffolders-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/scaffolders-01.png', TRUE,
 ARRAY['scaffolder','scaffolding','scaffold-hire','scaffold-erector','roofer','builder','construction-general'],
 '/crown-banners/scaffolders-01.png', NULL, 2400),

('crown-scaffolders-02', 'Scaffolding · Safety Focused', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/scaffolders-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/scaffolders-02.png', TRUE,
 ARRAY['scaffolder','scaffolding','scaffold-hire','scaffold-erector','roofer','builder'],
 '/crown-banners/scaffolders-02.png', NULL, 2401),

('crown-scaffolders-03', 'Scaffolding · Today Supporting Tomorrow', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/scaffolders-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/scaffolders-03.png', TRUE,
 ARRAY['scaffolder','scaffolding','scaffold-hire','scaffold-erector','roofer','builder'],
 '/crown-banners/scaffolders-03.png', NULL, 2402),

('crown-scaffolders-04', 'Scaffolding · Compliant & Certified', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/scaffolders-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/scaffolders-04.png', TRUE,
 ARRAY['scaffolder','scaffolding','scaffold-hire','scaffold-erector'],
 '/crown-banners/scaffolders-04.png', NULL, 2403),

-- Under-stair storage / cabinets (4)
('crown-understair-01', 'Under Stair Storage · Perfectly Organized', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/understair-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/understair-01.png', TRUE,
 ARRAY['carpenter','joinery','joiner','bespoke-joinery','under-stair-storage','cabinet-maker','fitted-furniture','staircase-installer'],
 '/crown-banners/understair-01.png', NULL, 2500),

('crown-understair-02', 'Under Stair Cabinets · Tailored To Fit', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/understair-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/understair-02.png', TRUE,
 ARRAY['carpenter','joinery','joiner','bespoke-joinery','under-stair-storage','cabinet-maker','fitted-furniture'],
 '/crown-banners/understair-02.png', NULL, 2501),

('crown-understair-03', 'Bespoke Under-Stair Solutions', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/understair-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/understair-03.png', TRUE,
 ARRAY['carpenter','joinery','joiner','bespoke-joinery','under-stair-storage','cabinet-maker'],
 '/crown-banners/understair-03.png', NULL, 2502),

('crown-understair-04', 'Transform Wasted Space · Built To Impress', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/understair-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/understair-04.png', TRUE,
 ARRAY['carpenter','joinery','joiner','bespoke-joinery','under-stair-storage','cabinet-maker'],
 '/crown-banners/understair-04.png', NULL, 2503)

ON CONFLICT (slug) DO NOTHING;


-- ─── Wide tiling banners for header/rail use (4) ──────────────
-- Aspect ~6.5:1 — too wide for standard social frames. Tagged
-- is_banner=TRUE so the merchant-hero-swap system picks them up
-- for canteen page header use. fits_frames left empty by design.
INSERT INTO public.hammerex_feed_tile_library (
  slug, url, alt, trade_slugs, tier, has_brand_marks, is_banner,
  width_px, height_px, natural_aspect, fits_frames, active, text_tone
) VALUES

('banner-tiling-wide-01', '/crown-banners/tilinglong-01.png',
 'Wide banner — Professional Tiler · Big or Small, We Tile It All. Bathrooms, Kitchens, Floors, Walls.',
 ARRAY['tiler','tiling','wall-tiling','floor-tiling','bathroom-tiling','kitchen-tiling'],
 3, FALSE, TRUE, 1080, 164, 6.585, ARRAY[]::TEXT[], TRUE, 'white'),

('banner-tiling-wide-02', '/crown-banners/tilinglong-02.png',
 'Wide banner — Tiling services with quality workmanship + free quotes callout',
 ARRAY['tiler','tiling','wall-tiling','floor-tiling'],
 3, FALSE, TRUE, 1080, 156, 6.923, ARRAY[]::TEXT[], TRUE, 'white'),

('banner-tiling-wide-03', '/crown-banners/tilinglong-03.png',
 'Wide banner — Tiler service with competitive prices + 100% satisfaction',
 ARRAY['tiler','tiling','wall-tiling','floor-tiling','bathroom-tiling'],
 3, FALSE, TRUE, 1080, 177, 6.102, ARRAY[]::TEXT[], TRUE, 'white'),

('banner-tiling-wide-04', '/crown-banners/tilinglong-04.png',
 'Wide banner — Professional tiler call-to-action strip',
 ARRAY['tiler','tiling','wall-tiling','floor-tiling'],
 3, FALSE, TRUE, 1080, 177, 6.102, ARRAY[]::TEXT[], TRUE, 'white');


-- ─── Landscape hero images for feed_tile_library ──────────────
-- 1774×887 (aspect 2:1) — fits fb-feed native + crops sensibly
-- for ig-feed / ig-portrait / canteen-post.
INSERT INTO public.hammerex_feed_tile_library (
  slug, url, alt, trade_slugs, tier, has_brand_marks, is_banner,
  width_px, height_px, natural_aspect, fits_frames, active, text_tone
) VALUES

('hero-tiler-01', 'https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2022,%202026,%2003_58_59%20AM.png',
 'Professional tiler at work — trowel + tile detail, on-site trade scene',
 ARRAY['tiler','tiling','wall-tiling','floor-tiling','bathroom-tiling','kitchen-tiling'],
 3, FALSE, TRUE, 1774, 887, 2.000, ARRAY['fb-feed','ig-feed','ig-portrait','canteen-post'], TRUE, 'white'),

('hero-gardencentre-01', 'https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2022,%202026,%2003_33_12%20AM.png',
 'Garden centre / landscaping scene — outdoor design, plant selection',
 ARRAY['garden-centre','landscaper','landscaping','garden-designer','plant-nursery'],
 3, FALSE, TRUE, 1774, 887, 2.000, ARRAY['fb-feed','ig-feed','ig-portrait','canteen-post'], TRUE, 'white'),

('hero-gardencentre-02', 'https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2022,%202026,%2003_31_57%20AM.png',
 'Garden centre landscape — mature planting + patio work in progress',
 ARRAY['garden-centre','landscaper','landscaping','garden-designer','patio-installer'],
 3, FALSE, TRUE, 1774, 887, 2.000, ARRAY['fb-feed','ig-feed','ig-portrait','canteen-post'], TRUE, 'white'),

('hero-gardencentre-03', 'https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2022,%202026,%2003_30_10%20AM.png',
 'Garden centre — landscaping progress with structural planting',
 ARRAY['garden-centre','landscaper','landscaping','garden-designer'],
 3, FALSE, TRUE, 1774, 887, 2.000, ARRAY['fb-feed','ig-feed','ig-portrait','canteen-post'], TRUE, 'white'),

('hero-gardencentre-04', 'https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2022,%202026,%2003_28_34%20AM.png',
 'Garden centre — clean landscape hero, no overlay text needed',
 ARRAY['garden-centre','landscaper','landscaping','garden-designer','plant-nursery'],
 3, FALSE, TRUE, 1774, 887, 2.000, ARRAY['fb-feed','ig-feed','ig-portrait','canteen-post'], TRUE, 'white')

ON CONFLICT (slug) DO NOTHING;
