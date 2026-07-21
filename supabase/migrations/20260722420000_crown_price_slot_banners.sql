-- Crown price-slot banners — 11 new banners across garden fencing,
-- laminate flooring, and pine internal doors. Each has 1 or 2 price
-- slots defined in `edit_slots` (see migration
-- 20260722410000_site_editor_edit_slots.sql).
--
-- Slot coordinates measured against the 1080×1080 PNG in
-- /public/crown-banners/. Merchant can drag/resize any slot
-- after picking.

INSERT INTO public.hammerex_site_editor_templates (
  slug, label, category, frame_slug, state_json, thumbnail_url,
  is_crown, trade_slugs, image_url, phone_slot, edit_slots, display_order
) VALUES

-- ─── Garden Fence Panels (4) ───────────────────────────────────
-- Single circular "PER PANEL PRICE" bubble on the right
('crown-gardenfence-01', 'Garden Fencing · Wooden Panels', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/gardenfence-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/gardenfence-01.png', TRUE,
 ARRAY['fencing','fencer','garden-fencing','fence-installer','fence-panels','fence-supplier','garden-designer','landscaper','carpenter'],
 '/crown-banners/gardenfence-01.png',
 NULL,
 '[{"id":"price","kind":"price","x":640,"y":535,"width":340,"fontSize":60,"placeholder":"£00","color":"#166534"}]'::jsonb,
 1500),

('crown-gardenfence-02', 'Garden Fencing · Pro Pack', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/gardenfence-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/gardenfence-02.png', TRUE,
 ARRAY['fencing','fencer','garden-fencing','fence-installer','fence-panels','fence-supplier','landscaper'],
 '/crown-banners/gardenfence-02.png',
 NULL,
 '[{"id":"price","kind":"price","x":640,"y":535,"width":340,"fontSize":60,"placeholder":"£00","color":"#166534"}]'::jsonb,
 1501),

('crown-gardenfence-03', 'Garden Fencing · Weather Resistant', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/gardenfence-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/gardenfence-03.png', TRUE,
 ARRAY['fencing','fencer','garden-fencing','fence-installer','fence-panels','fence-supplier','landscaper'],
 '/crown-banners/gardenfence-03.png',
 NULL,
 '[{"id":"price","kind":"price","x":640,"y":535,"width":340,"fontSize":60,"placeholder":"£00","color":"#166534"}]'::jsonb,
 1502),

('crown-gardenfence-04', 'Garden Fencing · Premium Quality', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/gardenfence-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/gardenfence-04.png', TRUE,
 ARRAY['fencing','fencer','garden-fencing','fence-installer','fence-panels','fence-supplier','landscaper'],
 '/crown-banners/gardenfence-04.png',
 NULL,
 '[{"id":"price","kind":"price","x":640,"y":535,"width":340,"fontSize":60,"placeholder":"£00","color":"#166534"}]'::jsonb,
 1503),

-- ─── Laminate Flooring (4) ─────────────────────────────────────
-- Single "PER M² PRICE" square slot in the middle-right
('crown-laminate-01', 'Laminate Flooring · Clearance', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/laminate-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/laminate-01.png', TRUE,
 ARRAY['flooring','laminate-flooring','floor-fitter','floor-supplier','flooring-installer','laminate-supplier','vinyl-flooring','floor-sanding'],
 '/crown-banners/laminate-01.png',
 NULL,
 '[{"id":"price","kind":"price","x":400,"y":610,"width":320,"fontSize":50,"placeholder":"£00","color":"#FFFFFF"}]'::jsonb,
 1600),

('crown-laminate-02', 'Laminate Flooring · Scratch Resistant', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/laminate-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/laminate-02.png', TRUE,
 ARRAY['flooring','laminate-flooring','floor-fitter','floor-supplier','flooring-installer','laminate-supplier','vinyl-flooring'],
 '/crown-banners/laminate-02.png',
 NULL,
 '[{"id":"price","kind":"price","x":400,"y":610,"width":320,"fontSize":50,"placeholder":"£00","color":"#0A0A0A"}]'::jsonb,
 1601),

('crown-laminate-03', 'Laminate Flooring · Built To Last', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/laminate-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/laminate-03.png', TRUE,
 ARRAY['flooring','laminate-flooring','floor-fitter','floor-supplier','flooring-installer','laminate-supplier'],
 '/crown-banners/laminate-03.png',
 NULL,
 '[{"id":"price","kind":"price","x":400,"y":610,"width":320,"fontSize":50,"placeholder":"£00","color":"#FFFFFF"}]'::jsonb,
 1602),

('crown-laminate-04', 'Laminate Flooring · Wide Range', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/laminate-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/laminate-04.png', TRUE,
 ARRAY['flooring','laminate-flooring','floor-fitter','floor-supplier','flooring-installer'],
 '/crown-banners/laminate-04.png',
 NULL,
 '[{"id":"price","kind":"price","x":400,"y":610,"width":320,"fontSize":50,"placeholder":"£00","color":"#FFFFFF"}]'::jsonb,
 1603),

-- ─── Pine Internal Doors (3) ───────────────────────────────────
-- TWO slots per banner: "WAS" (yellow box) + "NOW ONLY" (red box)
('crown-pinedoors-01', '6 Panel Pine · Reduced To Clear', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/pinedoors-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/pinedoors-01.png', TRUE,
 ARRAY['door-supplier','door-fitter','internal-doors','pine-doors','joinery','carpenter','door-manufacturer','builders-merchant'],
 '/crown-banners/pinedoors-01.png',
 NULL,
 '[{"id":"was","kind":"price","x":80,"y":810,"width":260,"fontSize":48,"placeholder":"£249","color":"#0A0A0A"},{"id":"now","kind":"price","x":380,"y":830,"width":420,"fontSize":58,"placeholder":"£179","color":"#FFFFFF"}]'::jsonb,
 1700),

('crown-pinedoors-02', 'Pine Internal Doors · Clearance', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/pinedoors-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/pinedoors-02.png', TRUE,
 ARRAY['door-supplier','door-fitter','internal-doors','pine-doors','joinery','carpenter','door-manufacturer'],
 '/crown-banners/pinedoors-02.png',
 NULL,
 '[{"id":"was","kind":"price","x":80,"y":810,"width":260,"fontSize":48,"placeholder":"£249","color":"#0A0A0A"},{"id":"now","kind":"price","x":380,"y":830,"width":420,"fontSize":58,"placeholder":"£179","color":"#FFFFFF"}]'::jsonb,
 1701),

('crown-pinedoors-03', 'Solid Pine Doors · While Stocks Last', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/pinedoors-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/pinedoors-03.png', TRUE,
 ARRAY['door-supplier','door-fitter','internal-doors','pine-doors','joinery','carpenter'],
 '/crown-banners/pinedoors-03.png',
 NULL,
 '[{"id":"was","kind":"price","x":80,"y":810,"width":260,"fontSize":48,"placeholder":"£249","color":"#0A0A0A"},{"id":"now","kind":"price","x":380,"y":830,"width":420,"fontSize":58,"placeholder":"£179","color":"#FFFFFF"}]'::jsonb,
 1702)

ON CONFLICT (slug) DO NOTHING;
