-- Crown banners — premium templates with all design + text burned
-- into the source PNG at authoring time. Merchant only edits the
-- phone-number slot. Gold Crown badge on the drawer tile signals
-- premium content. Trade-scoped via trade_slugs so a merchant only
-- sees the banners for their trade.
--
-- Layered on top of `hammerex_site_editor_templates` (the existing
-- template catalogue) rather than a new table — the drawer already
-- consumes /api/site/editor/templates and every code path picks up
-- the new fields via a single view widening.

-- ─── Schema additions ───────────────────────────────────────────

ALTER TABLE public.hammerex_site_editor_templates
  ADD COLUMN IF NOT EXISTS is_crown    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trade_slugs TEXT[]      NOT NULL DEFAULT '{}'::TEXT[],
  -- Direct image URL for crown banners (bypasses the resolver — the
  -- PNG is the whole composition, we just position the phone layer).
  ADD COLUMN IF NOT EXISTS image_url   TEXT,
  -- Pre-calibrated phone-slot position in authoring pixels (1080-scale)
  -- Shape: { "x": 557, "y": 830, "width": 497, "fontSize": 52,
  --          "placeholder": "07XXX XXX XXX", "color": "#FFFFFF" }
  ADD COLUMN IF NOT EXISTS phone_slot  JSONB;

-- Extend the category constraint to allow the 'crown' category.
ALTER TABLE public.hammerex_site_editor_templates
  DROP CONSTRAINT IF EXISTS hammerex_editor_templates_category_check;
ALTER TABLE public.hammerex_site_editor_templates
  ADD CONSTRAINT hammerex_editor_templates_category_check CHECK (
    category IN ('quote', 'before-after', 'price-card', 'promo', 'testimonial', 'announcement', 'crown', 'other')
  );

-- GIN index on trade_slugs so per-trade drawer filtering is fast.
CREATE INDEX IF NOT EXISTS idx_editor_templates_trade_slugs
  ON public.hammerex_site_editor_templates USING GIN (trade_slugs)
  WHERE is_crown = TRUE AND active = TRUE;

-- Compound index for the crown listing query pattern.
CREATE INDEX IF NOT EXISTS idx_editor_templates_crown
  ON public.hammerex_site_editor_templates (is_crown, display_order, created_at DESC)
  WHERE is_crown = TRUE AND active = TRUE;

-- ─── Seed data ──────────────────────────────────────────────────
-- 23 banners across 4 trades:
--   • Staircase (11) — mahogany, walnut, oak, pine, modern glass,
--                      industrial, purple, LED, and 3 "step above" variants
--   • Joinery (4)    — bespoke fit-out compositions
--   • Electrician (4) — installer / rewire / lighting compositions
--   • Drywall (4)    — taping / joint compound / dry-lining
--
-- Every banner's PNG lives at /public/crown-banners/<slug>.png at
-- 1080×1080 (Instagram Feed native). Landscape sources padded with
-- neutral-100 gray top+bottom so nothing gets cropped.
--
-- Trade-slug allowlists are conservative — a joiner sees joinery
-- banners, a staircase installer sees staircase + joinery banners
-- (overlap intentional — joinery is a superset of staircase work).

-- Phone-slot shapes (kept as helpers via CTE would be nicer but PG
-- INSERT VALUES doesn't allow CTE reuse; the JSON is duplicated
-- inline per row):
--   staircase   →  { x: 557, y: 830,  width: 497, fontSize: 52 }
--   joinery     →  { x: 530, y: 912,  width: 520, fontSize: 52 }
--   electrician →  { x: 590, y: 945,  width: 460, fontSize: 48 }
--   drywall     →  { x: 520, y: 945,  width: 520, fontSize: 48 }

INSERT INTO public.hammerex_site_editor_templates (
  slug, label, category, frame_slug, state_json, thumbnail_url,
  is_crown, trade_slugs, image_url, phone_slot, display_order
) VALUES

-- ─── Staircase (11) ────────────────────────────────────────────
('crown-staircase-01', 'Mahogany Stairs · Classic Elegance', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/staircase-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/staircase-01.png', TRUE,
 ARRAY['staircase-installer','staircase-maker','staircase-manufacturer','bespoke-staircase','oak-staircase','mahogany-staircase','walnut-staircase','pine-staircase','stair-fitter','carpenter','joinery'],
 '/crown-banners/staircase-01.png',
 '{"x":557,"y":830,"width":497,"fontSize":52,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 100),

('crown-staircase-02', 'Walnut Stairs · Rich in Colour', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/staircase-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/staircase-02.png', TRUE,
 ARRAY['staircase-installer','staircase-maker','staircase-manufacturer','bespoke-staircase','walnut-staircase','stair-fitter','carpenter','joinery'],
 '/crown-banners/staircase-02.png',
 '{"x":557,"y":830,"width":497,"fontSize":52,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 101),

('crown-staircase-03', 'Oak Stairs · Strong Today Stunning Always', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/staircase-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/staircase-03.png', TRUE,
 ARRAY['staircase-installer','staircase-maker','staircase-manufacturer','bespoke-staircase','oak-staircase','stair-fitter','carpenter','joinery'],
 '/crown-banners/staircase-03.png',
 '{"x":557,"y":830,"width":497,"fontSize":52,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 102),

('crown-staircase-04', 'Pine Stairs · Natural Beauty', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/staircase-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/staircase-04.png', TRUE,
 ARRAY['staircase-installer','staircase-maker','staircase-manufacturer','pine-staircase','stair-fitter','carpenter','joinery'],
 '/crown-banners/staircase-04.png',
 '{"x":557,"y":830,"width":497,"fontSize":52,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 103),

('crown-staircase-05', 'Modern Glass · Built to Last', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/staircase-05.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/staircase-05.png', TRUE,
 ARRAY['staircase-installer','staircase-maker','staircase-manufacturer','bespoke-staircase','glass-staircase','modern-staircase','stair-fitter','carpenter','joinery'],
 '/crown-banners/staircase-05.png',
 '{"x":557,"y":830,"width":497,"fontSize":52,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 104),

('crown-staircase-06', 'Industrial Loft · Smart Design', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/staircase-06.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/staircase-06.png', TRUE,
 ARRAY['staircase-installer','staircase-maker','staircase-manufacturer','industrial-staircase','loft-conversion','stair-fitter','carpenter','joinery'],
 '/crown-banners/staircase-06.png',
 '{"x":557,"y":830,"width":497,"fontSize":52,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 105),

('crown-staircase-07', 'Contemporary · Stairs Built for Life', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/staircase-07.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/staircase-07.png', TRUE,
 ARRAY['staircase-installer','staircase-maker','staircase-manufacturer','contemporary-staircase','stair-fitter','carpenter','joinery'],
 '/crown-banners/staircase-07.png',
 '{"x":557,"y":830,"width":497,"fontSize":52,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 106),

('crown-staircase-08', 'LED-Lit Modern · Elevate Your Home', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/staircase-08.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/staircase-08.png', TRUE,
 ARRAY['staircase-installer','staircase-maker','staircase-manufacturer','led-staircase','floating-staircase','stair-fitter','carpenter','joinery'],
 '/crown-banners/staircase-08.png',
 '{"x":557,"y":830,"width":497,"fontSize":52,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 107),

('crown-staircase-09', 'Staircase · A Step Above (Bronze)', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/staircase-09.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/staircase-09.png', TRUE,
 ARRAY['staircase-installer','staircase-maker','staircase-manufacturer','bespoke-staircase','stair-fitter','carpenter','joinery'],
 '/crown-banners/staircase-09.png',
 '{"x":557,"y":830,"width":497,"fontSize":52,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 108),

('crown-staircase-10', 'Staircase · A Step Above (Blue)', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/staircase-10.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/staircase-10.png', TRUE,
 ARRAY['staircase-installer','staircase-maker','staircase-manufacturer','bespoke-staircase','stair-fitter','carpenter','joinery'],
 '/crown-banners/staircase-10.png',
 '{"x":557,"y":830,"width":497,"fontSize":52,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 109),

('crown-staircase-11', 'Staircase · A Step Above (Yellow)', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/staircase-11.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/staircase-11.png', TRUE,
 ARRAY['staircase-installer','staircase-maker','staircase-manufacturer','bespoke-staircase','stair-fitter','carpenter','joinery'],
 '/crown-banners/staircase-11.png',
 '{"x":557,"y":830,"width":497,"fontSize":52,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 110),

-- ─── Joinery (4) ───────────────────────────────────────────────
('crown-joinery-01', 'Joinery Works · Your Imagination Is Our Limitation', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/joinery-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/joinery-01.png', TRUE,
 ARRAY['joinery','joiner','bespoke-joinery','cabinet-maker','carpentry','carpenter','furniture-maker','kitchen-fitter','media-wall','built-in-storage'],
 '/crown-banners/joinery-01.png',
 '{"x":530,"y":912,"width":520,"fontSize":52,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 200),

('crown-joinery-02', 'Bespoke Joinery · Made For You', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/joinery-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/joinery-02.png', TRUE,
 ARRAY['joinery','joiner','bespoke-joinery','cabinet-maker','carpentry','carpenter','furniture-maker','kitchen-fitter'],
 '/crown-banners/joinery-02.png',
 '{"x":530,"y":912,"width":520,"fontSize":52,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 201),

('crown-joinery-03', 'Fitted Furniture · Precision Built', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/joinery-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/joinery-03.png', TRUE,
 ARRAY['joinery','joiner','bespoke-joinery','fitted-furniture','cabinet-maker','carpentry','carpenter'],
 '/crown-banners/joinery-03.png',
 '{"x":530,"y":912,"width":520,"fontSize":52,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 202),

('crown-joinery-04', 'Custom Cabinetry · Built To Last', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/joinery-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/joinery-04.png', TRUE,
 ARRAY['joinery','joiner','bespoke-joinery','cabinet-maker','carpentry','carpenter','custom-cabinetry'],
 '/crown-banners/joinery-04.png',
 '{"x":530,"y":912,"width":520,"fontSize":52,"placeholder":"07XXX XXX XXX","color":"#FFFFFF"}'::jsonb, 203),

-- ─── Electrician (4) ───────────────────────────────────────────
('crown-electrician-01', 'Electrical Solutions · That Light Up Your Life', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/electrician-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/electrician-01.png', TRUE,
 ARRAY['electrician','electrical','electrical-contractor','rewire','consumer-unit','ev-charger-installer','domestic-electrician','commercial-electrician','lighting-specialist'],
 '/crown-banners/electrician-01.png',
 '{"x":590,"y":945,"width":460,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#0A0A0A"}'::jsonb, 300),

('crown-electrician-02', 'Full & Part Rewires · Trusted Electricians', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/electrician-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/electrician-02.png', TRUE,
 ARRAY['electrician','electrical','electrical-contractor','rewire','consumer-unit','domestic-electrician','commercial-electrician'],
 '/crown-banners/electrician-02.png',
 '{"x":590,"y":945,"width":460,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#0A0A0A"}'::jsonb, 301),

('crown-electrician-03', 'Lighting Design · Power Points · Switchboards', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/electrician-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/electrician-03.png', TRUE,
 ARRAY['electrician','electrical','electrical-contractor','lighting-specialist','domestic-electrician','commercial-electrician'],
 '/crown-banners/electrician-03.png',
 '{"x":590,"y":945,"width":460,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#0A0A0A"}'::jsonb, 302),

('crown-electrician-04', 'Emergency Callouts · 24/7 Sparks', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/electrician-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/electrician-04.png', TRUE,
 ARRAY['electrician','electrical','emergency-electrician','electrical-contractor','domestic-electrician'],
 '/crown-banners/electrician-04.png',
 '{"x":590,"y":945,"width":460,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#0A0A0A"}'::jsonb, 303),

-- ─── Drywall / Tapers (4) ──────────────────────────────────────
('crown-drywall-01', 'Drywall Tapers · Keenest Prices This Month', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/drywall-01.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/drywall-01.png', TRUE,
 ARRAY['drywall','drywall-taper','taper','plasterer','plastering','dry-lining','plasterboard','drylining'],
 '/crown-banners/drywall-01.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#0A0A0A"}'::jsonb, 400),

('crown-drywall-02', 'Slab · Tape · Joint · Reliable Supply', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/drywall-02.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/drywall-02.png', TRUE,
 ARRAY['drywall','drywall-taper','taper','plasterer','plastering','dry-lining','plasterboard','drylining','trade-supply'],
 '/crown-banners/drywall-02.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#0A0A0A"}'::jsonb, 401),

('crown-drywall-03', 'Smooth Finish · Time Saving · Trade Quality', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/drywall-03.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/drywall-03.png', TRUE,
 ARRAY['drywall','drywall-taper','taper','plasterer','plastering','dry-lining','plasterboard','drylining'],
 '/crown-banners/drywall-03.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#0A0A0A"}'::jsonb, 402),

('crown-drywall-04', 'Drywall & Tapers · Trade Ready', 'crown', 'ig-feed',
 '{"version":1,"frameSlug":"ig-feed","mode":"single","base":{"sourceImageId":null,"url":"/crown-banners/drywall-04.png","offsetX":0,"offsetY":0,"scale":1,"kind":"image","isPlaceholder":false},"layers":[]}'::jsonb,
 '/crown-banners/drywall-04.png', TRUE,
 ARRAY['drywall','drywall-taper','taper','plasterer','plastering','dry-lining','plasterboard','drylining'],
 '/crown-banners/drywall-04.png',
 '{"x":520,"y":945,"width":520,"fontSize":48,"placeholder":"07XXX XXX XXX","color":"#0A0A0A"}'::jsonb, 403)

ON CONFLICT (slug) DO NOTHING;
