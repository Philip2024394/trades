// Trade-aware placeholder strings. Keeps the signup / edit form
// feeling personal — a Building Supplies merchant sees "Builder Tools",
// a plumber sees "Wright Plumbing", etc. — instead of an unrelated
// example that confuses first-time users about what to type.
//
// Maps to the canonical trade slugs in `TRADE_OFF_TRADES`. Anything
// not in the map falls back to a generic business-name example.

const BUSINESS_NAME_BY_TRADE: Record<string, string> = {
  "building-merchant": "Holt Builder Tools",
  "builders-supplies": "Builder Tools",
  "tool-hire": "Tool Hire Direct",
  "heavy-machinery": "Plant Hire UK",
  "kitchen-fitter": "Premier Kitchens",
  "stair-fitter": "Heritage Stairs",
  "window-fitter": "Glasswright Windows",
  "security-installer": "Secure Home Systems",
  plumber: "Wright Plumbing",
  electrician: "Voltage Electrics",
  carpenter: "Oakwood Joinery",
  joiner: "Oakwood Joinery",
  bricklayer: "Stonemark Brickwork",
  stonemason: "Stonemark Masonry",
  drywaller: "Wright Plastering Ltd",
  plasterer: "Wright Plastering Ltd",
  painter: "Brushwork Decorators",
  roofer: "Skyline Roofing",
  scaffolder: "Highrise Scaffolding",
  tiler: "Mosaic Tiling",
  landscaper: "Greenway Landscapes",
  "gas-engineer": "FlameSafe Gas",
  "general-builder": "Wright Builders",
  groundworker: "Foundation Groundworks",
  "concrete-finisher": "PolishPro Concrete",
  "concrete-specialist": "PolishPro Concrete",
  renderer: "SilkFinish Rendering",
  "taper-and-finisher": "Wright Plastering Ltd",
  "metal-engineer": "IronCraft Engineering",
  "crane-operator": "LiftPro Crane Services",
  "site-safety": "SafeSite Solutions",
  "water-drilling": "DeepWell Drilling",
  "fascia-and-soffit": "RainGuard Fascias",
  demolition: "Knockdown Demolition",
  "site-canteen": "Site Café Catering",
  "trim-carpenter": "FineLine Trim",
  "block-layer": "Foundation Blockwork",
  formworker: "ShutterPro Formwork",
  "insulation-installer": "WarmHome Insulation"
};

/** Returns a sample business name for the given trade slug. Empty
 *  slug or unknown trade falls back to a generic, neutral example. */
export function tradeBusinessExample(slug: string | null | undefined): string {
  if (!slug) return "Your Business Ltd";
  return BUSINESS_NAME_BY_TRADE[slug] ?? "Your Business Ltd";
}
