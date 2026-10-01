// src/lib/nex-native/variant-templates.ts
//
// Variant template library · sealed 2026-10-01 · Phase 1 Shoppe-grade.
// -----------------------------------------------------------------------------
// Preset lists of variant VALUES per attribute (size, colour, etc.)
// so sellers don't have to invent "shoe sizes" or "ring sizes" from
// scratch. The seller picks a template, then multi-selects which
// values apply to this product.
//
// Lives in TypeScript (not the DB) because:
//   · Values are static reference data (ISO shoe sizes don't change)
//   · Zero DB round-trips when the picker renders
//   · Easy to extend — add a new template, redeploy, done.
//
// All templates target `nex_product_variant.attribute` which is
// constrained to the enum defined in Migration 075 ('size', 'colour',
// 'material', 'package', 'duration', 'style', 'finish', 'fit',
// 'pack_size', 'other'). Phase 1 ships size templates. Colour values
// come from nex_color_palette (DB-sourced); 'material' / 'style' /
// 'fit' etc get templates in later phases.

/** The nex_product_variant.attribute column's canonical values.
 *  Mirrors the CHECK constraint in Migration 075 so TypeScript catches
 *  mismatches at compile time. */
export type NexVariantAttribute =
  | "size"
  | "colour"
  | "material"
  | "package"
  | "duration"
  | "style"
  | "finish"
  | "fit"
  | "pack_size"
  | "other";

export interface NexVariantTemplate {
  /** Stable key used by the UI (template picker) · never shown to buyers. */
  key: string;
  /** Human label shown in the template dropdown (sentence case). */
  label: string;
  /** The attribute column value these variants get persisted under. */
  attribute: NexVariantAttribute;
  /** Short caption shown under the template name. */
  hint: string;
  /** Ordered list of values offered for multi-select. Order matters —
   *  "S, M, L" reads better than alphabetical "L, M, S". */
  values: string[];
  /** When true, the template also prompts the seller to upload a size
   *  chart image (Phase 1 only enabled for size templates). */
  wantsSizeChart?: boolean;
}

export const NEX_VARIANT_TEMPLATES: NexVariantTemplate[] = [
  // --- Size templates ---
  {
    key: "clothing_letter",
    label: "Clothing (XS–3XL)",
    attribute: "size",
    hint: "T-shirts, hoodies, dresses, outerwear.",
    values: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
    wantsSizeChart: true,
  },
  {
    key: "shoe_eu",
    label: "Shoe · EU",
    attribute: "size",
    hint: "European shoe sizing (35–46).",
    values: [
      "35",
      "36",
      "37",
      "38",
      "39",
      "40",
      "41",
      "42",
      "43",
      "44",
      "45",
      "46",
    ],
    wantsSizeChart: true,
  },
  {
    key: "shoe_us_men",
    label: "Shoe · US men",
    attribute: "size",
    hint: "US men's shoe sizing (6–13).",
    values: ["6", "7", "8", "9", "10", "11", "12", "13"],
    wantsSizeChart: true,
  },
  {
    key: "shoe_us_women",
    label: "Shoe · US women",
    attribute: "size",
    hint: "US women's shoe sizing (5–11).",
    values: ["5", "6", "7", "8", "9", "10", "11"],
    wantsSizeChart: true,
  },
  {
    key: "shoe_uk",
    label: "Shoe · UK",
    attribute: "size",
    hint: "UK shoe sizing (3–12).",
    values: ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
    wantsSizeChart: true,
  },
  {
    key: "ring_us",
    label: "Ring size · US",
    attribute: "size",
    hint: "US ring sizes (4–13).",
    values: ["4", "5", "6", "7", "8", "9", "10", "11", "12", "13"],
    wantsSizeChart: true,
  },
  {
    key: "belt_cm",
    label: "Belt · cm",
    attribute: "size",
    hint: "Waist in centimetres (70–120).",
    values: [
      "70",
      "75",
      "80",
      "85",
      "90",
      "95",
      "100",
      "105",
      "110",
      "115",
      "120",
    ],
    wantsSizeChart: true,
  },
  {
    key: "custom_size",
    label: "Custom size",
    attribute: "size",
    hint: "Type your own list of sizes.",
    values: [],
    wantsSizeChart: true,
  },
];

/** Resolve a template by key · returns null if unknown.
 *  Used by the server action when it needs to re-validate a seller
 *  submission against the known template library. */
export function getVariantTemplate(key: string): NexVariantTemplate | null {
  return NEX_VARIANT_TEMPLATES.find((t) => t.key === key) ?? null;
}
