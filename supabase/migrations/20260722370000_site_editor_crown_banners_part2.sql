-- Crown banners part 2 — 36 more premium templates across 9 trades:
-- loft ladders, kitchens, windows, painters, bricklayers, carpenter,
-- plumbers, plasterers/rendering, brick suppliers.
--
-- Same schema + phone-slot pattern as the first crown migration
-- (`20260722360000_site_editor_crown_banners.sql`). Every source PNG
-- is near-square (~485×485), scaled directly to 1080×1080 with no
-- padding needed — cover-fits perfectly onto Instagram Feed native.

INSERT INTO public.hammerex_site_editor_templates (
  slug, label, category, frame_slug, state_json, thumbnail_url,
  is_crown, trade_slugs, image_url, phone_slot, display_order
) VALUES

-- ─── Loft Ladders (4) ──────────────────────────────────────────
('crown-loftladders-01', 'Loft Ladders · Access Up There', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/loftladders-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/loftladders-01.png', TRUE,
 ARRAY['loft-ladder-installer','loft-ladder','loft-access','loft-hatch','loft-boarding','loft-conversion','carpenter','joinery'],
 '/crown-banners/loftladders-01.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 500),

('crown-loftladders-02', 'Loft Access · Space Saving Design', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/loftladders-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/loftladders-02.png', TRUE,
 ARRAY['loft-ladder-installer','loft-ladder','loft-access','loft-hatch','loft-boarding','loft-conversion','carpenter','joinery'],
 '/crown-banners/loftladders-02.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 501),

('crown-loftladders-03', 'Loft Ladders · Safe & Secure', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/loftladders-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/loftladders-03.png', TRUE,
 ARRAY['loft-ladder-installer','loft-ladder','loft-access','loft-hatch','loft-boarding','carpenter','joinery'],
 '/crown-banners/loftladders-03.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 502),

('crown-loftladders-04', 'Loft Ladders · Suits Every Home', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/loftladders-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/loftladders-04.png', TRUE,
 ARRAY['loft-ladder-installer','loft-ladder','loft-access','loft-hatch','carpenter','joinery'],
 '/crown-banners/loftladders-04.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 503),

-- ─── Kitchens (4) ──────────────────────────────────────────────
('crown-kitchens-01', 'Kitchen Mania · Prices Just Dropped', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/kitchens-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/kitchens-01.png', TRUE,
 ARRAY['kitchen-fitter','kitchen-manufacturer','kitchen-supplier','kitchen-designer','bespoke-kitchen','fitted-kitchen','joinery'],
 '/crown-banners/kitchens-01.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 600),

('crown-kitchens-02', 'Bespoke Kitchens · Trendy Designs', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/kitchens-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/kitchens-02.png', TRUE,
 ARRAY['kitchen-fitter','kitchen-manufacturer','kitchen-supplier','kitchen-designer','bespoke-kitchen','fitted-kitchen','joinery'],
 '/crown-banners/kitchens-02.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 601),

('crown-kitchens-03', 'Made To Measure · Kitchen Fitting', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/kitchens-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/kitchens-03.png', TRUE,
 ARRAY['kitchen-fitter','kitchen-manufacturer','kitchen-supplier','kitchen-designer','bespoke-kitchen','fitted-kitchen'],
 '/crown-banners/kitchens-03.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 602),

('crown-kitchens-04', 'Kitchens · Professional Fitting', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/kitchens-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/kitchens-04.png', TRUE,
 ARRAY['kitchen-fitter','kitchen-manufacturer','kitchen-supplier','bespoke-kitchen','fitted-kitchen'],
 '/crown-banners/kitchens-04.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 603),

-- ─── Windows (4) ───────────────────────────────────────────────
('crown-windows-01', 'Windows · Manufactured & Supplied', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/windows-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/windows-01.png', TRUE,
 ARRAY['window-manufacturer','window-supplier','window-installer','glazier','double-glazing','upvc-windows','sash-windows','windows'],
 '/crown-banners/windows-01.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 700),

('crown-windows-02', 'Double Glazing · Custom Fit', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/windows-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/windows-02.png', TRUE,
 ARRAY['window-manufacturer','window-supplier','window-installer','glazier','double-glazing','upvc-windows'],
 '/crown-banners/windows-02.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 701),

('crown-windows-03', 'Trade Prices · Windows Direct', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/windows-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/windows-03.png', TRUE,
 ARRAY['window-manufacturer','window-supplier','glazier','double-glazing','upvc-windows','windows'],
 '/crown-banners/windows-03.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 702),

('crown-windows-04', 'Windows · Supply & Fit', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/windows-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/windows-04.png', TRUE,
 ARRAY['window-manufacturer','window-supplier','window-installer','glazier','double-glazing','upvc-windows'],
 '/crown-banners/windows-04.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 703),

-- ─── Painters (4) ──────────────────────────────────────────────
('crown-painters-01', 'Painters Service · Quality You Can See', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/painters-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/painters-01.png', TRUE,
 ARRAY['painter','painter-decorator','decorator','interior-painter','exterior-painter','commercial-painter','domestic-painter'],
 '/crown-banners/painters-01.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#0A0A0A"}'::jsonb, 800),

('crown-painters-02', 'Interior & Exterior · Painting Pros', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/painters-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/painters-02.png', TRUE,
 ARRAY['painter','painter-decorator','decorator','interior-painter','exterior-painter'],
 '/crown-banners/painters-02.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#0A0A0A"}'::jsonb, 801),

('crown-painters-03', 'Premium Materials · On Time', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/painters-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/painters-03.png', TRUE,
 ARRAY['painter','painter-decorator','decorator','interior-painter','exterior-painter'],
 '/crown-banners/painters-03.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#0A0A0A"}'::jsonb, 802),

('crown-painters-04', 'Painters & Decorators · Trusted', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/painters-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/painters-04.png', TRUE,
 ARRAY['painter','painter-decorator','decorator','interior-painter','exterior-painter'],
 '/crown-banners/painters-04.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#0A0A0A"}'::jsonb, 803),

-- ─── Bricklayers (4) ───────────────────────────────────────────
('crown-bricklayers-01', 'Bricklayers · Skilled Trade', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/bricklayers-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/bricklayers-01.png', TRUE,
 ARRAY['bricklayer','brickwork','brick-mason','brickie','brickwork-installation','brick-repointing','brick-extension','brick-wall'],
 '/crown-banners/bricklayers-01.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 900),

('crown-bricklayers-02', 'Brickwork · Built To Last', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/bricklayers-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/bricklayers-02.png', TRUE,
 ARRAY['bricklayer','brickwork','brick-mason','brickie','brickwork-installation','brick-wall','garden-brick-wall'],
 '/crown-banners/bricklayers-02.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 901),

('crown-bricklayers-03', 'Repointing & Extensions', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/bricklayers-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/bricklayers-03.png', TRUE,
 ARRAY['bricklayer','brickwork','brick-mason','brick-repointing','brick-extension','brickwork-installation'],
 '/crown-banners/bricklayers-03.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 902),

('crown-bricklayers-04', 'Bricklayer · Local & Insured', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/bricklayers-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/bricklayers-04.png', TRUE,
 ARRAY['bricklayer','brickwork','brick-mason','brickie'],
 '/crown-banners/bricklayers-04.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 903),

-- ─── Carpenter (4) ─────────────────────────────────────────────
('crown-carpenter-01', 'Carpentry · Crafted With Care', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/carpenter-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/carpenter-01.png', TRUE,
 ARRAY['carpenter','carpentry','joiner','joinery','wood-worker','bespoke-carpentry','first-fix-carpenter','second-fix-carpenter'],
 '/crown-banners/carpenter-01.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 1000),

('crown-carpenter-02', 'Bespoke Carpentry · Made For You', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/carpenter-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/carpenter-02.png', TRUE,
 ARRAY['carpenter','carpentry','joiner','joinery','bespoke-carpentry','fitted-furniture'],
 '/crown-banners/carpenter-02.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 1001),

('crown-carpenter-03', 'First & Second Fix · Trusted Carpenter', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/carpenter-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/carpenter-03.png', TRUE,
 ARRAY['carpenter','carpentry','joiner','joinery','first-fix-carpenter','second-fix-carpenter'],
 '/crown-banners/carpenter-03.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 1002),

('crown-carpenter-04', 'Carpenter · Local Service', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/carpenter-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/carpenter-04.png', TRUE,
 ARRAY['carpenter','carpentry','joiner','joinery'],
 '/crown-banners/carpenter-04.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 1003),

-- ─── Plumbers (4) ──────────────────────────────────────────────
('crown-plumbers-01', 'Plumber · No Job Too Small', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/plumbers-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/plumbers-01.png', TRUE,
 ARRAY['plumber','plumbing','plumbing-services','domestic-plumber','commercial-plumber','emergency-plumber','bathroom-plumbing','kitchen-plumbing','boiler-installer','heating-engineer'],
 '/crown-banners/plumbers-01.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 1100),

('crown-plumbers-02', 'Emergency Plumbing · 24/7', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/plumbers-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/plumbers-02.png', TRUE,
 ARRAY['plumber','plumbing','emergency-plumber','domestic-plumber','commercial-plumber'],
 '/crown-banners/plumbers-02.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 1101),

('crown-plumbers-03', 'Bathroom & Kitchen Plumbing', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/plumbers-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/plumbers-03.png', TRUE,
 ARRAY['plumber','plumbing','bathroom-plumbing','kitchen-plumbing','domestic-plumber'],
 '/crown-banners/plumbers-03.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 1102),

('crown-plumbers-04', 'Boiler & Heating · Gas Safe', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/plumbers-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/plumbers-04.png', TRUE,
 ARRAY['plumber','plumbing','boiler-installer','heating-engineer','gas-safe','domestic-plumber'],
 '/crown-banners/plumbers-04.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 1103),

-- ─── Plasterers & Rendering (4) ─────────────────────────────────
('crown-plasterers-01', 'Plastering · Smooth Finish', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/plasterers-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/plasterers-01.png', TRUE,
 ARRAY['plasterer','plastering','skimming','rendering','render','damp-repair','dry-lining','artex-removal'],
 '/crown-banners/plasterers-01.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 1200),

('crown-plasterers-02', 'Rendering · Interior & Exterior', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/plasterers-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/plasterers-02.png', TRUE,
 ARRAY['plasterer','plastering','rendering','render','silicone-render','sand-cement-render'],
 '/crown-banners/plasterers-02.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 1201),

('crown-plasterers-03', 'Skimming & Repair · Plasterer', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/plasterers-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/plasterers-03.png', TRUE,
 ARRAY['plasterer','plastering','skimming','damp-repair','patch-repair','artex-removal'],
 '/crown-banners/plasterers-03.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 1202),

('crown-plasterers-04', 'Ceilings & Walls · Plastering Pros', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/plasterers-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/plasterers-04.png', TRUE,
 ARRAY['plasterer','plastering','skimming','dry-lining'],
 '/crown-banners/plasterers-04.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 1203),

-- ─── Brick Supplier (4) ────────────────────────────────────────
('crown-bricksupplier-01', 'Brick Supplier · Trade Prices', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/bricksupplier-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/bricksupplier-01.png', TRUE,
 ARRAY['brick-supplier','builders-merchant','brick-yard','trade-supply','construction-supplies'],
 '/crown-banners/bricksupplier-01.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 1300),

('crown-bricksupplier-02', 'Reclaim & New Bricks · Direct', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/bricksupplier-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/bricksupplier-02.png', TRUE,
 ARRAY['brick-supplier','builders-merchant','reclaim-brick','trade-supply'],
 '/crown-banners/bricksupplier-02.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 1301),

('crown-bricksupplier-03', 'Fast Delivery · Brick Supply', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/bricksupplier-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/bricksupplier-03.png', TRUE,
 ARRAY['brick-supplier','builders-merchant','trade-supply','construction-supplies'],
 '/crown-banners/bricksupplier-03.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 1302),

('crown-bricksupplier-04', 'Brick Yard · Trade Only', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/bricksupplier-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/bricksupplier-04.png', TRUE,
 ARRAY['brick-supplier','builders-merchant','brick-yard','trade-supply'],
 '/crown-banners/bricksupplier-04.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 1303)

ON CONFLICT (slug) DO NOTHING;
