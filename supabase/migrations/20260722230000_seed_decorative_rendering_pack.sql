-- Decorative Rendering knowledge pack.
--
-- Trade #2 in the Trade Knowledge Engine after concrete. Purpose:
-- prove the engine adds a new trade with ZERO application code.
-- Just this migration + eventually a job calculator + template.
--
-- Covers: stone-effect (ashlar), brick-effect, timber-effect,
-- rock-face, Venetian plaster, monocouche, silicone, acrylic,
-- lime, pebble dash, roughcast, Tyrolean.
--
-- Sources: gov.uk (Approved Doc C moisture, Doc L thermal),
-- BS EN 13914-1/2, Federation of Plastering + Drywall Contractors,
-- manufacturer datasheets (K Rend, Weber, Parex, Sto, Baumit).

-- ─── Trade ────────────────────────────────────────────────────────
insert into hammerex_knowledge_trades
  (slug, display_name, description, merchant_categories, trade_categories, icon_slug, sort_order)
values
  ('decorative-rendering', 'Decorative Rendering',
   'Specialist exterior + interior render finishes. Stone-effect (ashlar), brick-effect, timber-effect, rock-face, Venetian plaster, monocouche, silicone, acrylic, lime, pebble dash, roughcast, Tyrolean.',
   array['building-merchant','render-supplier','plaster-supplier','specialist-materials'],
   array['renderer','plasterer','stonemason','decorative-renderer','render-specialist'],
   'brush', 20)
on conflict (slug) do update set
  display_name        = excluded.display_name,
  description         = excluded.description,
  merchant_categories = excluded.merchant_categories,
  trade_categories    = excluded.trade_categories,
  icon_slug           = excluded.icon_slug;

-- ─── Topics ───────────────────────────────────────────────────────
insert into hammerex_knowledge_topics (trade_slug, slug, display_name, description, sort_order) values
  ('decorative-rendering', 'fundamentals',     'Fundamentals',             'What decorative rendering is + how it differs from plain render.',      10),
  ('decorative-rendering', 'stone-effect',     'Stone-effect (ashlar)',    'Carved render to imitate cut stone blocks. Also: sculptured, carved, faux stone.', 20),
  ('decorative-rendering', 'brick-effect',     'Brick-effect render',      'Render carved or stamped to imitate brick courses.',                    30),
  ('decorative-rendering', 'timber-effect',    'Timber-effect render',     'Textured render finished to look like timber cladding.',                40),
  ('decorative-rendering', 'rock-face',        'Rock-face render',         'Deeply-textured render with natural stone-face appearance.',           50),
  ('decorative-rendering', 'venetian',         'Venetian plaster',         'Polished Italian plaster (marmorino, stucco lucido) with marble-like sheen.', 60),
  ('decorative-rendering', 'monocouche',       'Monocouche',               'Single-coat through-coloured cement render (K Rend, Weber, Parex).',   70),
  ('decorative-rendering', 'silicone',         'Silicone render',          'Silicone-based hydrophobic render — self-cleaning, breathable.',        80),
  ('decorative-rendering', 'acrylic',          'Acrylic render',           'Polymer-based flexible render — good for EWI, less breathable.',        90),
  ('decorative-rendering', 'lime',             'Lime render',              'Traditional breathable render for older/heritage buildings + damp control.', 100),
  ('decorative-rendering', 'pebble-dash',      'Pebble dash',              'Small pebbles or gravel thrown onto wet base coat — durable, low-maintenance.', 110),
  ('decorative-rendering', 'roughcast',        'Roughcast (harling)',      'Wet-mix aggregate render thrown onto the wall — Scottish + weatherproof.', 120),
  ('decorative-rendering', 'tyrolean',         'Tyrolean',                 'Machine-sprayed sand-cement render giving a stippled finish.',          130),
  ('decorative-rendering', 'materials',        'Materials',                'Bases, aggregates, colourants, sealers, primers, meshes, beads.',       140),
  ('decorative-rendering', 'tools',            'Tools',                    'Trowels, hawks, texturing tools, scoring blades, spray guns.',          150),
  ('decorative-rendering', 'preparation',      'Preparation + substrate',   'What surfaces take render, primers, EWI systems, key coats.',           160),
  ('decorative-rendering', 'regulations',      'UK regulations',           'Approved Doc C (moisture), Doc L (thermal), Doc B (fire on EWI).',      170),
  ('decorative-rendering', 'failure',          'Failure + repair',         'Cracking, blowing, staining, hairline cracks, delamination.',           180),
  ('decorative-rendering', 'safety',           'Safety',                    'Silica dust, working at height, cement burns, chemical additives.',     190)
on conflict (trade_slug, slug) do nothing;

-- ─── Video tag ontology ───────────────────────────────────────────
insert into hammerex_knowledge_video_tags (slug, trade_slug, display_name, tag_kind, description) values
  ('render-mix',           'decorative-rendering', 'Mixing render',            'activity', 'Preparing the render mix on-site or from bagged product'),
  ('render-apply-scratch', 'decorative-rendering', 'Scratch coat / base',      'activity', 'Applying the base coat before finish work'),
  ('render-apply-finish',  'decorative-rendering', 'Applying finish coat',     'activity', 'The final decorative coat'),
  ('render-carve',         'decorative-rendering', 'Carving joints (ashlar)',  'activity', 'Cutting joints into fresh render to imitate stone blocks'),
  ('render-stamp',         'decorative-rendering', 'Stamping pattern',         'activity', 'Pressing texture stamps into wet render'),
  ('render-texture',       'decorative-rendering', 'Texturing surface',        'activity', 'Creating surface texture with brushes, sponges, rollers'),
  ('render-throw',         'decorative-rendering', 'Throwing pebble/aggregate','activity', 'Pebble dash or roughcast application'),
  ('render-spray-tyrolean','decorative-rendering', 'Spraying (Tyrolean)',      'activity', 'Machine-sprayed stippled finish'),
  ('render-colour',        'decorative-rendering', 'Applying colour/stain',    'activity', 'Adding pigment, stain, or tinted coat'),
  ('render-seal',          'decorative-rendering', 'Sealing surface',          'activity', 'Applying sealer or protective coating'),
  ('render-polish',        'decorative-rendering', 'Polishing (Venetian)',     'activity', 'Burnishing Venetian plaster to marble-like sheen'),
  ('stone-effect',         'decorative-rendering', 'Stone-effect finish',      'method',   'Ashlar/carved stone-imitation render'),
  ('brick-effect',         'decorative-rendering', 'Brick-effect finish',      'method',   'Render carved to imitate brick courses'),
  ('timber-effect',        'decorative-rendering', 'Timber-effect finish',     'method',   'Render textured to look like timber'),
  ('rock-face',            'decorative-rendering', 'Rock-face finish',         'method',   'Deep textured render with natural stone face'),
  ('venetian-plaster',     'decorative-rendering', 'Venetian plaster',         'method',   'Marmorino / stucco lucido polished plaster'),
  ('monocouche',           'decorative-rendering', 'Monocouche',               'material', 'Through-coloured single-coat cement render'),
  ('silicone-render',      'decorative-rendering', 'Silicone render',          'material', 'Hydrophobic breathable silicone-based render'),
  ('acrylic-render',       'decorative-rendering', 'Acrylic render',           'material', 'Polymer-based flexible thin-coat render'),
  ('lime-render',          'decorative-rendering', 'Lime render',              'material', 'Traditional breathable lime-based render'),
  ('pebble-dash',          'decorative-rendering', 'Pebble dash',              'method',   'Small aggregate thrown onto wet base coat'),
  ('roughcast',            'decorative-rendering', 'Roughcast (harling)',      'method',   'Scottish wet-mix thrown aggregate render'),
  ('tyrolean',             'decorative-rendering', 'Tyrolean',                 'method',   'Machine-sprayed stippled cement finish'),
  ('feature-wall',         'decorative-rendering', 'Feature wall',             'stage',    'Interior or exterior focal wall'),
  ('exterior-render',      'decorative-rendering', 'Exterior render',          'stage',    'External weatherproof render system'),
  ('render-crack-hairline','decorative-rendering', 'Hairline cracking',        'problem',  'Fine surface cracks in render'),
  ('render-crack-blowing', 'decorative-rendering', 'Blowing / delamination',   'problem',  'Render coming away from substrate'),
  ('silica-dust',          'decorative-rendering', 'Silica dust',              'safety',   'RCS exposure from cutting/mixing cement products')
on conflict (slug) do nothing;

-- ─── Entries ──────────────────────────────────────────────────────

insert into hammerex_knowledge_entries (
  trade_slug, topic_id, content_type, title, ai_summary, detailed_explanation,
  video_tags, merchant_categories, trade_categories, source_url, source_type, source_publisher, confidence_score
) values

-- Stone-effect render — the hero topic for the incoming video
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='stone-effect'),
 'fundamentals', 'What stone-effect render is',
 'Stone-effect render (also ashlar, carved, sculptured, or faux-stone render) is a cement-based render applied to a wall then hand-carved before it fully cures to imitate cut stone blocks. Colour + sealer are added to produce a realistic natural-stone appearance.',
 'The technique is applied in 2-3 coats: a scratch coat for bond, a levelling coat, and a finish coat. Once the finish coat has firmed but not fully cured (usually 30-90 minutes after application depending on mix + weather), the renderer scribes joint lines with a v-shaped tool or scoring blade to divide the surface into stone-block shapes. The surface is then textured with sponges, brushes, or trowels to imitate a natural stone face. Colour is applied via mineral oxides, cement stains, or lime wash — often multi-tone to mimic natural variation. Finally a masonry sealer is applied for weather protection + durability. Cost: £70-130/m² supply + labour in the UK (2026), 3-4× the cost of plain render but 30-50% of real stone cladding. Commonly used on house frontages, garden walls, boundary walls, feature walls, and fireplaces.',
 array['stone-effect','render-carve','render-texture','render-colour','render-seal']::text[],
 array['building-merchant','render-supplier']::text[],
 array['renderer','plasterer','decorative-renderer']::text[],
 'https://www.plasteringcompany.co.uk/', 'trade-body', 'FPDC', 0.94),

('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='stone-effect'),
 'installation', 'How stone-effect (ashlar) render is applied',
 '3 coats over prepared substrate: scratch coat (bond) → levelling coat → finish coat. Carve joints when finish is firm but pliable (30-90 min). Texture with sponges/brushes. Colour + seal after 24-48h.',
 'Detailed sequence: (1) PREP — clean substrate, apply SBR primer if smooth/dense. (2) SCRATCH COAT — 6-8mm of strong sand:cement (1:3 or 1:4) with SBR + fibres, scratched with a comb for key. Cure 24-48h. (3) LEVELLING — 10-15mm of 1:1:6 (cement:lime:sand) or premixed base render, ruled off flat. Cure 24-48h. (4) FINISH — 3-6mm final render, applied with steel trowel, pressed flat. (5) CARVE — while finish is firm but not fully cured, scribe joints with v-blade or purpose-made ashlar tool. Depth 2-4mm. Traditional random-course ashlar patterns are asymmetric to look natural. (6) TEXTURE — sponge, wire brush, or float to add stone-face texture. (7) DRY — 24-48h. (8) COLOUR — apply base colour + secondary highlights via mineral oxide stains, cement paint, or breathable masonry paint. (9) SEAL — masonry sealer or siloxane weatherproofer. Total job time: 3-5 days per typical house frontage. Timing is everything — carve too early and edges collapse; carve too late and joints look scratched not sculpted.',
 array['render-carve','render-apply-scratch','render-apply-finish','render-texture','render-colour','render-seal','stone-effect']::text[],
 array['building-merchant','render-supplier']::text[],
 array['renderer','decorative-renderer']::text[],
 'https://www.plasteringcompany.co.uk/', 'trade-body', 'FPDC', 0.92),

('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='stone-effect'),
 'faq', 'How much does stone-effect render cost per square metre?',
 'UK 2026 indicative: £70-130 per m² supply + labour for full 3-coat + carved + coloured + sealed stone-effect render on a domestic exterior. Cheaper than real stone cladding (£150-300/m²) but 3-4× the cost of plain monocouche.',
 'Range depends on: region (London/SE +20-30%), substrate prep needed, complexity of pattern (random ashlar vs regular blocks), number of colours applied, and whether it goes on new build or over existing tired render. Typical £/m² breakdown: materials ~£15-25 (sand, cement, fibres, primer, colours, sealer), labour ~£55-100 (skilled decorative renderer, 3-5 days per typical façade). Scaffolding for 2-storey add ~£800-1,500. Get 3 quotes on Networkers — quality varies significantly between plain renderers + specialist decorative renderers. Ask for photos of past work in the same technique before hiring.',
 array['stone-effect']::text[],
 array['building-merchant','render-supplier']::text[],
 array['renderer','decorative-renderer','plasterer']::text[],
 'https://www.plasteringcompany.co.uk/', 'trade-body', 'FPDC', 0.88),

('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='stone-effect'),
 'best-practice', 'Where stone-effect render works best',
 'Best on: house frontages (feature façades), garden + boundary walls, chimney breasts, fireplaces, entrance porticoes, restaurant + shop frontages. Avoid: below-DPC areas, wet zones without proper detailing, north walls in freezing climates without sealer.',
 'The finish is durable if properly executed + sealed — 20-30 year lifespan, then re-seal. Not suitable for: constantly damp locations (unless lime-based); below damp-proof course without engineered detail (moisture wicks up and blows the render); flat horizontal surfaces (water ponds and freeze-thaw damages the surface). Best colour palette: honey stone, Cotswold cream, York sandstone, Bath limestone for period sympathy; slate grey + charcoal for modern. Two-tone application (base + darker shadow into joints) reads as more authentic. On heritage/conservation-area properties check with the local authority — plain lime-based decorative render is usually permitted; cement-based stone-effect may not be. Boundary walls under 1m free-standing don''t need planning; over 2m + adjacent to highway may.',
 array['stone-effect','exterior-render','feature-wall']::text[],
 array['render-supplier']::text[],
 array['renderer','decorative-renderer']::text[],
 'https://www.planningportal.co.uk/', 'gov', 'Planning Portal', 0.90),

-- Fundamentals
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='fundamentals'),
 'fundamentals', 'Decorative rendering — what makes it different',
 'Standard render protects + weatherproofs. Decorative render adds a designed visual finish — colour, texture, imitation stone/brick/timber, or polished plaster. The technique + skill level is materially higher; the pricing is 2-5× plain render.',
 'Plain render (sand + cement, or monocouche in its unmodified form) covers a wall and moves on. Decorative rendering treats the render as a design surface. Techniques divide into: (1) IMITATION FINISHES — stone-effect, brick-effect, timber-effect, rock-face — where the wet render is carved, stamped, or textured. (2) POLISHED FINISHES — Venetian plaster, stucco lucido — burnished to a marble-like sheen. (3) THROWN + SPRAYED FINISHES — pebble dash, roughcast, Tyrolean — mechanically applied aggregate/spray textures. (4) COLOURED + PIGMENTED FINISHES — monocouche, silicone, acrylic renders through-coloured for maintenance-free walls. Skill divergence: general renderers do practical + weatherproofing work; decorative renderers are specialists with 5-15 year experience and often a portfolio of past façades. Always ask to see photos of the specific finish you want before hiring.',
 array[]::text[],
 array['building-merchant','render-supplier']::text[],
 array['renderer','plasterer','decorative-renderer']::text[],
 'https://www.plasteringcompany.co.uk/', 'trade-body', 'FPDC', 0.93),

-- Monocouche
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='monocouche'),
 'material', 'Monocouche render explained',
 'Monocouche = single-coat through-coloured cement render (typically 12-18mm, applied in 2 passes but from the same mix). Colour goes all the way through so scratches don''t show white. Brands: K Rend, Weber, Parex, Ronacrete.',
 'Applied via hand-trowel or machine spray onto a prepared substrate. Compressive strength ~1.5-3 MPa, water absorption low. Cures over 2-3 days; can be scraped/textured while workable for a "scraped" or "float" finish, or brushed to reveal aggregate. Cost £30-50/m² supply+labour — cheaper than silicone/acrylic and much cheaper than stone-effect. Downsides: cement-based, so brittle vs polymer renders; can crack over movement joints; heavy (needs substrate that can carry weight). Best for: new-build cavity walls, well-prepared old masonry, non-insulated substrates. NOT suitable for EWI (use silicone/acrylic thin-coat instead). Life expectancy 25+ years without recoat if properly applied + detailed.',
 array['monocouche','render-apply-finish']::text[],
 array['building-merchant','render-supplier']::text[],
 array['renderer','plasterer']::text[],
 'https://www.k-rend.co.uk/', 'manufacturer', 'K Rend', 0.94),

-- Silicone render
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='silicone'),
 'material', 'Silicone render — properties + when to use',
 'Silicone-based thin-coat render (1.5-3mm). Highly hydrophobic (water beads + runs off), breathable, self-cleaning, flexible. £45-75/m² supply+labour. Standard finish for EWI systems in the UK.',
 'Silicone resins are hydrophobic yet vapour-permeable — the wall sheds bulk water but still allows moisture vapour out, which suits UK weather + prevents interstitial condensation. Flexible film handles small substrate movement without cracking. Available pre-coloured in dozens of shades. Applied over a base coat + fibreglass mesh on EWI systems; over primer + mesh on solid walls. Downsides: cost (2-3× monocouche); requires clean, dry conditions to apply (won''t take below 5°C or above 30°C); minor colour fade over decades. Life expectancy: 25-30 years. Repainting/rendering to change colour is possible with specialist coatings. Brands: Weber Silor-P, K Rend Silicone TC, Sto Silco, Parex Silicone. Best for: EWI retrofit, seaside properties (salt exposure), north-facing walls prone to green algae.',
 array['silicone-render','render-apply-finish','exterior-render']::text[],
 array['building-merchant','render-supplier','specialist-materials']::text[],
 array['renderer','plasterer']::text[],
 'https://www.sto.co.uk/', 'manufacturer', 'Sto', 0.93),

-- Acrylic render
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='acrylic'),
 'material', 'Acrylic render — properties + when to use',
 'Acrylic polymer thin-coat render (1.5-3mm). Highly flexible, wide colour range, moderate hydrophobicity. £40-65/m² supply+labour. Less breathable than silicone — better for well-insulated modern builds than damp-risk older walls.',
 'Acrylic-based dispersion binds sand + pigments into a flexible film. Excellent crack resistance, wide colour palette, easier to apply than silicone. Downsides: LESS breathable than silicone — can trap moisture if applied over damp walls. NOT suitable for lime-based substrates or older buildings with rising damp risk. Best for: new-build cavity walls, EWI systems where breathability isn''t critical, modern developments. Brands: Weber Rend Acrylic, Parex DPR Acrylic, Sto Lotusan. Life 20-25 years, refresh with specialist paint if needed.',
 array['acrylic-render','render-apply-finish']::text[],
 array['building-merchant','render-supplier']::text[],
 array['renderer','plasterer']::text[],
 'https://www.weber.co.uk/', 'manufacturer', 'Weber', 0.91),

-- Lime render
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='lime'),
 'material', 'Lime render — traditional + heritage buildings',
 'Lime-based render (NHL 2 or 3.5, or lime putty). Highly breathable, flexible, moisture-buffering. Mandatory for heritage/listed buildings + solid-wall properties pre-1919 (cement traps moisture and causes damp/decay).',
 'Two flavours: NATURAL HYDRAULIC LIME (NHL 2, 3.5, 5 — sets with water) and NON-HYDRAULIC LIME PUTTY (sets by carbonation with CO₂ over weeks-months). NHL 3.5 is the domestic default — enough set for exterior use, gentle enough not to damage soft masonry. Applied 2-3 coats over 25-50mm total. Curing REQUIRES humid conditions — spray with water for first 3-7 days, cover with hessian. Cost £55-85/m² supply+labour. Compatible with: solid stone, brick, cob, timber-frame, lath + plaster. Life expectancy 60-100 years when properly applied + maintained. MANDATORY on listed buildings + Grade II* — cement render on these will damage the historic fabric AND breach listed building consent. Brands: Lime Green Products, St Astier, Cornish Lime. Any building merchant can source NHL by grade.',
 array['lime-render','render-apply-finish','exterior-render']::text[],
 array['building-merchant','specialist-materials']::text[],
 array['renderer','stonemason','heritage-specialist']::text[],
 'https://historicengland.org.uk/', 'gov', 'Historic England', 0.96),

-- Pebble dash
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='pebble-dash'),
 'method', 'Pebble dash — technique + variations',
 'Small pebbles or gravel thrown onto a wet base coat of render then pressed in. Durable, low-maintenance, hides substrate imperfections. Common on UK semi-detached + council-era housing. Aggregate size 4-10mm; colours include Cotswold, Bath, Cornish, spar.',
 'Method: apply 10-15mm base coat of 1:1:6 cement-lime-sand render. While wet, throw dry pebbles by hand (traditionally with a hawk) or via a mechanical dasher. Aggregate embeds ~50% into the base. Some renderers press pebbles with a wooden float for better adhesion. Cost £35-55/m² supply+labour, cheaper than most decorative renders. Life expectancy 40+ years. Downsides: dated aesthetic — many post-war UK homes have it, so buyers often want to remove; removal is destructive + expensive (often full re-render needed). Weathering: green algae + moss build up in shaded areas; wash with SBR + fungicide every 5-10 years. Not usually suitable for retrofit EWI — thickness + weight exceed system tolerance; use finer aggregate silicone finish instead.',
 array['pebble-dash','render-throw','exterior-render']::text[],
 array['building-merchant','aggregate-supplier']::text[],
 array['renderer','plasterer']::text[],
 'https://www.plasteringcompany.co.uk/', 'trade-body', 'FPDC', 0.92),

-- Roughcast (harling)
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='roughcast'),
 'method', 'Roughcast (Scottish harling) — technique',
 'Wet-mix aggregate render thrown onto the wall in one operation. Traditional Scottish "harling" — highly weatherproof, textured finish common on Scottish + North UK exteriors.',
 'Roughcast differs from pebble dash: the aggregate is PRE-MIXED into wet render + then thrown/harled onto the wall, rather than dry-thrown into a wet base. Mix: 1:3 lime:sand or 1:1:6 cement:lime:sand with 6-10mm sharp aggregate. Applied 15-20mm thick in one thrown coat over a scratch base. The pre-mixed wetness locks pebbles chemically into the render matrix — more durable + weatherproof than dry-thrown pebble dash. Traditional Scottish harling uses lime + limewash finish; modern harling uses cement + coloured cement. Cost £50-80/m² supply+labour. Life 50+ years lime, 30-40 years cement. Best for: Scotland + exposed West Coast, high wind-driven rain zones, coastal properties. Historic Scotland provides listed-building guidance if working on pre-1919 traditional buildings.',
 array['roughcast','render-throw','exterior-render']::text[],
 array['building-merchant','aggregate-supplier']::text[],
 array['renderer','plasterer','stonemason']::text[],
 'https://www.historicenvironment.scot/', 'gov', 'Historic Environment Scotland', 0.94),

-- Tyrolean
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='tyrolean'),
 'method', 'Tyrolean finish — machine-sprayed stippled render',
 'Sand-cement render sprayed onto the wall via a hand-cranked or motorised Tyrolean gun. Produces a stippled/textured finish; more uniform than pebble dash. Popular on garages + boundary walls + budget commercial buildings.',
 'The Tyrolean gun (rotary flicker) throws small droplets of render at the wall in a fine spray, building up thickness (~5-8mm) in 2-4 passes. Base render must be applied first + primed. Mix: sharp sand + cement + water, often with pigment. Cost £30-45/m² supply+labour — one of the cheapest decorative finishes. Best for: garage walls, boundary walls, workshops, budget commercial. Downsides: dated look, hard to repair (colour matching difficult), collects dirt in stippled surface, needs cleaning every 3-5 years. Modern silicone Tyrolean products (K Rend Tyrolean Finish) improve weathering + self-cleaning.',
 array['tyrolean','render-spray-tyrolean','exterior-render']::text[],
 array['building-merchant','render-supplier']::text[],
 array['renderer','plasterer']::text[],
 'https://www.k-rend.co.uk/', 'manufacturer', 'K Rend', 0.90),

-- Venetian plaster
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='venetian'),
 'method', 'Venetian plaster (Marmorino / Stucco Lucido)',
 'Traditional Italian polished plaster made from lime + marble dust. Applied in 3-8 thin coats then burnished to a marble-like sheen. Interior only. Premium finish — £120-250/m² supply+labour.',
 'Two families: MARMORINO — slightly textured marble finish, matte-to-satin. STUCCO LUCIDO — highly polished, glass-smooth, mirror-like sheen. Application: skim thin (0.5-1mm) coats of tinted lime + marble powder plaster with a flexible steel trowel, each coat cross-cutting the last, burnishing between coats. Final coat is buffed with a steel trowel + optionally waxed. Skill level = SPECIALIST — 5-10 years training. Cost: £120-250/m² depending on complexity + colour. Life: 40+ years in dry interior. Best for: feature walls in living rooms, hotel lobbies, restaurants, high-end kitchens (with waxed finish), bathrooms (with mineral sealer). Not for exterior use. Brands: Novacolor, San Marco, Firenzecolor.',
 array['venetian-plaster','render-polish','feature-wall']::text[],
 array['specialist-materials']::text[],
 array['renderer','plasterer','decorative-renderer']::text[],
 'https://www.novacolor.co.uk/', 'manufacturer', 'Novacolor', 0.90),

-- Brick-effect
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='brick-effect'),
 'method', 'Brick-effect render',
 'Render carved or stamped to imitate brick courses. Same technique as ashlar stone-effect but with brick-sized rectangles + brick colours. Popular for chimney breasts, garden walls, and disguising ugly substrates.',
 'Method: apply 3-coat render as for stone-effect, then carve joint lines to imitate brick coursing (65-75mm bed + 10-15mm perp joints, English or Flemish bond). Colour with brick-orange, red, buff, or grey oxide stains. Finer texture than stone (bricks are smoother than natural stone). Some renderers use silicone rubber brick stamps rolled or pressed into wet render for faster, more uniform coverage. Cost £60-110/m² supply+labour. Best for: fireplaces, chimney breasts, feature walls, garden walls, retro-fit to ugly cavity walls that can''t take real brick slips. Downsides: obvious to a builder''s eye that it''s render; heritage inspectors reject on listed buildings.',
 array['brick-effect','render-carve','render-stamp','render-texture']::text[],
 array['building-merchant','render-supplier']::text[],
 array['renderer','decorative-renderer']::text[],
 'https://www.plasteringcompany.co.uk/', 'trade-body', 'FPDC', 0.89),

-- Timber-effect
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='timber-effect'),
 'method', 'Timber-effect render — mock-Tudor + modern timber look',
 'Render carved + textured to imitate timber grain + planks. Two flavours: mock-Tudor half-timbering (dark timber "beams" laid over white render) and full-plank timber cladding imitation.',
 'Mock-Tudor: apply lime-white render as base, mark out beam positions with tape or chalk, apply a raised bead of dark render (or wood-toned pigmented cement) for the beams. Simpler + cheaper. Full timber-effect: 3-coat render, then carve plank joints + wood-grain texture into finish coat using scoring blades + wire brushes. Colour with wood-tone stains (oak, walnut, weathered grey). Skill-heavy — good execution needs someone with genuine artistic eye. Cost £75-140/m² supply+labour. Best for: feature façades that would otherwise get real cladding but avoid maintenance costs. Not usually suitable for listed buildings — check.',
 array['timber-effect','render-carve','render-texture','render-colour']::text[],
 array['building-merchant','render-supplier']::text[],
 array['renderer','decorative-renderer']::text[],
 'https://www.plasteringcompany.co.uk/', 'trade-body', 'FPDC', 0.87),

-- Rock-face
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='rock-face'),
 'method', 'Rock-face render',
 'Deeply textured render with the appearance of naturally-broken stone. No carved joints — a single rugged textured surface. Suits fireplaces, garden features, cave-look feature walls.',
 'Applied thick (15-25mm) as a base coat + finish coat. While workable, the surface is hand-textured with sponges, wire brushes, chisels, or a purpose-made stone-face tool to create irregular ridges + valleys mimicking naturally-fractured rock. No repeating pattern — the goal is organic randomness. Coloured with 2-4 tones of oxide stain, with darker recesses + lighter high points. Cost £65-100/m² supply+labour. Best for: garden feature walls, chimney breasts, exterior focal points, restaurant interiors going for a "grotto" or "cave" aesthetic. Life 25-40 years exterior with proper sealing.',
 array['rock-face','render-texture','render-colour','feature-wall']::text[],
 array['building-merchant','render-supplier']::text[],
 array['renderer','decorative-renderer']::text[],
 'https://www.plasteringcompany.co.uk/', 'trade-body', 'FPDC', 0.88),

-- Preparation
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='preparation'),
 'best-practice', 'Substrate preparation — the make-or-break step',
 'Failed decorative render almost always fails at the substrate bond, not the finish. Correct prep: clean, sound, keyed, primed. Wrong prep + brilliant finish = failure in 2 years.',
 'Checklist: (1) CLEAN — remove all loose material, dust, oil, algae. Pressure-wash + dry thoroughly. (2) SOUND — cut out any loose or cracked masonry, patch with matching brick/stone. (3) KEY — smooth surfaces need mechanical key (score with a chisel, or use SBR + sand) OR bonding primer. (4) MOISTURE — substrate must be BELOW 5% moisture reading for cement renders, 8% for silicone/acrylic. Dry-out varies: new masonry 1 month per 25mm thickness. (5) PRIMER — SBR bond primer for cement systems, manufacturer''s primer for silicone/acrylic. (6) MESH — always use fibreglass mesh at movement zones (corners, openings, over cracks). (7) BEADS — proper corner, stop, and drip beads installed BEFORE render — retrofit-fitted beads guarantee cracking. Failing at any of these voids every warranty + guarantees failure.',
 array['render-apply-scratch']::text[],
 array['building-merchant','render-supplier']::text[],
 array['renderer','plasterer']::text[],
 'https://www.plasteringcompany.co.uk/', 'trade-body', 'FPDC', 0.95),

-- Failure + repair
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='failure'),
 'troubleshooting', 'Why is my render cracking / blowing / staining?',
 'Cracks: substrate movement, wrong mix ratio, no expansion joints. Blowing (delamination): poor bond to substrate, moisture behind render, wrong primer. Staining: green algae, iron oxide from mesh, or improper sealing.',
 'HAIRLINE CRACKS (under 0.3mm) — usually cosmetic; caused by drying shrinkage. Fill with flexible masonry crack-filler + touch up with matching render. WIDE CRACKS (over 0.3mm) — substrate movement or missing expansion joints. Need engineered repair: cut out full crack, install movement joint, re-render each side. BLOWING/DELAMINATION (render sounds hollow when tapped) — bond failure, usually moisture from behind the render or wrong substrate prep. Cut out affected areas, treat substrate, re-render. GREEN ALGAE — normal on north-facing walls; wash with fungicidal cleaner every 3-5 years. YELLOW/ORANGE STAINING — iron oxide from steel mesh or reinforcement bleeding through. Prevention: only use stainless steel or fibreglass mesh. Repair: sealant + specialist paint. WHITE POWDER (efflorescence) — soluble salts wicking to the surface. Wash off with clean water + wire brush; if persistent, apply anti-efflorescence sealer.',
 array['render-crack-hairline','render-crack-blowing']::text[],
 array['building-merchant']::text[],
 array['renderer','plasterer']::text[],
 'https://www.plasteringcompany.co.uk/', 'trade-body', 'FPDC', 0.92),

-- Regulations
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='regulations'),
 'regulation', 'UK regulations — render + Building Regs',
 'Approved Doc C (moisture): render must weatherproof but allow drying. Approved Doc L (thermal): EWI render systems must meet U-value targets. Approved Doc B (fire): high-rise (18m+) requires A1/A2 rated non-combustible render. Listed buildings: consent required.',
 'MOISTURE (Doc C): external render must resist penetrating rain but not trap interstitial condensation. Silicone > lime > acrylic > cement for breathability. Below-DPC render is a common failure point + notifiable if part of habitable structure. THERMAL (Doc L): if render forms part of EWI (external wall insulation) retrofit, the overall wall must meet current U-value (0.30 W/m²K new-build, 0.55 refurb typical). Notify Building Control. FIRE (Doc B): post-Grenfell, buildings ≥18m or specific higher-risk residential must use A1/A2-rated non-combustible render (mineral-based, not organic). Regulation 7 amendments 2018 + 2022. LISTED + CONSERVATION: any external material change on listed buildings needs Listed Building Consent from local authority. Cement render on lime-built pre-1919 property is frequently rejected + causes irreversible damage. PLANNING: repainting/re-rendering existing wall = usually permitted development; SIGNIFICANT change of appearance in a conservation area may need planning consent. Check with local authority planning dept before committing.',
 array[]::text[],
 array['building-merchant']::text[],
 array['renderer','building-inspector','structural-engineer']::text[],
 'https://www.gov.uk/government/publications/approved-document-c', 'gov', 'gov.uk Approved Doc C', 0.97),

-- Safety
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='safety'),
 'safety', 'Rendering safety — silica dust, height, cement burns',
 'Top 3 hazards: (1) silica dust from cutting/mixing cement products (RCS is class 1 carcinogen — always use FFP3 mask + wet-cutting), (2) working at height on scaffold/ladders (falls are #1 UK construction fatality), (3) cement burns + skin sensitisation from prolonged contact.',
 'SILICA (RCS): HSE workplace exposure limit is 0.1 mg/m³ 8-hour TWA. Cutting or mixing dry cement/render products indoors without extraction breaches this easily. Use FFP3 masks minimum; RPE with assigned protection factor 20+ for prolonged exposure. Damp materials before cutting. HSE Control of Substances Hazardous to Health (COSHH 2002) applies. HEIGHT: renders are typically applied from scaffold. Use CISRS-certified scaffold; independent scaffold ≥1200mm working width; guardrails at 950mm + 470mm; toe boards. Never work off ladders for extended render application. CEMENT BURNS: wet cement is highly alkaline (pH 12-13). Full PPE: nitrile gloves, waterproof trousers, safety boots, splash goggles. Wash any splash off immediately for 15 minutes with clean water. Skin sensitisation (dermatitis) develops with prolonged contact — some renderers develop chrome allergy after 5-10 years, career-ending. EYE SPLASH: 15 min rinse + A&E. Note HSE reports ~500 UK construction workers/year with severe cement burns; ~1500/year with chrome-related occupational asthma.',
 array['silica-dust']::text[],
 array['building-merchant']::text[],
 array['renderer','plasterer']::text[],
 'https://www.hse.gov.uk/construction/', 'gov', 'HSE', 0.98),

-- Materials
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='materials'),
 'material', 'Render material families explained',
 'Four families: (1) cement-based (monocouche, stone-effect base) — hard-wearing, brittle. (2) polymer-modified (acrylic, silicone) — flexible, breathable. (3) lime-based — traditional, breathable, heritage. (4) polymer + lime hybrid — modern balance. Choose by substrate + climate + heritage.',
 'CEMENT-BASED: Portland cement + sand + water ± lime ± SBR ± fibres. Cheap, hard, low flexibility, brittle. Good for: cavity-wall new build, garden walls, sturdy substrates. Bad for: EWI, movement-prone walls, heritage. POLYMER-MODIFIED SILICONE: silicone resin binder, water-repellent + breathable. Premium price. Best for: EWI, coastal, north-facing, high-wind. POLYMER-MODIFIED ACRYLIC: acrylic dispersion. Flexible but less breathable. Best for: EWI on dry modern builds. LIME: hydraulic (NHL) or non-hydraulic (putty). Slow set, high breathability, self-healing microcracks. Mandatory on pre-1919 solid walls + listed buildings. HYBRID: lime + silicone combos (e.g. Sto-Silco). Try to balance breathability + durability. Colour: through-coloured (in the mix) lasts longer than paint-on top coats; oxide stains for stone-effect are UV-stable if the correct grade is used. Any building merchant on Networkers can source all four families.',
 array[]::text[],
 array['building-merchant','render-supplier','specialist-materials']::text[],
 array['renderer','plasterer']::text[],
 'https://www.plasteringcompany.co.uk/', 'trade-body', 'FPDC', 0.93),

-- Tools
('decorative-rendering',
 (select id from hammerex_knowledge_topics where trade_slug='decorative-rendering' and slug='tools'),
 'tool', 'Rendering tools — essentials + specialist',
 'Essentials: mixing bucket + paddle, hawk + trowel, straight edge / darby, sponge float, wire brush, feather edge, corner beads + snips. Stone-effect adds: v-scoring blade or purpose-made ashlar tool. Roughcast/pebble dash: scoop + hawk. Tyrolean: rotary gun.',
 'ESSENTIALS (£300-500 kit): 12L bucket, 900W paddle mixer, 350mm hawk, 280mm+320mm plastering trowels, 1200mm feather edge, 900mm darby, sponge float, wooden float, corner + stop beads, tin snips, plumb line, level. FINISH TOOLS: fine wire brush, natural sponge, texture roller, v-scoring blade (for stone-effect), ashlar carving tool (Marshalltown or Aran), silicone brick stamps. THROWN/SPRAYED: Tyrolean rotary gun (£150-300), scoop trowel + hawk (for pebble dash), harling scoop. POLISHED: flexible steel Venetian trowel (Kraft, Marshalltown Italian). ACCESS: scaffold (hired), stilts (interior only), long-handled tools for high work. MIXING: continuous mixer or bucket-batch depending on volume. For jobs over 30 m² of monocouche a spray application saves significant time — hire spray applicator + operator via Networkers plant-hire merchants.',
 array[]::text[],
 array['building-merchant','render-supplier']::text[],
 array['renderer','plasterer']::text[],
 'https://www.plasteringcompany.co.uk/', 'trade-body', 'FPDC', 0.90)

on conflict do nothing;
