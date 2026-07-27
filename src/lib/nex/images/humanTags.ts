// src/lib/nex/images/humanTags.ts
//
// HumanTags — structured admin-authored image tags gathered via
// /admin/nex-tag. When a row carries human_tags, the parser + classifier
// trust these values over regex heuristics — they're ground truth.
//
// Six buckets + free text (Philip 2026-07-27 spec):
//   1. Layout / Direction of travel
//   2. String / Construction
//   3. Riser
//   4. Balustrade (multi-select)
//   5. Primary material
//   6. Context (drives brain routing)
//   7. Free text (fallback for anything not captured)

export type StaircaseContext = "internal" | "external" | "fire_escape";

export type HumanTags = {
  layout?: LayoutKey;
  string_type?: StringKey;
  riser?: RiserKey;
  balustrade?: BalustradeKey[];
  primary_material?: MaterialKey;
  context?: StaircaseContext;
  free_text?: string;
  tagged_by?: string;
  tagged_at?: string;
};

export type LayoutKey =
  | "straight"
  | "quarter_turn"
  | "quarter_landing"
  | "half_turn"
  | "winder"
  | "double_winder"
  | "open_well"
  | "spiral"
  | "helical"
  | "alternating_tread"
  | "other";

export type StringKey =
  | "closed_string"
  | "cut_string"
  | "mono_stringer"
  | "twin_stringer"
  | "wall_fixed_cantilever"
  | "centre_support_cantilever"
  | "floating"
  | "other";

export type RiserKey = "closed" | "open" | "drawer_storage";

export type BalustradeKey =
  | "timber_balusters"
  | "glass_panels"
  | "stainless_steel"
  | "black_metal"
  | "cable"
  | "wrought_iron"
  | "none";

export type MaterialKey =
  | "oak"
  | "walnut"
  | "mahogany"
  | "pine"
  | "ash"
  | "painted_timber"
  | "steel_timber_combo"
  | "metal_only"
  | "other";

// ---- UI options with keyboard shortcuts ----

export const LAYOUT_OPTIONS: Array<{ key: LayoutKey; label: string; hotkey: string }> = [
  { key: "straight",           label: "Straight",                    hotkey: "1" },
  { key: "quarter_turn",       label: "Quarter turn (L)",            hotkey: "2" },
  { key: "quarter_landing",    label: "Quarter landing",             hotkey: "3" },
  { key: "half_turn",          label: "Half turn / dog leg (U)",     hotkey: "4" },
  { key: "winder",             label: "Winder",                      hotkey: "5" },
  { key: "double_winder",      label: "Double winder",               hotkey: "6" },
  { key: "open_well",          label: "Open well",                   hotkey: "7" },
  { key: "spiral",             label: "Spiral",                      hotkey: "8" },
  { key: "helical",            label: "Helical (curved)",            hotkey: "9" },
  { key: "alternating_tread",  label: "Alternating tread",           hotkey: "0" },
  { key: "other",              label: "Other (see free text)",       hotkey: "-" },
];

export const STRING_OPTIONS: Array<{ key: StringKey; label: string; hotkey: string }> = [
  { key: "closed_string",              label: "Closed string",              hotkey: "q" },
  { key: "cut_string",                 label: "Cut string",                 hotkey: "w" },
  { key: "mono_stringer",              label: "Mono stringer",              hotkey: "e" },
  { key: "twin_stringer",              label: "Twin stringer",              hotkey: "r" },
  { key: "wall_fixed_cantilever",      label: "Wall-fixed cantilever",      hotkey: "t" },
  { key: "centre_support_cantilever",  label: "Centre-support cantilever",  hotkey: "y" },
  { key: "floating",                   label: "Floating",                   hotkey: "u" },
  { key: "other",                      label: "Other",                      hotkey: "i" },
];

export const RISER_OPTIONS: Array<{ key: RiserKey; label: string; hotkey: string }> = [
  { key: "closed",         label: "Closed risers",  hotkey: "a" },
  { key: "open",           label: "Open risers",    hotkey: "s" },
  { key: "drawer_storage", label: "Drawer storage", hotkey: "d" },
];

export const BALUSTRADE_OPTIONS: Array<{ key: BalustradeKey; label: string; hotkey: string }> = [
  { key: "timber_balusters",  label: "Timber balusters",  hotkey: "z" },
  { key: "glass_panels",      label: "Glass panels",      hotkey: "x" },
  { key: "stainless_steel",   label: "Stainless steel",   hotkey: "c" },
  { key: "black_metal",       label: "Black metal",       hotkey: "v" },
  { key: "cable",             label: "Cable system",      hotkey: "b" },
  { key: "wrought_iron",      label: "Wrought iron",      hotkey: "n" },
  { key: "none",              label: "No balustrade",     hotkey: "m" },
];

export const MATERIAL_OPTIONS: Array<{ key: MaterialKey; label: string; hotkey: string }> = [
  { key: "oak",                 label: "Oak",                  hotkey: "F1" },
  { key: "walnut",              label: "Walnut",               hotkey: "F2" },
  { key: "mahogany",            label: "Mahogany",             hotkey: "F3" },
  { key: "pine",                label: "Pine",                 hotkey: "F4" },
  { key: "ash",                 label: "Ash",                  hotkey: "F5" },
  { key: "painted_timber",      label: "Painted timber",       hotkey: "F6" },
  { key: "steel_timber_combo",  label: "Steel + timber combo", hotkey: "F7" },
  { key: "metal_only",          label: "Metal only",           hotkey: "F8" },
  { key: "other",               label: "Other",                hotkey: "F9" },
];

export const CONTEXT_OPTIONS: Array<{ key: StaircaseContext; label: string; hotkey: string; brain: string }> = [
  { key: "internal",    label: "Internal",             hotkey: "I", brain: "staircase_brain" },
  { key: "external",    label: "External / garden",    hotkey: "O", brain: "garden_staircase_brain" },
  { key: "fire_escape", label: "Fire escape",          hotkey: "P", brain: "staircase_brain" },
];

// ---- Brain routing from human tags ----

/**
 * When a human sets `context`, that overrides classifier heuristics.
 * Returns the primary_brain the row should route to.
 */
export function brainFromHumanContext(
  ctx: StaircaseContext | undefined
): string | null {
  if (!ctx) return null;
  const match = CONTEXT_OPTIONS.find((o) => o.key === ctx);
  return match?.brain ?? null;
}

// ---- Sanity validation on incoming tag objects ----

export function normaliseHumanTags(input: unknown): HumanTags | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const out: HumanTags = {};

  const layoutKeys = LAYOUT_OPTIONS.map((o) => o.key);
  if (typeof raw.layout === "string" && (layoutKeys as string[]).includes(raw.layout))
    out.layout = raw.layout as LayoutKey;

  const stringKeys = STRING_OPTIONS.map((o) => o.key);
  if (typeof raw.string_type === "string" && (stringKeys as string[]).includes(raw.string_type))
    out.string_type = raw.string_type as StringKey;

  const riserKeys = RISER_OPTIONS.map((o) => o.key);
  if (typeof raw.riser === "string" && (riserKeys as string[]).includes(raw.riser))
    out.riser = raw.riser as RiserKey;

  const balustradeKeys = BALUSTRADE_OPTIONS.map((o) => o.key);
  if (Array.isArray(raw.balustrade)) {
    out.balustrade = raw.balustrade.filter(
      (v): v is BalustradeKey =>
        typeof v === "string" && (balustradeKeys as string[]).includes(v)
    );
  }

  const materialKeys = MATERIAL_OPTIONS.map((o) => o.key);
  if (typeof raw.primary_material === "string" && (materialKeys as string[]).includes(raw.primary_material))
    out.primary_material = raw.primary_material as MaterialKey;

  const contextKeys = CONTEXT_OPTIONS.map((o) => o.key);
  if (typeof raw.context === "string" && (contextKeys as string[]).includes(raw.context))
    out.context = raw.context as StaircaseContext;

  if (typeof raw.free_text === "string" && raw.free_text.trim().length > 0)
    out.free_text = raw.free_text.slice(0, 2000); // hard cap

  if (typeof raw.tagged_by === "string") out.tagged_by = raw.tagged_by.slice(0, 200);

  out.tagged_at = new Date().toISOString();

  // Empty tag object = no useful signal → return null
  const hasSignal =
    out.layout ||
    out.string_type ||
    out.riser ||
    (out.balustrade && out.balustrade.length > 0) ||
    out.primary_material ||
    out.context ||
    out.free_text;
  if (!hasSignal) return null;

  return out;
}
