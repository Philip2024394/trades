// Merchant Pro — product category enum + calculator + trade mapping.
//
// Single source of truth that drives:
//   1. The category dropdown on the product editor
//   2. Which calculator renders on the PDP (category → default calculator type)
//   3. Which trade-installer services can plug into which calculator
//
// Adding a new calculator later = (a) add the merchant_category enum
// entry, (b) add the matching CalculatorType, (c) wire one row into
// CATEGORY_TO_CALCULATOR + TRADE_TO_CALCULATOR. Existing products in
// that category auto-get the calculator.

/** Structured product-category enum. Saved on each product so the
 *  storefront can group + the PDP can pick the right calculator. */
export type MerchantCategory =
  | "paint"
  | "flooring"
  | "tiles"
  | "aggregates"
  | "concrete"
  | "mortar"
  | "bricks_blocks"
  | "plasterboard"
  | "insulation"
  | "decking"
  | "fencing"
  | "paving"
  | "skirting"
  | "roof_tiles"
  | "wallpaper"
  | "render"
  | "turf"
  | "hand_tools"
  | "fixings"
  | "other";

/** Calculator surfaces. Each maps to a <MaterialCalculator> component
 *  variant. Sub-set of MerchantCategory — categories like hand_tools /
 *  fixings / other don't need a calculator. */
export type CalculatorType =
  | "paint"
  | "flooring"
  | "tiles"
  | "gravel"
  | "concrete"
  | "mortar"
  | "bricks"
  | "plasterboard"
  | "insulation"
  | "decking"
  | "fencing"
  | "paving"
  | "skirting"
  | "roof_tiles"
  | "wallpaper"
  | "render"
  | "turf";

/** Calculator override values stored on the product. "auto" or NULL =
 *  fall back to the category map. "none" = hide entirely. */
export type CalculatorOverride = "auto" | "none" | CalculatorType;

export type MerchantCategoryDef = {
  slug: MerchantCategory;
  label: string;
  /** Calculator that auto-shows on PDPs of products in this category.
   *  NULL = no calculator (e.g. hand tools, fixings, fixings, other). */
  calculator: CalculatorType | null;
  /** Short description for the editor dropdown — helps the merchant
   *  pick the right one. */
  hint: string;
};

export const MERCHANT_CATEGORIES: MerchantCategoryDef[] = [
  { slug: "paint", label: "Paint", calculator: "paint", hint: "Emulsion, satinwood, gloss, primer — anything sold by the tin/litre." },
  { slug: "flooring", label: "Flooring", calculator: "flooring", hint: "Laminate, vinyl, engineered wood, LVT — sold by the box covering m²." },
  { slug: "tiles", label: "Tiles", calculator: "tiles", hint: "Wall, floor, mosaic, porcelain — anything where the customer needs m² → tile count." },
  { slug: "aggregates", label: "Aggregates (gravel, sand, ballast)", calculator: "gravel", hint: "Gravel, pebbles, sharp sand, building sand, ballast, MOT Type 1 — bagged or bulk." },
  { slug: "concrete", label: "Concrete (ready-mix bags)", calculator: "concrete", hint: "Pre-mix concrete bags, post-mix, foundation concrete." },
  { slug: "mortar", label: "Mortar (cement + sand mix)", calculator: "mortar", hint: "Cement, lime, mortar plasticiser, ready-mix mortar." },
  { slug: "bricks_blocks", label: "Bricks & blocks", calculator: "bricks", hint: "Facing bricks, engineering bricks, concrete blocks, aircrete." },
  { slug: "plasterboard", label: "Plasterboard & accessories", calculator: "plasterboard", hint: "Standard / moisture / fire / acoustic boards + screws + tape + filler." },
  { slug: "insulation", label: "Insulation", calculator: "insulation", hint: "Loft roll, PIR boards, cavity slabs, acoustic insulation." },
  { slug: "decking", label: "Decking", calculator: "decking", hint: "Timber decking boards, composite boards, joists, bearers." },
  { slug: "fencing", label: "Fencing", calculator: "fencing", hint: "Panels, posts, gravel boards, post concrete, fixings." },
  { slug: "paving", label: "Paving slabs / setts", calculator: "paving", hint: "Patio slabs, block paving, granite setts, sub-base materials." },
  { slug: "skirting", label: "Skirting / coving / architrave", calculator: "skirting", hint: "MDF, pine, oak skirting; coving; door architrave — sold by the linear m." },
  { slug: "roof_tiles", label: "Roof tiles & slates", calculator: "roof_tiles", hint: "Concrete tiles, clay tiles, natural slate, ridge tiles, felt + battens." },
  { slug: "wallpaper", label: "Wallpaper & paste", calculator: "wallpaper", hint: "Standard rolls (10.05m × 0.52m) + paste." },
  { slug: "render", label: "Render", calculator: "render", hint: "Cement render, K Rend, silicone render, mesh, primer." },
  { slug: "turf", label: "Turf / topsoil", calculator: "turf", hint: "Lawn turf rolls, topsoil bags or bulk." },
  { slug: "hand_tools", label: "Hand tools", calculator: null, hint: "Hammers, saws, levels, trowels — no calculator needed." },
  { slug: "fixings", label: "Fixings (screws, nails, wall plugs)", calculator: null, hint: "Boxes/tubs of fixings — usually no calculator." },
  { slug: "other", label: "Other", calculator: null, hint: "Anything that doesn't fit the categories above." }
];

const CATEGORY_BY_SLUG: Record<string, MerchantCategoryDef> = Object.fromEntries(
  MERCHANT_CATEGORIES.map((c) => [c.slug, c])
);

export function getCategory(slug: string | null | undefined): MerchantCategoryDef | null {
  if (!slug) return null;
  return CATEGORY_BY_SLUG[slug] ?? null;
}

/** Trade types that can plug into the calculator framework. Each trade
 *  declares which CalculatorType it installs against — the calculator
 *  on that trade's service product then renders a labour line. */
export type ServiceTradeType =
  | "carpenter"
  | "joiner"
  | "tiler"
  | "plasterer"
  | "bricklayer"
  | "concrete_finisher"
  | "roofer"
  | "painter_decorator"
  | "landscaper"
  | "carpet_fitter"
  | "fencer"
  | "insulation_installer";

export type ServiceTradeDef = {
  slug: ServiceTradeType;
  label: string;
  /** Calculators this trade can install against. The first entry is the
   *  default offered on the service product's PDP. */
  calculators: CalculatorType[];
  /** Default unit for service_rate_pence — what the trade typically
   *  charges per (e.g. tilers per m², fencers per linear m). */
  defaultRateUnit: "m2" | "linear_m" | "item" | "tonne" | "hour" | "day";
};

export const SERVICE_TRADES: ServiceTradeDef[] = [
  { slug: "carpenter", label: "Carpenter", calculators: ["decking", "flooring", "skirting"], defaultRateUnit: "m2" },
  { slug: "joiner", label: "Joiner", calculators: ["skirting", "decking", "flooring"], defaultRateUnit: "m2" },
  { slug: "tiler", label: "Tiler", calculators: ["tiles"], defaultRateUnit: "m2" },
  { slug: "plasterer", label: "Plasterer", calculators: ["plasterboard", "render", "mortar"], defaultRateUnit: "m2" },
  { slug: "bricklayer", label: "Bricklayer", calculators: ["bricks", "mortar"], defaultRateUnit: "m2" },
  { slug: "concrete_finisher", label: "Concrete finisher", calculators: ["concrete", "paving"], defaultRateUnit: "m2" },
  { slug: "roofer", label: "Roofer", calculators: ["roof_tiles", "insulation"], defaultRateUnit: "m2" },
  { slug: "painter_decorator", label: "Painter / Decorator", calculators: ["paint", "wallpaper"], defaultRateUnit: "m2" },
  { slug: "landscaper", label: "Landscaper", calculators: ["gravel", "turf", "paving", "fencing"], defaultRateUnit: "m2" },
  { slug: "carpet_fitter", label: "Carpet fitter", calculators: ["flooring"], defaultRateUnit: "m2" },
  { slug: "fencer", label: "Fencer", calculators: ["fencing"], defaultRateUnit: "linear_m" },
  { slug: "insulation_installer", label: "Insulation installer", calculators: ["insulation"], defaultRateUnit: "m2" }
];

const TRADE_BY_SLUG: Record<string, ServiceTradeDef> = Object.fromEntries(
  SERVICE_TRADES.map((t) => [t.slug, t])
);

export function getServiceTrade(slug: string | null | undefined): ServiceTradeDef | null {
  if (!slug) return null;
  return TRADE_BY_SLUG[slug] ?? null;
}

/** Reverse map — given a product's merchant_category, return the
 *  `primary_trade` slugs that typically install/work with that
 *  category. Drives the Trade Connections carousel: a product tagged
 *  `paint` surfaces local listings whose primary_trade is "painter" /
 *  "painter-decorator" / etc.
 *
 *  These slugs match the real `primary_trade` values in the
 *  hammerex_trade_off_listings table (see TRADE_OFF_TRADES in
 *  src/lib/tradeOff.ts). We list multiple slugs per category because
 *  the same job is done by several trade titles in UK practice
 *  (e.g. carpenter ≈ joiner ≈ trim-carpenter for skirting). */
export function tradesForCategory(
  category: MerchantCategory | string | null | undefined
): string[] {
  if (!category) return [];
  switch (category) {
    case "paint":
      return ["painter"];
    case "wallpaper":
      return ["painter"];
    case "flooring":
      return ["flooring-installer", "carpenter", "joiner", "trim-carpenter"];
    case "tiles":
      return ["tiler", "bathroom-fitter"];
    case "aggregates":
      return ["landscaper", "groundworker", "driveway-installer"];
    case "concrete":
      return ["concrete-finisher", "concrete-specialist", "formworker", "groundworker"];
    case "mortar":
      return ["bricklayer", "plasterer", "block-layer", "stonemason"];
    case "bricks_blocks":
      return ["bricklayer", "block-layer", "stonemason"];
    case "plasterboard":
      return ["plasterer", "drywaller", "taper-and-finisher"];
    case "insulation":
      return ["insulation-installer", "roofer", "drywaller"];
    case "decking":
      return ["carpenter", "joiner", "landscaper", "garden-room-installer"];
    case "fencing":
      return ["fencing-installer", "landscaper"];
    case "paving":
      return ["driveway-installer", "landscaper", "concrete-finisher", "groundworker"];
    case "skirting":
      return ["carpenter", "joiner", "trim-carpenter"];
    case "roof_tiles":
      return ["roofer", "lead-worker"];
    case "render":
      return ["renderer", "plasterer"];
    case "turf":
      return ["landscaper", "garden-designer"];
    default:
      return [];
  }
}

/** Resolve which calculator should render on a product's PDP. Honours
 *  the per-product override; falls back to the category map; returns
 *  null when no calculator applies (override=none, category has none,
 *  or neither is set). */
export function resolveCalculator(input: {
  merchant_category: string | null | undefined;
  calculator_override: string | null | undefined;
}): CalculatorType | null {
  const override = input.calculator_override;
  if (override === "none") return null;
  if (override && override !== "auto") {
    // Explicit type forced by merchant — only honour it if it's a
    // known CalculatorType. Bad data falls through to the category.
    if (isCalculatorType(override)) return override;
  }
  const cat = getCategory(input.merchant_category);
  return cat?.calculator ?? null;
}

function isCalculatorType(v: string): v is CalculatorType {
  return (
    v === "paint" ||
    v === "flooring" ||
    v === "tiles" ||
    v === "gravel" ||
    v === "concrete" ||
    v === "mortar" ||
    v === "bricks" ||
    v === "plasterboard" ||
    v === "insulation" ||
    v === "decking" ||
    v === "fencing" ||
    v === "paving" ||
    v === "skirting" ||
    v === "roof_tiles" ||
    v === "wallpaper" ||
    v === "render" ||
    v === "turf"
  );
}

// ─────────────────────────────────────────────────────────────────────
// Subcategories — drives the Material Calculator cross-sell engine.
//
// Each calculator scenario (Paint→Full-room, Tiles→Bathroom-floor,
// etc.) declares a list of complementary subcategories. The cross-sell
// panel scans the merchant's other products for matches and renders
// a "Complete your project" section. Anything missing surfaces as a
// plain advisory tip.
// ─────────────────────────────────────────────────────────────────────

export type MerchantSubcategoryDef = {
  /** Stable identifier saved on the product row. */
  slug: string;
  /** Display label shown in the editor dropdown + on cross-sell pills. */
  label: string;
  /** Which top-level merchant_category(ies) this subcategory belongs under.
   *  Drives the editor's subcategory dropdown filter so a Paint product
   *  shows only paint-related subcategories. */
  parentCategories: MerchantCategory[];
};

export const MERCHANT_SUBCATEGORIES: MerchantSubcategoryDef[] = [
  // Paint cross-sell items
  { slug: "paint_brush", label: "Paint brush", parentCategories: ["hand_tools"] },
  { slug: "paint_roller", label: "Paint roller / sleeve", parentCategories: ["hand_tools"] },
  { slug: "paint_tray", label: "Paint tray / kettle", parentCategories: ["hand_tools"] },
  { slug: "masking_tape", label: "Masking tape", parentCategories: ["fixings", "other"] },
  { slug: "sandpaper", label: "Sandpaper / abrasives", parentCategories: ["fixings", "other"] },
  { slug: "drop_sheet", label: "Drop sheet / dust sheet", parentCategories: ["other"] },
  { slug: "filler", label: "Wall filler", parentCategories: ["paint", "other"] },
  { slug: "scraper", label: "Scraper / stripping knife", parentCategories: ["hand_tools"] },
  { slug: "paint_thinner", label: "Paint thinner / white spirit", parentCategories: ["paint", "other"] },
  { slug: "primer", label: "Primer / undercoat", parentCategories: ["paint"] },
  { slug: "fence_paint", label: "Fence / shed paint", parentCategories: ["paint"] },
  { slug: "exterior_paint", label: "Exterior masonry paint", parentCategories: ["paint"] },

  // Flooring cross-sell items
  { slug: "underlay", label: "Underlay", parentCategories: ["flooring"] },
  { slug: "beading", label: "Beading / scotia trim", parentCategories: ["flooring"] },
  { slug: "threshold_bar", label: "Threshold bar", parentCategories: ["flooring", "fixings"] },
  { slug: "floor_adhesive", label: "Floor adhesive", parentCategories: ["flooring", "fixings"] },

  // Tiles cross-sell items
  { slug: "tile_adhesive", label: "Tile adhesive", parentCategories: ["tiles", "fixings"] },
  { slug: "grout", label: "Tile grout", parentCategories: ["tiles", "fixings"] },
  { slug: "tile_spacer", label: "Tile spacers", parentCategories: ["tiles", "fixings"] },
  { slug: "tile_sealant", label: "Tile sealant / silicone", parentCategories: ["tiles", "other"] },
  { slug: "tile_trim", label: "Tile trim / edging", parentCategories: ["tiles", "other"] },

  // Aggregates / paving cross-sell
  { slug: "weed_membrane", label: "Weed membrane", parentCategories: ["aggregates", "other"] },
  { slug: "lawn_edging", label: "Edging", parentCategories: ["paving", "turf", "other"] },
  { slug: "sub_base", label: "MOT Type 1 sub-base", parentCategories: ["aggregates"] },
  { slug: "sharp_sand", label: "Sharp sand", parentCategories: ["aggregates"] },
  { slug: "jointing_compound", label: "Jointing compound", parentCategories: ["paving", "other"] },
  { slug: "pointing_mortar", label: "Pointing mortar", parentCategories: ["mortar", "paving"] },

  // Concrete / mortar / bricks / blocks
  { slug: "rebar", label: "Reinforcement rebar", parentCategories: ["concrete", "fixings"] },
  { slug: "concrete_mesh", label: "Concrete mesh / A142", parentCategories: ["concrete", "fixings"] },
  { slug: "formwork", label: "Formwork timber", parentCategories: ["concrete", "other"] },
  { slug: "lime", label: "Hydrated lime", parentCategories: ["mortar"] },
  { slug: "plasticiser", label: "Mortar plasticiser", parentCategories: ["mortar"] },
  { slug: "wall_tie", label: "Wall ties / starter kit", parentCategories: ["bricks_blocks", "fixings"] },
  { slug: "lintel", label: "Lintel", parentCategories: ["bricks_blocks", "other"] },
  { slug: "dpc", label: "DPC damp-proof course", parentCategories: ["bricks_blocks", "other"] },

  // Plasterboard
  { slug: "drywall_screw", label: "Drywall screws", parentCategories: ["plasterboard", "fixings"] },
  { slug: "scrim_tape", label: "Scrim / jointing tape", parentCategories: ["plasterboard", "fixings"] },
  { slug: "jointing_filler", label: "Jointing filler", parentCategories: ["plasterboard", "other"] },
  { slug: "corner_bead", label: "Corner bead", parentCategories: ["plasterboard", "fixings"] },

  // Insulation
  { slug: "vapour_barrier", label: "Vapour barrier", parentCategories: ["insulation"] },
  { slug: "insulation_tape", label: "Insulation tape", parentCategories: ["insulation", "fixings"] },

  // Decking
  { slug: "deck_screw", label: "Decking screws", parentCategories: ["decking", "fixings"] },
  { slug: "joist_hanger", label: "Joist hanger", parentCategories: ["decking", "fixings"] },
  { slug: "post_anchor", label: "Post anchor / bolt-down base", parentCategories: ["decking", "fencing", "fixings"] },
  { slug: "deck_oil", label: "Deck oil / treatment", parentCategories: ["decking", "paint"] },

  // Fencing
  { slug: "postcrete", label: "Postcrete", parentCategories: ["fencing", "concrete"] },
  { slug: "post_cap", label: "Post cap", parentCategories: ["fencing", "other"] },
  { slug: "gravel_board", label: "Gravel board", parentCategories: ["fencing"] },
  { slug: "gate_hinge", label: "Gate hinge / hardware", parentCategories: ["fencing", "fixings"] },

  // Skirting / coving
  { slug: "panel_adhesive", label: "Panel / no-nails adhesive", parentCategories: ["skirting", "fixings"] },

  // Roof tiles
  { slug: "ridge_tile", label: "Ridge tile", parentCategories: ["roof_tiles"] },
  { slug: "eaves_felt", label: "Eaves felt", parentCategories: ["roof_tiles"] },
  { slug: "roofing_batten", label: "Roofing batten", parentCategories: ["roof_tiles"] },
  { slug: "roofing_nail", label: "Roofing nails", parentCategories: ["roof_tiles", "fixings"] },

  // Wallpaper
  { slug: "wallpaper_paste", label: "Wallpaper paste", parentCategories: ["wallpaper"] },
  { slug: "wallpaper_smoother", label: "Wallpaper smoother / brush", parentCategories: ["wallpaper", "hand_tools"] },

  // Render
  { slug: "render_mesh", label: "Render mesh", parentCategories: ["render"] },
  { slug: "scrim_corner", label: "Render corner bead", parentCategories: ["render"] },

  // Turf
  { slug: "lawn_feed", label: "Lawn feed", parentCategories: ["turf"] },
  { slug: "top_dressing", label: "Top dressing", parentCategories: ["turf"] }
];

const SUBCAT_BY_SLUG: Record<string, MerchantSubcategoryDef> = Object.fromEntries(
  MERCHANT_SUBCATEGORIES.map((s) => [s.slug, s])
);

export function getSubcategory(
  slug: string | null | undefined
): MerchantSubcategoryDef | null {
  if (!slug) return null;
  return SUBCAT_BY_SLUG[slug] ?? null;
}

/** Return the merchant subcategories the editor should offer for a given
 *  primary category. Used by the product editor's subcategory dropdown. */
export function subcategoriesForCategory(
  cat: MerchantCategory | null | undefined
): MerchantSubcategoryDef[] {
  if (!cat) return [];
  return MERCHANT_SUBCATEGORIES.filter((s) =>
    s.parentCategories.includes(cat)
  );
}
