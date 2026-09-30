// src/lib/nex-native/terminology.ts
//
// Client-safe terminology types + global default (fallback tail).
// Server-only resolution logic lives in terminology-service.ts so the
// cover primitives can import this file without pulling supabase-admin
// into the browser bundle.
//
// Founder-locked architecture 2026-09-30 · theme × template × profession.

/** The six terminology keys shipped in Phase 2. All are open-shape ·
 *  future keys may be added by rows in nex_vertical.default_terminology
 *  or nex_profession.default_terminology without a code change (they
 *  just won't render until a template consumes them). */
export type NexTerminologyKey =
  | "catalog_heading"
  | "catalog_action_label"
  | "primary_action_label"
  | "section_about_label"
  | "section_location_label"
  | "story_eyebrow";

export type NexTerminology = Record<NexTerminologyKey, string>;

/** Ultimate fallback · what a template shows for a business that has
 *  no profession, no vertical, no override. Kept neutral so it always
 *  reads reasonably. */
export const GLOBAL_DEFAULT_TERMINOLOGY: NexTerminology = {
  catalog_heading: "Products",
  catalog_action_label: "Shop",
  primary_action_label: "Contact us",
  section_about_label: "About us",
  section_location_label: "Visit us",
  story_eyebrow: "Our journey",
};

/** Merge sparse overrides on top of a full base. Sparse jsonb rows in
 *  nex_profession may leave keys undefined; those fall through. Empty
 *  strings do NOT count as overrides · sellers can't accidentally
 *  blank out a heading through profession selection. */
export function mergeTerminology(
  base: NexTerminology,
  override: Partial<Record<NexTerminologyKey, unknown>> | null | undefined,
): NexTerminology {
  if (!override) return base;
  const next: NexTerminology = { ...base };
  for (const k of Object.keys(next) as NexTerminologyKey[]) {
    const v = (override as Record<string, unknown>)[k];
    if (typeof v === "string" && v.trim().length > 0) {
      next[k] = v.trim();
    }
  }
  return next;
}
