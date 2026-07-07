-- ai_visualiser_taxonomy_leaves — initial seed.
--
-- Kitchens is the wedge trade so it gets a full option set. Other
-- leaves are seeded lighter and will be extended as we onboard those
-- trades. Merchants pick leaves at install time; the design tree the
-- customer sees is built from these options intersected with the
-- merchant's actual product catalogue.
--
-- Idempotent: safe to re-run. Admin can edit via /admin/apps/ai-visualiser.

BEGIN;

-- =====================================================================
-- KITCHENS (the wedge)
-- =====================================================================
INSERT INTO ai_visualiser_taxonomy_leaves
  (slug, trade_slug, display_name, synonyms, classifier_prompts,
   render_style_options, render_material_options, render_colour_options,
   render_hardware_options)
VALUES
  (
    'kitchen_full',
    'kitchen-fitter',
    'Kitchen (full room)',
    ARRAY[
      'kitchen','kitchen room','kitchen cabinets','kitchen units',
      'fitted kitchen','kitchen worktop','kitchen island'
    ],
    ARRAY[
      'a kitchen with cabinets and worktops',
      'a fitted kitchen with an island',
      'kitchen cupboards on a wall',
      'a kitchen with a range cooker',
      'a modern kitchen interior'
    ],
    '[
      {"key":"shaker","label":"Shaker"},
      {"key":"slab","label":"Slab (flat)"},
      {"key":"handleless","label":"Handleless"},
      {"key":"in-frame","label":"In-frame"},
      {"key":"traditional","label":"Traditional"},
      {"key":"country","label":"Country"}
    ]'::jsonb,
    '[
      {"key":"painted-mdf","label":"Painted MDF"},
      {"key":"solid-oak","label":"Solid oak"},
      {"key":"solid-walnut","label":"Solid walnut"},
      {"key":"painted-ash","label":"Painted ash"},
      {"key":"birch-ply","label":"Birch ply"},
      {"key":"veneered","label":"Veneered"}
    ]'::jsonb,
    '[
      {"key":"cornforth-white","label":"Cornforth White","hex":"#D9D5CB"},
      {"key":"pigeon","label":"Pigeon","hex":"#8C948A"},
      {"key":"studio-green","label":"Studio Green","hex":"#334036"},
      {"key":"hague-blue","label":"Hague Blue","hex":"#28323C"},
      {"key":"sage","label":"Sage","hex":"#A8B29A"},
      {"key":"navy","label":"Navy","hex":"#1E2A3A"},
      {"key":"graphite","label":"Graphite","hex":"#3A3A3A"},
      {"key":"cream","label":"Cream","hex":"#F1E9D2"},
      {"key":"clay","label":"Clay","hex":"#B49E85"}
    ]'::jsonb,
    '[
      {"key":"brushed-brass-bar","label":"Brushed brass bar"},
      {"key":"brushed-brass-knob","label":"Brushed brass knob"},
      {"key":"matte-black-bar","label":"Matte black bar"},
      {"key":"matte-black-knob","label":"Matte black knob"},
      {"key":"chrome-cup","label":"Chrome cup pull"},
      {"key":"chrome-bar","label":"Chrome bar"},
      {"key":"handleless-jprofile","label":"Handleless J-profile"}
    ]'::jsonb
  ),

-- =====================================================================
-- CARPENTRY — deliberately excludes staircases so the merchant-scope
-- rule is demonstrated: a carpenter can tick doors + loft ladders and
-- their Visualiser will refuse staircase uploads.
-- =====================================================================
  (
    'internal_doors',
    'carpenter',
    'Internal Doors',
    ARRAY['door','internal door','room door','panel door'],
    ARRAY[
      'an internal door in a doorway',
      'a wooden door in a hallway',
      'a panel door with handles',
      'a bedroom door'
    ],
    '[
      {"key":"4-panel","label":"4 Panel"},
      {"key":"6-panel","label":"6 Panel"},
      {"key":"shaker","label":"Shaker"},
      {"key":"cottage","label":"Cottage"},
      {"key":"flush","label":"Flush"},
      {"key":"glazed","label":"Glazed"}
    ]'::jsonb,
    '[
      {"key":"solid-oak","label":"Solid oak"},
      {"key":"engineered-oak","label":"Engineered oak"},
      {"key":"pine","label":"Pine"},
      {"key":"walnut","label":"Walnut"},
      {"key":"primed-white","label":"Primed white MDF"}
    ]'::jsonb,
    '[
      {"key":"natural-oak","label":"Natural oak","hex":"#C9A876"},
      {"key":"walnut-stain","label":"Walnut stain","hex":"#4E342E"},
      {"key":"white","label":"White","hex":"#FFFFFF"},
      {"key":"grey","label":"Grey","hex":"#909090"},
      {"key":"black","label":"Black","hex":"#1B1B1B"}
    ]'::jsonb,
    '[
      {"key":"chrome-lever","label":"Chrome lever"},
      {"key":"brass-lever","label":"Brass lever"},
      {"key":"black-lever","label":"Matte black lever"},
      {"key":"brass-knob","label":"Brass knob"}
    ]'::jsonb
  ),
  (
    'loft_ladders',
    'carpenter',
    'Loft Ladders',
    ARRAY['loft ladder','attic ladder','folding loft ladder'],
    ARRAY[
      'a loft hatch in a ceiling',
      'a folding ladder into a loft',
      'an attic entrance with a ladder'
    ],
    '[
      {"key":"folding-timber","label":"Folding timber"},
      {"key":"folding-aluminium","label":"Folding aluminium"},
      {"key":"concertina","label":"Concertina"},
      {"key":"electric","label":"Electric"}
    ]'::jsonb,
    '[
      {"key":"timber","label":"Timber"},
      {"key":"aluminium","label":"Aluminium"},
      {"key":"steel","label":"Steel"}
    ]'::jsonb,
    '[
      {"key":"natural","label":"Natural","hex":"#C9A876"},
      {"key":"white","label":"White","hex":"#FFFFFF"},
      {"key":"grey","label":"Grey","hex":"#909090"}
    ]'::jsonb,
    '[
      {"key":"insulated-hatch","label":"Insulated hatch"},
      {"key":"handrail","label":"Handrail"}
    ]'::jsonb
  ),

-- =====================================================================
-- STAIRCASES — separate trade, separate leaf. A carpenter who doesn't
-- tick this cannot render staircases even if their trade includes them.
-- =====================================================================
  (
    'staircase_full',
    'staircase-manufacturer',
    'Staircase (full)',
    ARRAY['staircase','stairs','stair','stairway'],
    ARRAY[
      'a staircase inside a house',
      'stairs with balusters and a handrail',
      'a wooden staircase with newel posts',
      'a glass balustrade staircase'
    ],
    '[
      {"key":"traditional","label":"Traditional"},
      {"key":"contemporary","label":"Contemporary"},
      {"key":"glass","label":"Glass balustrade"},
      {"key":"floating","label":"Floating tread"},
      {"key":"colonial","label":"Colonial"}
    ]'::jsonb,
    '[
      {"key":"oak","label":"Oak"},
      {"key":"walnut","label":"Walnut"},
      {"key":"pine","label":"Pine"},
      {"key":"painted","label":"Painted MDF"},
      {"key":"glass-oak","label":"Glass + oak"}
    ]'::jsonb,
    '[
      {"key":"natural-oak","label":"Natural oak","hex":"#C9A876"},
      {"key":"dark-walnut","label":"Dark walnut","hex":"#4E342E"},
      {"key":"white","label":"White","hex":"#FFFFFF"},
      {"key":"grey","label":"Grey","hex":"#909090"}
    ]'::jsonb,
    '[
      {"key":"square-spindle","label":"Square spindle"},
      {"key":"stop-chamfered","label":"Stop chamfered spindle"},
      {"key":"twist","label":"Twist spindle"},
      {"key":"glass-panel","label":"Glass panel"},
      {"key":"black-metal","label":"Black metal rod"},
      {"key":"newel-square","label":"Square newel post"},
      {"key":"newel-turned","label":"Turned newel post"}
    ]'::jsonb
  ),

-- =====================================================================
-- BATHROOMS
-- =====================================================================
  (
    'bathroom_full',
    'bathroom-fitter',
    'Bathroom (full room)',
    ARRAY['bathroom','en-suite','shower room','wet room'],
    ARRAY[
      'a bathroom with a bath and basin',
      'a shower room',
      'a bathroom with a vanity unit',
      'a wet room'
    ],
    '[
      {"key":"modern","label":"Modern"},
      {"key":"traditional","label":"Traditional"},
      {"key":"industrial","label":"Industrial"},
      {"key":"spa","label":"Spa"},
      {"key":"wet-room","label":"Wet room"}
    ]'::jsonb,
    '[
      {"key":"porcelain-tile","label":"Porcelain tile"},
      {"key":"marble","label":"Marble"},
      {"key":"microcement","label":"Microcement"},
      {"key":"stone","label":"Stone"}
    ]'::jsonb,
    '[
      {"key":"cool-white","label":"Cool white","hex":"#F5F7F8"},
      {"key":"warm-stone","label":"Warm stone","hex":"#E8DDCB"},
      {"key":"charcoal","label":"Charcoal","hex":"#2E3033"},
      {"key":"forest-green","label":"Forest green","hex":"#2E4E3C"},
      {"key":"navy","label":"Navy","hex":"#1E2A3A"}
    ]'::jsonb,
    '[
      {"key":"chrome-tap","label":"Chrome tap"},
      {"key":"brass-tap","label":"Brushed brass tap"},
      {"key":"black-tap","label":"Matte black tap"},
      {"key":"rain-shower","label":"Rain shower"}
    ]'::jsonb
  ),

-- =====================================================================
-- FLOORING
-- =====================================================================
  (
    'flooring_room',
    'flooring-installer',
    'Flooring (room)',
    ARRAY['floor','flooring','floorboards','laminate','LVT','carpet'],
    ARRAY[
      'a room with wooden flooring',
      'a room with tiled flooring',
      'a room with carpet',
      'a room with LVT plank flooring'
    ],
    '[
      {"key":"engineered-wood","label":"Engineered wood"},
      {"key":"solid-wood","label":"Solid wood"},
      {"key":"lvt-plank","label":"LVT plank"},
      {"key":"laminate","label":"Laminate"},
      {"key":"carpet","label":"Carpet"},
      {"key":"parquet","label":"Parquet"},
      {"key":"herringbone","label":"Herringbone"}
    ]'::jsonb,
    '[
      {"key":"oak","label":"Oak"},
      {"key":"walnut","label":"Walnut"},
      {"key":"ash","label":"Ash"},
      {"key":"pine","label":"Pine"},
      {"key":"lvt","label":"LVT"},
      {"key":"wool","label":"Wool"}
    ]'::jsonb,
    '[
      {"key":"natural-oak","label":"Natural oak","hex":"#C9A876"},
      {"key":"smoked-oak","label":"Smoked oak","hex":"#5C4A3A"},
      {"key":"grey-wash","label":"Grey wash","hex":"#A0968A"},
      {"key":"white-wash","label":"White wash","hex":"#E4DBCF"},
      {"key":"dark-walnut","label":"Dark walnut","hex":"#3E2A20"}
    ]'::jsonb,
    '[
      {"key":"scotia-beading","label":"Scotia beading"},
      {"key":"threshold-strip","label":"Threshold strip"}
    ]'::jsonb
  ),

-- =====================================================================
-- DRIVEWAY / LANDSCAPING (external)
-- =====================================================================
  (
    'driveway_full',
    'driveway-installer',
    'Driveway',
    ARRAY['driveway','drive','block paving','tarmac drive','resin drive'],
    ARRAY[
      'a driveway in front of a house',
      'a block paved driveway',
      'a resin driveway',
      'a tarmac drive'
    ],
    '[
      {"key":"block-paving","label":"Block paving"},
      {"key":"resin-bound","label":"Resin bound"},
      {"key":"tarmac","label":"Tarmac"},
      {"key":"gravel","label":"Gravel"},
      {"key":"pattern-imprinted","label":"Pattern imprinted concrete"}
    ]'::jsonb,
    '[
      {"key":"concrete-block","label":"Concrete block"},
      {"key":"clay-block","label":"Clay block"},
      {"key":"natural-stone","label":"Natural stone"},
      {"key":"resin-stone","label":"Resin + stone"},
      {"key":"tarmac","label":"Tarmac"}
    ]'::jsonb,
    '[
      {"key":"charcoal","label":"Charcoal","hex":"#2E3033"},
      {"key":"buff","label":"Buff","hex":"#C8B99A"},
      {"key":"brindle","label":"Brindle","hex":"#7A6A5A"},
      {"key":"red","label":"Red","hex":"#8E3B2A"},
      {"key":"silver-grey","label":"Silver grey","hex":"#A9AFB2"}
    ]'::jsonb,
    '[
      {"key":"edge-kerb","label":"Edge kerb"},
      {"key":"drainage-channel","label":"Drainage channel"},
      {"key":"soakaway","label":"Soakaway"}
    ]'::jsonb
  ),

-- =====================================================================
-- FENCING
-- =====================================================================
  (
    'garden_fence',
    'fencer',
    'Garden Fence',
    ARRAY['fence','fencing','panel fence','garden fence','feather edge'],
    ARRAY[
      'a garden fence',
      'a wooden fence panel',
      'a feather edge fence',
      'a boundary fence in a garden'
    ],
    '[
      {"key":"feather-edge","label":"Feather edge"},
      {"key":"lap-panel","label":"Lap panel"},
      {"key":"closeboard","label":"Closeboard"},
      {"key":"slatted","label":"Slatted"},
      {"key":"picket","label":"Picket"},
      {"key":"trellis-top","label":"Trellis top"}
    ]'::jsonb,
    '[
      {"key":"pressure-treated-pine","label":"Pressure treated pine"},
      {"key":"cedar","label":"Cedar"},
      {"key":"oak","label":"Oak"},
      {"key":"composite","label":"Composite"}
    ]'::jsonb,
    '[
      {"key":"natural-timber","label":"Natural timber","hex":"#8A6D4B"},
      {"key":"dark-oak-stain","label":"Dark oak stain","hex":"#4E342E"},
      {"key":"forest-green","label":"Forest green","hex":"#2E4E3C"},
      {"key":"charcoal","label":"Charcoal","hex":"#2E3033"},
      {"key":"grey-wash","label":"Grey wash","hex":"#A0968A"}
    ]'::jsonb,
    '[
      {"key":"concrete-posts","label":"Concrete posts"},
      {"key":"timber-posts","label":"Timber posts"},
      {"key":"gravel-boards","label":"Gravel boards"},
      {"key":"post-caps","label":"Post caps"}
    ]'::jsonb
  ),

-- =====================================================================
-- ROOFING
-- =====================================================================
  (
    'roof_tiling',
    'roofer',
    'Pitched Roof',
    ARRAY['roof','roof tile','pitched roof','slate roof','clay tile'],
    ARRAY[
      'a pitched roof on a house',
      'a slate roof',
      'a clay tile roof',
      'a house roof from outside'
    ],
    '[
      {"key":"clay-tile","label":"Clay tile"},
      {"key":"concrete-tile","label":"Concrete tile"},
      {"key":"natural-slate","label":"Natural slate"},
      {"key":"fibre-slate","label":"Fibre-cement slate"},
      {"key":"metal-standing-seam","label":"Metal standing seam"}
    ]'::jsonb,
    '[
      {"key":"clay","label":"Clay"},
      {"key":"concrete","label":"Concrete"},
      {"key":"welsh-slate","label":"Welsh slate"},
      {"key":"spanish-slate","label":"Spanish slate"},
      {"key":"zinc","label":"Zinc"}
    ]'::jsonb,
    '[
      {"key":"terracotta","label":"Terracotta","hex":"#A94F3C"},
      {"key":"anthracite","label":"Anthracite","hex":"#2A2E33"},
      {"key":"slate-grey","label":"Slate grey","hex":"#4A5259"},
      {"key":"black","label":"Black","hex":"#111111"},
      {"key":"heather-mix","label":"Heather mix","hex":"#6B4E5B"}
    ]'::jsonb,
    '[
      {"key":"ridge-tiles","label":"Ridge tiles"},
      {"key":"lead-flashing","label":"Lead flashing"},
      {"key":"velux-window","label":"Velux window"},
      {"key":"dry-verge","label":"Dry verge system"}
    ]'::jsonb
  ),

-- =====================================================================
-- DECORATING
-- =====================================================================
  (
    'internal_decorating',
    'decorator',
    'Interior Decoration',
    ARRAY['painting','decorating','wall colour','feature wall'],
    ARRAY[
      'a painted interior wall',
      'a room ready for decorating',
      'a feature wall in a living room',
      'a hallway with painted walls'
    ],
    '[
      {"key":"flat-matt","label":"Flat matt"},
      {"key":"eggshell","label":"Eggshell"},
      {"key":"satin","label":"Satin"},
      {"key":"gloss","label":"Gloss"},
      {"key":"wallpaper","label":"Wallpaper"},
      {"key":"feature-wall","label":"Feature wall"}
    ]'::jsonb,
    '[
      {"key":"emulsion","label":"Emulsion"},
      {"key":"acrylic","label":"Acrylic"},
      {"key":"chalk","label":"Chalk"},
      {"key":"lime-wash","label":"Lime wash"}
    ]'::jsonb,
    '[
      {"key":"cornforth-white","label":"Cornforth White","hex":"#D9D5CB"},
      {"key":"pigeon","label":"Pigeon","hex":"#8C948A"},
      {"key":"stiffkey-blue","label":"Stiffkey Blue","hex":"#374A5C"},
      {"key":"studio-green","label":"Studio Green","hex":"#334036"},
      {"key":"pointing","label":"Pointing","hex":"#E8E3D8"},
      {"key":"railings","label":"Railings","hex":"#2C2F35"},
      {"key":"terracotta","label":"Terracotta","hex":"#A94F3C"}
    ]'::jsonb,
    '[]'::jsonb
  )
ON CONFLICT (slug) DO NOTHING;

COMMIT;
