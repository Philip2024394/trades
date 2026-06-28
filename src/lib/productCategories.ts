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
