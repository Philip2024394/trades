-- Crown banners batch 3 — home services: guttering (5), drain
-- service (5), alarm systems / CCTV (4). Also 6 landscape hero
-- images (2 drain, 4 alarm) that go into the shared feed_tile_library.
--
-- Crown banners are art-only (no phone_slot / no edit_slots) — same
-- pattern as the crown-social-* batch. Merchant adds their own text
-- overlay via the Text tool. Trade-scoped so they surface only for
-- the relevant merchants.

INSERT INTO public.hammerex_site_editor_templates (
  slug, label, category, frame_slug, state_json, thumbnail_url,
  is_crown, trade_slugs, image_url, phone_slot, display_order
) VALUES

-- ─── Guttering (5) ────────────────────────────────────────────
('crown-guttering-01', 'Complete Guttering Solutions', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/guttering-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/guttering-01.png', TRUE,
 ARRAY['guttering','gutter-installer','gutter-repair','downpipe-installer','gutter-cleaner','roofer','roofing','fascia-soffit-installer'],
 '/crown-banners/guttering-01.png', NULL, 1800),

('crown-guttering-02', 'Guttering · Durable & Secure', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/guttering-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/guttering-02.png', TRUE,
 ARRAY['guttering','gutter-installer','gutter-repair','downpipe-installer','roofer','roofing','fascia-soffit-installer'],
 '/crown-banners/guttering-02.png', NULL, 1801),

('crown-guttering-03', 'Guttering · Complete Protection', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/guttering-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/guttering-03.png', TRUE,
 ARRAY['guttering','gutter-installer','gutter-repair','gutter-cleaner','roofer','roofing'],
 '/crown-banners/guttering-03.png', NULL, 1802),

('crown-guttering-04', 'Guttering · Perfect Joints', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/guttering-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/guttering-04.png', TRUE,
 ARRAY['guttering','gutter-installer','gutter-repair','downpipe-installer','roofer','roofing'],
 '/crown-banners/guttering-04.png', NULL, 1803),

('crown-guttering-05', 'Home Guttering · Contact Us', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/guttering-05.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/guttering-05.png', TRUE,
 ARRAY['guttering','gutter-installer','gutter-repair','gutter-cleaner','downpipe-installer','roofer','roofing','fascia-soffit-installer'],
 '/crown-banners/guttering-05.png', NULL, 1804),

-- ─── Drain Service (5) ────────────────────────────────────────
('crown-drain-01', 'Drain Service · Contact Us Today', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/drain-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/drain-01.png', TRUE,
 ARRAY['drainage','drainage-contractor','drain-clearing','drain-unblocking','drain-cctv','plumber','sewer-service','emergency-plumber'],
 '/crown-banners/drain-01.png', NULL, 1900),

('crown-drain-02', 'Drain Clearing · Professional', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/drain-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/drain-02.png', TRUE,
 ARRAY['drainage','drainage-contractor','drain-clearing','drain-unblocking','plumber','sewer-service','emergency-plumber'],
 '/crown-banners/drain-02.png', NULL, 1901),

('crown-drain-03', 'Drain CCTV & Inspection', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/drain-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/drain-03.png', TRUE,
 ARRAY['drainage','drainage-contractor','drain-cctv','drain-inspection','sewer-service','plumber'],
 '/crown-banners/drain-03.png', NULL, 1902),

('crown-drain-04', 'Emergency Drain Unblocking', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/drain-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/drain-04.png', TRUE,
 ARRAY['drainage','drainage-contractor','drain-unblocking','emergency-plumber','plumber','sewer-service'],
 '/crown-banners/drain-04.png', NULL, 1903),

('crown-drain-05', 'Drain Jetting · Fast Response', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/drain-05.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/drain-05.png', TRUE,
 ARRAY['drainage','drainage-contractor','drain-jetting','drain-clearing','plumber','sewer-service','emergency-plumber'],
 '/crown-banners/drain-05.png', NULL, 1904),

-- ─── Alarm Systems / CCTV (4) ─────────────────────────────────
('crown-alarm-01', 'Safe Offices · Secure People', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/alarm-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/alarm-01.png', TRUE,
 ARRAY['alarm-installer','alarm-system','cctv-installer','security-system','access-control','commercial-security','domestic-security','locksmith'],
 '/crown-banners/alarm-01.png', NULL, 2000),

('crown-alarm-02', 'Alarms & Access Control', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/alarm-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/alarm-02.png', TRUE,
 ARRAY['alarm-installer','alarm-system','cctv-installer','security-system','access-control','commercial-security'],
 '/crown-banners/alarm-02.png', NULL, 2001),

('crown-alarm-03', 'CCTV · Motion Detection', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/alarm-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/alarm-03.png', TRUE,
 ARRAY['alarm-installer','alarm-system','cctv-installer','security-system','domestic-security','motion-detection'],
 '/crown-banners/alarm-03.png', NULL, 2002),

('crown-alarm-04', 'Alarm Systems · Trusted Installer', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/alarm-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/alarm-04.png', TRUE,
 ARRAY['alarm-installer','alarm-system','cctv-installer','security-system','commercial-security','domestic-security'],
 '/crown-banners/alarm-04.png', NULL, 2003)

ON CONFLICT (slug) DO NOTHING;


-- ─── Hero images for feed_tile_library ────────────────────────
-- Landscape 1774×887 (aspect 2:1) fits fb-feed perfectly and
-- crops sensibly for ig-feed / ig-portrait. text_tone='white'
-- because both scenes are dark / moody with strong colour.
INSERT INTO public.hammerex_feed_tile_library (
  slug, url, alt, trade_slugs, tier, has_brand_marks, is_banner,
  width_px, height_px, natural_aspect, fits_frames, active, text_tone
) VALUES

('hero-drain-jetting-01', 'https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2022,%202026,%2004_20_55%20AM.png',
 'Drainage engineer using high-pressure water jetter on a street drain — orange hi-vis, service van open with hose reel',
 ARRAY['drainage','drainage-contractor','drain-jetting','drain-clearing','plumber','sewer-service','emergency-plumber','trade-supply'],
 3, FALSE, TRUE, 1774, 887, 2.000, ARRAY['fb-feed','ig-feed','ig-portrait','canteen-post'], TRUE, 'white'),

('hero-drain-jetting-02', 'https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2022,%202026,%2004_20_08%20AM.png',
 'Drainage engineer at manhole with jetter hose — trade van + traffic cones, wet urban street',
 ARRAY['drainage','drainage-contractor','drain-jetting','drain-clearing','plumber','sewer-service','emergency-plumber'],
 3, FALSE, TRUE, 1774, 887, 2.000, ARRAY['fb-feed','ig-feed','ig-portrait','canteen-post'], TRUE, 'white'),

('hero-alarm-cctv-01', 'https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2022,%202026,%2004_17_46%20AM.png',
 'Commercial CCTV monitoring station — 4-camera live view of yard, warehouse, van fleet with alarm panels + PIR sensors on wall',
 ARRAY['alarm-installer','alarm-system','cctv-installer','security-system','commercial-security','access-control'],
 3, FALSE, TRUE, 1774, 887, 2.000, ARRAY['fb-feed','ig-feed','ig-portrait','canteen-post'], TRUE, 'white'),

('hero-alarm-cctv-02', 'https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2022,%202026,%2004_10_26%20AM.png',
 'CCTV + alarm control setup — professional installer scene with monitoring hardware',
 ARRAY['alarm-installer','alarm-system','cctv-installer','security-system','commercial-security'],
 3, FALSE, TRUE, 1774, 887, 2.000, ARRAY['fb-feed','ig-feed','ig-portrait','canteen-post'], TRUE, 'white'),

('hero-alarm-cctv-03', 'https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2022,%202026,%2004_08_44%20AM.png',
 'Alarm system installer scene — control panel and sensor kit ready for install',
 ARRAY['alarm-installer','alarm-system','cctv-installer','security-system','domestic-security'],
 3, FALSE, TRUE, 1774, 887, 2.000, ARRAY['fb-feed','ig-feed','ig-portrait','canteen-post'], TRUE, 'white'),

('hero-alarm-cctv-04', 'https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2022,%202026,%2004_08_24%20AM.png',
 'Home alarm + CCTV kit laid out for installation — trade context, professional visual',
 ARRAY['alarm-installer','alarm-system','cctv-installer','security-system','domestic-security','commercial-security'],
 3, FALSE, TRUE, 1774, 887, 2.000, ARRAY['fb-feed','ig-feed','ig-portrait','canteen-post'], TRUE, 'white')

ON CONFLICT (slug) DO NOTHING;
