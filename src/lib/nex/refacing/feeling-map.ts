// feeling-map.ts — pure translation functions from customer feelings to
// Brain retrieval hints. Per SEE-UI-SPEC.md §C.2 · locked mapping table.
//
// The FEEL surface captures the customer's answer to
//   "How would you like your staircase to feel?"
// as a set of feeling values. The Brain must translate those into
// style/mood/material query hints before hitting retrieveSeeDirections.
//
// This module is pure. No I/O. No dependencies. Straightforward to test.
//
// Doctrinal position:
//   · Never exposes these hints to the homeowner (PR-11 internal taxonomy)
//   · Retrieval logic in retrieval.ts consumes these; UI never sees them
//   · Mapping table is amendable but each row is derived from architecture memory

import type { FeelingValue } from "./case-schema";
import type {
  StyleValue,
  MoodValue,
  MaterialFamily,
  ComponentRole,
} from "./image-schema";

/**
 * Locked mapping table per SEE-UI-SPEC.md §C.2.
 * Amendment requires an amendment note in the spec + regression test.
 */
const FEELING_TO_STYLES: Record<FeelingValue, StyleValue[]> = {
  "more-modern":   ["modern", "minimal"],
  "more-natural":  ["warm-natural", "classic"],
  "more-elegant":  ["classic", "luxury", "traditional"],
  "more-dramatic": ["signature", "industrial"],
  "more-open":     ["modern", "minimal"],
  "not-sure":      [], // empty = Brain uses no style constraint (widest)
};

const FEELING_TO_MOODS: Record<FeelingValue, MoodValue[]> = {
  "more-modern":   ["restrained", "airy"],
  "more-natural":  ["cosy", "restrained"],
  "more-elegant":  ["restrained", "understated"],
  "more-dramatic": ["bold", "dramatic"],
  "more-open":     ["airy"],
  "not-sure":      [],
};

const FEELING_TO_MATERIAL_HINT: Partial<Record<FeelingValue, MaterialFamily>> = {
  "more-natural": "wood",
  "more-open":    "glass",
  // more-modern · more-elegant · more-dramatic · not-sure → no material hint
  // (Brain picks from best-matching library entries)
};

// ── mapFeelingsToStyles ───────────────────────────────────────────────────

/**
 * Union all styles suggested by the customer's feeling selections.
 * Returns [] if the customer picked only "not-sure" (widest retrieval).
 * Deduplicates preserving first-appearance order.
 */
export function mapFeelingsToStyles(feelings: FeelingValue[]): StyleValue[] {
  const seen = new Set<StyleValue>();
  const out: StyleValue[] = [];
  for (const f of feelings) {
    const hints = FEELING_TO_STYLES[f] ?? [];
    for (const s of hints) {
      if (!seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
  }
  return out;
}

// ── mapFeelingsToMoods ────────────────────────────────────────────────────

export function mapFeelingsToMoods(feelings: FeelingValue[]): MoodValue[] {
  const seen = new Set<MoodValue>();
  const out: MoodValue[] = [];
  for (const f of feelings) {
    const hints = FEELING_TO_MOODS[f] ?? [];
    for (const m of hints) {
      if (!seen.has(m)) {
        seen.add(m);
        out.push(m);
      }
    }
  }
  return out;
}

// ── inferMaterialFamilyHint ───────────────────────────────────────────────

/**
 * Return the material family the customer's feelings most strongly imply,
 * or undefined if no clear signal. Multi-feeling inputs prefer the first
 * feeling that has a defined hint (natural before open before none).
 *
 * Returns undefined for "not sure" and for combinations with no dominant
 * material signal · the Brain then picks material from best-matching entries.
 */
export function inferMaterialFamilyHint(
  feelings: FeelingValue[]
): MaterialFamily | undefined {
  for (const f of feelings) {
    const hint = FEELING_TO_MATERIAL_HINT[f];
    if (hint) return hint;
  }
  return undefined;
}

// ── componentRoleFromItem ─────────────────────────────────────────────────

/**
 * Map a free-text `IntentEntry.item` (used at FEEL preserve step to record
 * MUST_NOT_CHANGE items) to a canonical ComponentRole where possible.
 * Returns null when the item is not a recognised structural component
 * (e.g. "carpet runner" · "wall panelling" — those aren't in COMPONENT_ROLES).
 */
export function componentRoleFromItem(item: string): ComponentRole | null {
  const lower = item.toLowerCase().trim();
  const map: Record<string, ComponentRole> = {
    "newel":         "newel",
    "newel_post":    "newel",
    "newel post":    "newel",
    "handrail":      "handrail",
    "baluster":      "baluster",
    "balusters":     "baluster",
    "tread":         "tread",
    "treads":        "tread",
    "riser":         "riser",
    "risers":        "riser",
    "stringer":      "stringer",
    "whole_staircase": "whole_staircase",
  };
  return map[lower] ?? null;
}

// ── Test-only helpers · exported for regression tests ────────────────────

export const _internal = {
  FEELING_TO_STYLES,
  FEELING_TO_MOODS,
  FEELING_TO_MATERIAL_HINT,
};
