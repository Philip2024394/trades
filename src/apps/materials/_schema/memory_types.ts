// Materials Memory · TypeScript row types
// Mirrors supabase/migrations/20260728220000_nex_materials_memory.sql

export type MemoryCategory =
  | "hardwood"
  | "softwood"
  | "sheet"
  | "stair_part"
  | "consumable"
  | "hardware"
  | "finish"
  | "other";

export type MemoryDefaultUnit =
  | "board"
  | "sheet"
  | "length"
  | "unit"
  | "pack"
  | "linear_metre"
  | "litre"
  | "kg";

export type MemoryRow = {
  id:                       string;
  owner_id:                 string;
  name:                     string;
  category:                 MemoryCategory;
  species_id:               string | null;
  default_length_mm:        number | null;
  default_width_mm:         number | null;
  default_thickness_mm:     number | null;
  default_unit:             MemoryDefaultUnit;
  typical_grade:            string | null;
  preferred_supplier_id:    string | null;
  typical_price_per_unit:   number | null;
  price_currency:           string;
  notes:                    string | null;
  synonyms:                 string[];
  usage_count:              number;
  last_used_at:             string | null;
  created_by:               string;
  created_at:               string;
  updated_at:               string;
  deleted_at:               string | null;
};

/** Result of resolving a free-text query against a company's Materials Memory. */
export type MemoryMatch =
  | { kind: "exact";   row: MemoryRow }
  | { kind: "synonym"; row: MemoryRow }
  | { kind: "fuzzy";   row: MemoryRow; similarity: number }
  | { kind: "none" };

/** What NEX intends to do — used across intent + document + apply. */
export type NexAddStockIntent = {
  action:            "add_stock";
  quantity:          number;
  material_query:    string;
  species_hint?:     string | null;
  dimensions?: {
    length_mm?:      number | null;
    width_mm?:       number | null;
    thickness_mm?:   number | null;
  } | null;
  supplier_name?:    string | null;
  price_per_unit?:   number | null;
  price_currency?:   string | null;
  grade?:            string | null;
  unit?:             MemoryDefaultUnit | null;
  reference?:        string | null;
  delivery_date?:    string | null;
  raw:               string;
};

export type NexUnsupportedIntent = {
  action:  "unsupported";
  message: string;
  raw:     string;
};

export type NexIntent = NexAddStockIntent | NexUnsupportedIntent;

/** Draft that a user reviews on the confirmation screen. */
export type NexAddStockDraft = {
  intent:            NexAddStockIntent;
  memory_match:      MemoryMatch;
  /** Values the user has confirmed / edited — override the intent when present. */
  overrides?: {
    material_name?:      string;
    category?:           MemoryCategory;
    species_id?:         string | null;
    length_mm?:          number | null;
    width_mm?:           number | null;
    thickness_mm?:       number | null;
    typical_grade?:      string | null;
    supplier_name?:      string | null;
    price_per_unit?:     number | null;
    price_currency?:     string | null;
    quantity?:           number;
    reference?:          string | null;
  };
  /** How to handle the Memory side — owner decides per workflow:
   *   · use_existing     — this pack maps to an existing Memory row (no write)
   *   · update_existing  — refresh Memory row defaults with new info
   *   · create_new       — first time we've seen this material, remember it
   *   · skip_memory      — one-off purchase, don't pollute Memory
   */
  memory_action: "use_existing" | "create_new" | "update_existing" | "skip_memory";
};
