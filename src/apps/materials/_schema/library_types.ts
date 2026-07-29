// Materials Library · TypeScript types (file-based)
//
// Library items live in git under data/materials/**/*.json — NOT a
// database table. See data/materials/README.md for the rationale and
// data/materials/_schema.md for the JSON shape.
//
// Corrected 2026-07-28 · Philip · Library = knowledge, not transactional data.

export type LibraryCategory =
  | "hardwood"
  | "softwood"
  | "stair_part"
  | "sheet"
  | "flooring"
  | "moulding"
  | "consumable"
  | "hardware"
  | "finish"
  | "other";

export type LibraryUnit =
  | "board" | "sheet" | "length" | "unit" | "pack" | "linear_metre" | "litre" | "kg" | "each";

/** Flexible dimension shape · varies per material category.
 *  Consumers must know which fields to expect for a given category — the
 *  type is deliberately open so specialised items fit without churn. */
export type LibraryCommonDimensions = {
  thicknesses_mm?: number[];
  widths_mm?:      number[];
  lengths_mm?:     number[];
  sections_mm?:    [number, number][];
  sheet_size_mm?:  [number, number][];
  profiles?:       string[];
  [key: string]:   unknown;
};

/** One Library item as authored in a JSON file under data/materials/. */
export type LibraryItem = {
  slug:                     string;
  name:                     string;
  category:                 LibraryCategory;
  subcategory?:             string | null;
  species_id?:              string | null;
  default_unit:             LibraryUnit;
  finish?:                  string | null;
  typical_grades?:          string[];
  typical_applications?:    string[];
  synonyms?:                string[];
  common_dimensions:        LibraryCommonDimensions;
  notes?:                   string | null;
  sort_order?:              number;
};

/** Result of an import-to-Memory batch operation. */
export type LibraryImportResult = {
  imported_count: number;
  skipped_count: number;
  skipped_reasons: { slug: string; reason: "already_in_memory" | "not_found" }[];
  created_memory_ids: string[];
};
