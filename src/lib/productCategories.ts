// Category-driven Item Specifics for merchant-grade trades.
//
// eBay-style category taxonomy: pick a category, then a category-
// specific set of "Item Specifics" appears (Required first, then
// Recommended). Predefined dropdown values cover ~70% of specs so
// buyer-side faceted search works without free-text noise.
//
// Specs save into the existing `specs: { label, value }[]` JSONB
// column on hammerex_xrated_products via the products/upsert API —
// no schema change required.
//
// Taxonomy is a JSON config (not a DB table) so new categories /
// specs ship by code change, no migration. Add categories here when
// the catalogue demands it.

export type SpecType = "text" | "number" | "dropdown" | "multiselect";

export type SpecField = {
  /** Stable key used for the saved spec label. Render shows `label`. */
  key: string;
  /** Display label on the form + on the live PDP. */
  label: string;
  /** Input type — drives renderer + sanitisation. */
  type: SpecType;
  /** Required = block save when empty. Recommended = render in the
   *  upper "Recommended" group with a subtle hint. Optional = render
   *  in the "More details" collapsed group. */
  status: "required" | "recommended" | "optional";
  /** For dropdown / multiselect — predefined values. */
  options?: string[];
  /** Display unit suffix for number inputs (e.g. "kg", "mm"). */
  unit?: string;
  /** Placeholder hint for text / number inputs. */
  placeholder?: string;
};

export type ProductCategory = {
  /** Stable slug — saved to the listing's `category` column. */
  slug: string;
  /** Display label on the picker + on the PDP breadcrumb. */
  label: string;
  /** One-line description shown on the category card. */
  blurb: string;
  /** Specs the buyer cares about most. Order matters — required keys
   *  render first, recommended second, optional last. */
  specs: SpecField[];
};

const ASHLAR_GRADES = ["A", "B", "C", "Marine", "Structural"];
const TIMBER_SPECIES = [
  "Pine",
  "Oak",
  "Birch",
  "Beech",
  "Cedar",
  "Larch",
  "MDF",
  "Plywood",
  "OSB",
  "Plasterboard"
];
const TREATMENT = ["None", "Tanalised", "FSC certified", "Pressure-treated"];
const INSULATION_MATERIAL = [
  "Mineral wool",
  "PIR",
  "EPS",
  "XPS",
  "Sheep wool",
  "Cellulose",
  "Polystyrene"
];
const FIXING_TYPE = ["Screw", "Bolt", "Nail", "Anchor", "Rivet", "Stud", "Nut", "Washer"];
const FIXING_HEAD = ["Pan", "Countersunk", "Hex", "Pozi", "Phillips", "Round", "Button"];
const FIXING_DRIVE = ["Pozi", "Torx", "Phillips", "Hex", "Slotted", "Square"];
const FIXING_MATERIAL = ["Steel", "Stainless A2", "Stainless A4", "Brass", "Zinc-plated", "Galvanised"];
const BATTERY_TYPE = ["Li-ion", "NiMH", "NiCd", "Corded (mains)"];
const WORKWEAR_SIZE = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
const HI_VIS_CLASS = ["None", "Class 1", "Class 2", "Class 3"];
const PLUMB_MATERIAL = ["Copper", "Brass", "PVC", "PEX", "Stainless steel", "Steel"];
const PLUMB_THREAD = ["BSP", "NPT", "Push-fit", "Compression", "Solder", "Crimp"];
const CEMENT_TYPE = ["Portland", "Rapid-set", "Mortar mix", "Concrete mix", "Specialist"];
const AGGREGATE_TYPE = ["Sand", "Gravel", "Ballast", "MOT Type 1", "Chippings"];
const ELECTRICAL_TYPE = [
  "Cable & wire", "Socket", "Switch", "Consumer unit", "Circuit breaker (MCB)",
  "RCD / RCBO", "Junction box", "Conduit / trunking", "Isolator", "Contactor",
  "Ceiling rose", "Extractor fan", "Immersion heater", "EV charger", "Smart controls"
];
const TILE_TYPE = ["Ceramic", "Porcelain", "Natural stone", "Mosaic", "Glass", "Metro / Subway", "Terracotta"];
const TILE_FINISH = ["Matt", "Gloss", "Satin", "Textured", "Polished", "Honed"];
const PAINT_FINISH = ["Matt", "Silk", "Satin", "Gloss", "Eggshell", "Chalk", "Metallic"];
const PAINT_BASE = ["Water-based", "Oil-based (solvent)", "Acrylic", "Epoxy", "Alkyd"];
const DOOR_TYPE = ["Internal", "External", "Fire door", "Bi-fold", "Sliding", "French", "Garage"];
const DOOR_MATERIAL = ["Solid oak", "Solid pine", "Engineered", "Composite", "uPVC", "Aluminium", "Steel"];
const ROOFING_TYPE = ["Slate", "Clay tile", "Concrete tile", "Metal sheet", "EPDM (flat)", "Felt (flat)", "GRP", "Green roof"];
const APPLIANCE_TYPE = [
  "Oven", "Hob", "Cooker hood", "Fridge", "Freezer", "Dishwasher",
  "Washing machine", "Tumble dryer", "Microwave", "Coffee machine",
  "Warming drawer", "Wine cooler"
];
const APPLIANCE_INSTALL = ["Freestanding", "Built-in", "Integrated", "Slot-in", "Under-counter"];
const KITCHEN_UNIT_TYPE = [
  "Base unit", "Wall unit", "Tall unit", "Corner unit", "Drawer unit",
  "Larder / pantry", "Island", "Peninsula", "End panel", "Cornice / pelmet"
];
const WORKTOP_MATERIAL = ["Solid oak", "Solid walnut", "Bamboo", "Laminate", "Quartz", "Granite", "Marble", "Corian", "Stainless steel", "Concrete"];
const LIGHTING_TYPE = ["Pendant", "Downlight (spot)", "Batten / strip", "Track", "Chandelier", "Wall light", "Floor lamp", "Outdoor / floodlight"];
const LAMP_BASE = ["E27", "E14", "GU10", "MR16", "B22", "G9", "R7s"];
const GARDEN_TYPE = ["Paving slab", "Decking board", "Sleeper", "Fence panel", "Fence post", "Turf / grass", "Garden shed", "Planter", "Water feature"];
const HVAC_TYPE = ["Combi boiler", "System boiler", "Regular boiler", "Radiator", "Underfloor heating", "Heat pump", "Thermostat", "TRV", "Cylinder"];
const HVAC_FUEL = ["Gas", "LPG", "Oil", "Electric", "Hydrogen ready", "Dual fuel"];

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    slug: "cement-aggregates",
    label: "Cement & Aggregates",
    blurb: "Bagged or bulk cement, mortar, concrete, sand, gravel.",
    specs: [
      {
        key: "cement_type",
        label: "Type",
        type: "dropdown",
        status: "required",
        options: [...CEMENT_TYPE, ...AGGREGATE_TYPE]
      },
      {
        key: "weight",
        label: "Weight",
        type: "number",
        status: "required",
        unit: "kg",
        placeholder: "25"
      },
      {
        key: "setting_time",
        label: "Setting time",
        type: "text",
        status: "recommended",
        placeholder: "e.g. 30 min, 24 h"
      },
      { key: "brand", label: "Brand", type: "text", status: "recommended", placeholder: "Tarmac, Hanson…" },
      {
        key: "coverage",
        label: "Coverage",
        type: "text",
        status: "optional",
        placeholder: "e.g. 1 m² @ 5 cm"
      }
    ]
  },
  {
    slug: "timber-sheet",
    label: "Timber & Sheet Materials",
    blurb: "Boards, sheets, planks, framing timber, plasterboard.",
    specs: [
      {
        key: "species",
        label: "Species / Material",
        type: "dropdown",
        status: "required",
        options: TIMBER_SPECIES
      },
      {
        key: "grade",
        label: "Grade",
        type: "dropdown",
        status: "required",
        options: ASHLAR_GRADES
      },
      {
        key: "length",
        label: "Length",
        type: "number",
        status: "required",
        unit: "mm",
        placeholder: "2400"
      },
      { key: "width", label: "Width", type: "number", status: "required", unit: "mm", placeholder: "1200" },
      { key: "thickness", label: "Thickness", type: "number", status: "required", unit: "mm", placeholder: "18" },
      {
        key: "treatment",
        label: "Treatment",
        type: "dropdown",
        status: "recommended",
        options: TREATMENT
      },
      { key: "pack_qty", label: "Pack quantity", type: "number", status: "optional", placeholder: "1" }
    ]
  },
  {
    slug: "insulation",
    label: "Insulation",
    blurb: "Mineral wool, PIR, EPS, XPS, sheep wool, cellulose.",
    specs: [
      {
        key: "material",
        label: "Material",
        type: "dropdown",
        status: "required",
        options: INSULATION_MATERIAL
      },
      { key: "thickness", label: "Thickness", type: "number", status: "required", unit: "mm", placeholder: "100" },
      { key: "r_value", label: "R-value", type: "text", status: "recommended", placeholder: "e.g. 4.6 m²K/W" },
      { key: "en_standard", label: "EN standard", type: "text", status: "optional", placeholder: "EN 13162" },
      {
        key: "coverage_m2",
        label: "Pack coverage",
        type: "number",
        status: "optional",
        unit: "m²",
        placeholder: "5"
      }
    ]
  },
  {
    slug: "fixings",
    label: "Fixings & Fasteners",
    blurb: "Screws, bolts, nails, anchors — anything that holds it together.",
    specs: [
      {
        key: "type",
        label: "Type",
        type: "dropdown",
        status: "required",
        options: FIXING_TYPE
      },
      {
        key: "head",
        label: "Head",
        type: "dropdown",
        status: "required",
        options: FIXING_HEAD
      },
      { key: "length", label: "Length", type: "number", status: "required", unit: "mm", placeholder: "50" },
      { key: "diameter", label: "Diameter", type: "number", status: "required", unit: "mm", placeholder: "4" },
      {
        key: "drive",
        label: "Drive",
        type: "dropdown",
        status: "recommended",
        options: FIXING_DRIVE
      },
      {
        key: "material",
        label: "Material",
        type: "dropdown",
        status: "recommended",
        options: FIXING_MATERIAL
      },
      { key: "pack_qty", label: "Pack quantity", type: "number", status: "recommended", placeholder: "100" }
    ]
  },
  {
    slug: "power-tools",
    label: "Power Tools",
    blurb: "Cordless drills, circular saws, grinders, jigsaws.",
    specs: [
      { key: "brand", label: "Brand", type: "text", status: "required", placeholder: "Bosch, Makita, DeWalt…" },
      { key: "model", label: "Model", type: "text", status: "required", placeholder: "e.g. GSR 18V-21" },
      { key: "voltage", label: "Voltage", type: "number", status: "required", unit: "V", placeholder: "18" },
      {
        key: "battery_type",
        label: "Battery type",
        type: "dropdown",
        status: "recommended",
        options: BATTERY_TYPE
      },
      { key: "chuck_size", label: "Chuck size", type: "text", status: "optional", placeholder: "10 mm / 13 mm" },
      { key: "weight", label: "Weight", type: "number", status: "optional", unit: "kg", placeholder: "1.6" }
    ]
  },
  {
    slug: "hand-tools",
    label: "Hand Tools",
    blurb: "Hammers, saws, trowels, chisels, measures.",
    specs: [
      { key: "type", label: "Type", type: "text", status: "required", placeholder: "Claw hammer" },
      { key: "brand", label: "Brand", type: "text", status: "recommended", placeholder: "Stanley, Bahco…" },
      { key: "material", label: "Material", type: "text", status: "optional", placeholder: "Forged steel" },
      { key: "length", label: "Length", type: "number", status: "optional", unit: "mm", placeholder: "300" }
    ]
  },
  {
    slug: "workwear-safety",
    label: "Workwear & Safety",
    blurb: "Boots, helmets, hi-vis, gloves, ear / eye / respiratory PPE.",
    specs: [
      {
        key: "size",
        label: "Size",
        type: "dropdown",
        status: "required",
        options: WORKWEAR_SIZE
      },
      { key: "colour", label: "Colour", type: "text", status: "required", placeholder: "Hi-vis yellow" },
      { key: "material", label: "Material", type: "text", status: "recommended", placeholder: "Polyester / cotton" },
      { key: "en_standard", label: "EN standard", type: "text", status: "recommended", placeholder: "EN ISO 20471" },
      {
        key: "hi_vis_class",
        label: "Hi-vis class",
        type: "dropdown",
        status: "optional",
        options: HI_VIS_CLASS
      }
    ]
  },
  {
    slug: "plumbing-heating",
    label: "Plumbing & Heating",
    blurb: "Pipes, fittings, valves, boilers, radiators.",
    specs: [
      { key: "type", label: "Type", type: "text", status: "required", placeholder: "15 mm elbow" },
      {
        key: "material",
        label: "Material",
        type: "dropdown",
        status: "required",
        options: PLUMB_MATERIAL
      },
      { key: "size", label: "Size", type: "text", status: "required", placeholder: "15 mm / 22 mm / ½ inch" },
      {
        key: "thread",
        label: "Thread / connection",
        type: "dropdown",
        status: "recommended",
        options: PLUMB_THREAD
      },
      { key: "pressure_rating", label: "Pressure rating", type: "text", status: "optional", placeholder: "10 bar" }
    ]
  },
  {
    slug: "electrical",
    label: "Electrical Supplies",
    blurb: "Cable, sockets, switches, consumer units, MCBs / RCDs, junction boxes.",
    specs: [
      { key: "type", label: "Type", type: "dropdown", status: "required", options: ELECTRICAL_TYPE },
      { key: "brand", label: "Brand", type: "text", status: "recommended", placeholder: "Schneider, Wago, MK…" },
      { key: "voltage", label: "Voltage", type: "text", status: "recommended", placeholder: "230V AC" },
      { key: "amps", label: "Current rating", type: "text", status: "recommended", placeholder: "e.g. 32A" },
      { key: "cable_gauge", label: "Cable size / gauge", type: "text", status: "optional", placeholder: "1.5mm² / 2.5mm²" },
      { key: "ip_rating", label: "IP rating", type: "text", status: "optional", placeholder: "IP44 / IP65" },
      { key: "certification", label: "Certification", type: "text", status: "optional", placeholder: "BS 7671, CE / UKCA" }
    ]
  },
  {
    slug: "tiles-flooring",
    label: "Tiles & Flooring",
    blurb: "Wall + floor tiles, adhesive, grout, underlay, tile trims.",
    specs: [
      { key: "tile_type", label: "Tile type", type: "dropdown", status: "required", options: TILE_TYPE },
      { key: "length", label: "Tile length", type: "number", status: "required", unit: "mm", placeholder: "300" },
      { key: "width", label: "Tile width", type: "number", status: "required", unit: "mm", placeholder: "600" },
      { key: "thickness", label: "Thickness", type: "number", status: "recommended", unit: "mm", placeholder: "10" },
      { key: "finish", label: "Finish", type: "dropdown", status: "recommended", options: TILE_FINISH },
      { key: "coverage", label: "Pack coverage", type: "text", status: "recommended", placeholder: "1.44 m² / box" },
      { key: "colour", label: "Colour", type: "text", status: "optional", placeholder: "Warm grey" },
      { key: "rectified", label: "Rectified edge", type: "dropdown", status: "optional", options: ["Yes", "No"] }
    ]
  },
  {
    slug: "paint-decor",
    label: "Paint & Decor",
    blurb: "Paint, primer, wallpaper, brushes, rollers, decorating tools.",
    specs: [
      { key: "brand", label: "Brand", type: "text", status: "required", placeholder: "Dulux, Farrow & Ball…" },
      { key: "colour_name", label: "Colour name", type: "text", status: "required", placeholder: "Elephant's Breath" },
      { key: "finish", label: "Finish", type: "dropdown", status: "required", options: PAINT_FINISH },
      { key: "base", label: "Base", type: "dropdown", status: "recommended", options: PAINT_BASE },
      { key: "volume_l", label: "Volume", type: "number", status: "required", unit: "L", placeholder: "2.5" },
      { key: "coverage", label: "Coverage per litre", type: "text", status: "recommended", placeholder: "13 m²/L" },
      { key: "voc", label: "VOC content", type: "text", status: "optional", placeholder: "Low VOC" },
      { key: "drying_time", label: "Drying time", type: "text", status: "optional", placeholder: "2h touch dry" }
    ]
  },
  {
    slug: "doors-windows",
    label: "Doors & Windows",
    blurb: "Internal / external doors, fire doors, frames, sashes, sills.",
    specs: [
      { key: "door_type", label: "Door type", type: "dropdown", status: "required", options: DOOR_TYPE },
      { key: "material", label: "Material", type: "dropdown", status: "required", options: DOOR_MATERIAL },
      { key: "height", label: "Height", type: "number", status: "required", unit: "mm", placeholder: "1981" },
      { key: "width", label: "Width", type: "number", status: "required", unit: "mm", placeholder: "762" },
      { key: "thickness", label: "Thickness", type: "number", status: "recommended", unit: "mm", placeholder: "35" },
      { key: "fire_rating", label: "Fire rating", type: "text", status: "recommended", placeholder: "FD30 / FD60 / n/a" },
      { key: "glazed", label: "Glazed panels", type: "text", status: "optional", placeholder: "e.g. 4 panels, obscure" },
      { key: "handing", label: "Handing (left/right)", type: "dropdown", status: "optional", options: ["Left", "Right", "Universal"] }
    ]
  },
  {
    slug: "roofing",
    label: "Roofing",
    blurb: "Slates, tiles, felt, EPDM, gutters, downpipes, flashing.",
    specs: [
      { key: "roofing_type", label: "Type", type: "dropdown", status: "required", options: ROOFING_TYPE },
      { key: "colour", label: "Colour", type: "text", status: "recommended", placeholder: "Slate grey" },
      { key: "coverage", label: "Coverage per pack", type: "text", status: "recommended", placeholder: "1 m² / pack" },
      { key: "length", label: "Length", type: "number", status: "optional", unit: "mm", placeholder: "600" },
      { key: "width", label: "Width", type: "number", status: "optional", unit: "mm", placeholder: "300" },
      { key: "brand", label: "Brand", type: "text", status: "optional", placeholder: "Marley, Redland…" }
    ]
  },
  {
    slug: "kitchen-units",
    label: "Kitchen Units & Cabinets",
    blurb: "Base, wall, tall, corner, drawer, larder cabinets — flat-pack or rigid.",
    specs: [
      { key: "unit_type", label: "Unit type", type: "dropdown", status: "required", options: KITCHEN_UNIT_TYPE },
      { key: "width", label: "Width", type: "number", status: "required", unit: "mm", placeholder: "600" },
      { key: "height", label: "Height", type: "number", status: "required", unit: "mm", placeholder: "720" },
      { key: "depth", label: "Depth", type: "number", status: "required", unit: "mm", placeholder: "560" },
      { key: "door_style", label: "Door style", type: "text", status: "recommended", placeholder: "Shaker, slab, in-frame…" },
      { key: "colour", label: "Colour / finish", type: "text", status: "recommended", placeholder: "Matt navy" },
      { key: "carcass", label: "Carcass material", type: "text", status: "optional", placeholder: "MFC / plywood" },
      { key: "hinge_type", label: "Hinge type", type: "text", status: "optional", placeholder: "Soft-close Blum" }
    ]
  },
  {
    slug: "worktops",
    label: "Worktops & Splashbacks",
    blurb: "Solid wood, laminate, quartz, granite, Corian.",
    specs: [
      { key: "material", label: "Material", type: "dropdown", status: "required", options: WORKTOP_MATERIAL },
      { key: "length", label: "Length", type: "number", status: "required", unit: "mm", placeholder: "3000" },
      { key: "depth", label: "Depth", type: "number", status: "required", unit: "mm", placeholder: "600" },
      { key: "thickness", label: "Thickness", type: "number", status: "required", unit: "mm", placeholder: "40" },
      { key: "edge_profile", label: "Edge profile", type: "text", status: "recommended", placeholder: "Square / bullnose / bevelled" },
      { key: "colour", label: "Colour / pattern", type: "text", status: "recommended", placeholder: "Ivory Mist" }
    ]
  },
  {
    slug: "appliances",
    label: "Appliances",
    blurb: "Ovens, hobs, hoods, fridges, dishwashers, washing machines.",
    specs: [
      { key: "brand", label: "Brand", type: "text", status: "required", placeholder: "Bosch, Neff, Miele…" },
      { key: "model", label: "Model number", type: "text", status: "required", placeholder: "e.g. HBS534BW0B" },
      { key: "appliance_type", label: "Type", type: "dropdown", status: "required", options: APPLIANCE_TYPE },
      { key: "install", label: "Installation", type: "dropdown", status: "required", options: APPLIANCE_INSTALL },
      { key: "width", label: "Width", type: "number", status: "recommended", unit: "mm", placeholder: "600" },
      { key: "height", label: "Height", type: "number", status: "recommended", unit: "mm", placeholder: "595" },
      { key: "depth", label: "Depth", type: "number", status: "recommended", unit: "mm", placeholder: "550" },
      { key: "energy_class", label: "Energy class", type: "text", status: "recommended", placeholder: "A / A++ / n/a" },
      { key: "colour", label: "Colour", type: "text", status: "optional", placeholder: "Stainless" }
    ]
  },
  {
    slug: "lighting",
    label: "Lighting",
    blurb: "Pendants, downlights, LED strips, chandeliers, outdoor.",
    specs: [
      { key: "lighting_type", label: "Type", type: "dropdown", status: "required", options: LIGHTING_TYPE },
      { key: "brand", label: "Brand", type: "text", status: "recommended", placeholder: "Astro, Original BTC…" },
      { key: "lamp_base", label: "Lamp base", type: "dropdown", status: "recommended", options: LAMP_BASE },
      { key: "wattage", label: "Wattage", type: "text", status: "recommended", placeholder: "e.g. 5W LED" },
      { key: "colour_temp", label: "Colour temperature", type: "text", status: "optional", placeholder: "3000K warm white" },
      { key: "ip_rating", label: "IP rating", type: "text", status: "optional", placeholder: "IP44 for bathrooms" },
      { key: "dimmable", label: "Dimmable", type: "dropdown", status: "optional", options: ["Yes", "No"] }
    ]
  },
  {
    slug: "garden-landscape",
    label: "Garden & Landscape",
    blurb: "Paving, decking, sleepers, fencing, turf, planters.",
    specs: [
      { key: "garden_type", label: "Type", type: "dropdown", status: "required", options: GARDEN_TYPE },
      { key: "material", label: "Material", type: "text", status: "recommended", placeholder: "Porcelain / hardwood / softwood" },
      { key: "length", label: "Length", type: "number", status: "recommended", unit: "mm", placeholder: "600" },
      { key: "width", label: "Width", type: "number", status: "recommended", unit: "mm", placeholder: "600" },
      { key: "thickness", label: "Thickness", type: "number", status: "optional", unit: "mm", placeholder: "20" },
      { key: "coverage", label: "Coverage per pack", type: "text", status: "optional", placeholder: "10 m²" }
    ]
  },
  {
    slug: "hvac-boilers",
    label: "Heating & Boilers",
    blurb: "Boilers, radiators, underfloor heating, TRVs, controls.",
    specs: [
      { key: "hvac_type", label: "Type", type: "dropdown", status: "required", options: HVAC_TYPE },
      { key: "brand", label: "Brand", type: "text", status: "required", placeholder: "Worcester Bosch, Vaillant…" },
      { key: "model", label: "Model", type: "text", status: "required", placeholder: "e.g. Greenstar 30i" },
      { key: "output_kw", label: "Output (kW)", type: "number", status: "recommended", unit: "kW", placeholder: "30" },
      { key: "fuel", label: "Fuel", type: "dropdown", status: "recommended", options: HVAC_FUEL },
      { key: "efficiency", label: "Efficiency (ErP)", type: "text", status: "optional", placeholder: "A-rated / 94%" },
      { key: "warranty_years", label: "Warranty (years)", type: "number", status: "optional", placeholder: "10" }
    ]
  },
  {
    slug: "other",
    label: "Other / Uncategorised",
    blurb: "Doesn't fit the categories above — free-form specs only.",
    specs: []
  }
];

const SLUG_INDEX: Record<string, ProductCategory> = Object.fromEntries(
  PRODUCT_CATEGORIES.map((c) => [c.slug, c])
);

export function categoryBySlug(slug: string | null | undefined): ProductCategory | null {
  if (!slug) return null;
  return SLUG_INDEX[slug] ?? null;
}

/** Split the spec list by status so the form can render Required → Recommended → Optional. */
export function specsByStatus(category: ProductCategory) {
  return {
    required: category.specs.filter((s) => s.status === "required"),
    recommended: category.specs.filter((s) => s.status === "recommended"),
    optional: category.specs.filter((s) => s.status === "optional")
  };
}
