// retrieval.ts — Brain query functions per PR-12 EXECUTION SPEC §5.
//
// Three query surfaces:
//   · SEE       — Feeling+intent → 2-4 complete design directions
//   · TRY       — component swap within compatibility groups
//   · CONNECT   — resolve provenance for the Refacing Case Package
//
// LOCKED constraints:
//   · PR-8 · designs at SEE must span deliberately (Safe / Warm / Statement)
//   · PR-18 · every returned direction carries a reference_image_ids[] provenance
//   · PR-16 · confidence propagates from images through to designs
//   · Never invent components · retrieval only · no open generation

import type {
  ImagesV3Entry,
  CanonicalProfileId,
  StyleValue,
  MoodValue,
  MaterialFamily,
  ComponentRole,
  CompatibilityGroupId,
} from "./image-schema";
import type { DesignDirection } from "./case-schema";

// ── Types ─────────────────────────────────────────────────────────────────

export type SeeQuery = {
  /**
   * Customer's feeling vector (from FEEL stage · human-language input).
   * Multi-select allowed. Empty = "not sure" (still returns designs).
   */
  feelings?: string[];
  /**
   * Optional style preferences derived by the Brain from feelings.
   */
  style_preferences?: StyleValue[];
  /**
   * Optional mood preferences derived by the Brain from feelings.
   */
  mood_preferences?: MoodValue[];
  /**
   * MUST_NOT_CHANGE components declared by the customer (Stage 2 vocab).
   * Any design whose composition would violate these is excluded.
   */
  must_not_change_component_roles?: ComponentRole[];
  /**
   * Optional material family preference (drawn from FEEL if the customer
   * expressed one · otherwise all families are candidates).
   */
  material_family_hint?: MaterialFamily;
};

export type SeeDirection = {
  direction: DesignDirection;
  hero_image: ImagesV3Entry;
  score: number;
  /** Every image_id used to compose this direction (PR-18 provenance). */
  reference_image_ids: string[];
  /** Human-facing name suggested by NEX. */
  suggested_name: string;
  /** One-line reason-for-existing copy per PR-9. */
  reason_for_existing: string;
  /** One-line key-materials copy per PR-9. */
  key_materials_description: string;
};

export type TryQuery = {
  /**
   * The component role being refined (which chip did the customer tap?).
   */
  target_component_role: ComponentRole;
  /**
   * The current design's compatibility group memberships — swaps stay
   * within these groups to preserve style coherence.
   */
  current_design_compatibility_groups: CompatibilityGroupId[];
  /**
   * Optional filter — restrict swap suggestions to a material family.
   */
  material_family_filter?: MaterialFamily;
};

export type TryAlternate = {
  entry: ImagesV3Entry;
  reason: string; // e.g. "same compatibility group · matching style"
};

// ── SEE · retrieval + scoring ─────────────────────────────────────────────

/**
 * Filter → Score → Diversify → return 2-4 directions per PR-12 spec §5.1.
 *
 * @returns 2-4 directions spanning Safe Centre / Warm Character / Stretch Statement
 *          (or equivalent meaningful span). Fewer if the library has thin coverage.
 */
export function retrieveSeeDirections(
  library: ImagesV3Entry[],
  query: SeeQuery
): SeeDirection[] {
  // ── STEP 1 · FILTER ──
  // Only whole_staircase / in_situ_room images are candidates for hero.
  //
  // MUST_NOT_CHANGE handling (post PR-19 · Philip 2026-08-12):
  //   MUST_NOT_CHANGE is captured as customer intent on the Case for the
  //   professional to honor at survey. It is NOT a retrieval-time exclusion.
  //   Reason: PR-19 says NEX does not modify the homeowner's photograph, so
  //   there's no "composition over BASE" that could violate the constraint.
  //   Designs the retriever surfaces are references — the professional at
  //   survey decides how to honor the customer's preserve-newel intent
  //   against the chosen direction. Filtering out every design that includes
  //   a newel in its composition would eliminate almost every real staircase
  //   design (nearly all reference designs describe their newel treatment).
  //
  // If a future spec re-introduces literal composition-time constraints, that
  // logic belongs in a Compatibility Check stage (PR-4 · deferred) · not here.
  const eligible = library.filter((entry) => {
    if (entry.component_role !== "whole_staircase" && entry.component_role !== "in_situ_room") {
      return false;
    }
    if (query.material_family_hint) {
      if (entry.material !== query.material_family_hint) return false;
    }
    return true;
  });

  if (eligible.length === 0) return [];

  // ── STEP 2 · SCORE ──
  const scored = eligible.map((entry) => ({
    entry,
    score: scoreEntry(entry, query),
  }));
  scored.sort((a, b) => b.score - a.score);

  // ── STEP 3 · DIVERSIFY (Safe / Warm / Statement span) ──
  // Take top pick as Safe Centre. Then pick the next candidate that adds
  // profile diversity for Warm Character. Then again for Stretch Statement.
  const usedProfiles = new Set<string>();
  const picked: Array<{ entry: ImagesV3Entry; score: number; direction: DesignDirection }> = [];

  const directions: DesignDirection[] = ["safe-centre", "warm-character", "stretch-statement"];
  for (const direction of directions) {
    const next = scored.find(
      ({ entry }) => !picked.some((p) => p.entry.image_id === entry.image_id) && addsDiversity(entry, usedProfiles)
    );
    if (!next) break;
    picked.push({ ...next, direction });
    for (const p of next.entry.canonical_profile_ids ?? []) {
      usedProfiles.add(p);
    }
  }

  // If we didn't get diversity for all three, allow non-diversifying picks
  // to fill up to 2 total · never fewer than 1 if any eligible.
  while (picked.length < 2 && picked.length < scored.length) {
    const next = scored.find(
      ({ entry }) => !picked.some((p) => p.entry.image_id === entry.image_id)
    );
    if (!next) break;
    picked.push({ ...next, direction: directions[picked.length] ?? "custom" });
  }

  // ── STEP 4 · Compose SeeDirection outputs with PR-18 provenance ──
  return picked.map(({ entry, score, direction }) =>
    composeDirection(entry, score, direction)
  );
}

function scoreEntry(entry: ImagesV3Entry, query: SeeQuery): number {
  let s = 0;

  // Style overlap
  if (query.style_preferences && entry.style) {
    const overlap = entry.style.filter((v) => query.style_preferences!.includes(v)).length;
    s += 0.20 * (overlap / Math.max(1, query.style_preferences.length));
  }

  // Mood overlap
  if (query.mood_preferences && entry.mood) {
    const overlap = entry.mood.filter((v) => query.mood_preferences!.includes(v)).length;
    s += 0.15 * (overlap / Math.max(1, query.mood_preferences.length));
  }

  // Canonical profile match (via style×mood pairing)
  if (query.style_preferences && query.mood_preferences && entry.canonical_profile_ids) {
    const wanted = new Set<CanonicalProfileId>();
    for (const st of query.style_preferences) {
      for (const md of query.mood_preferences) {
        wanted.add(`${st as string}_${md as string}` as CanonicalProfileId);
      }
    }
    const hits = entry.canonical_profile_ids.filter((p) => wanted.has(p)).length;
    s += 0.30 * (hits / Math.max(1, wanted.size));
  }

  // Material family match
  if (query.material_family_hint && entry.material === query.material_family_hint) {
    s += 0.15;
  }

  // Quality boost
  if (entry.quality?.photo_quality_score) {
    s += 0.05 * (entry.quality.photo_quality_score / 5);
  }
  if (entry.quality?.has_before_photo && entry.quality?.has_after_photo) {
    s += 0.05;
  }

  return s;
}

function addsDiversity(entry: ImagesV3Entry, usedProfiles: Set<string>): boolean {
  const entryProfiles = entry.canonical_profile_ids ?? [];
  // Untagged entries do NOT count as adding diversity · they carry no profile
  // signal at all. Retriever should prefer tagged entries during the diversify
  // step · untagged entries can still be filled in via the non-diversifying
  // fallback loop after the diversify pass exhausts tagged candidates.
  if (entryProfiles.length === 0) return false;
  if (usedProfiles.size === 0) return true;
  return entryProfiles.some((p) => !usedProfiles.has(p));
}

function composeDirection(
  entry: ImagesV3Entry,
  score: number,
  direction: DesignDirection
): SeeDirection {
  // Per PR-18, we return only the reference image IDs. The composed design
  // provenance is enforced elsewhere · this hero image is the anchor.
  const reference_image_ids = [entry.image_id];

  const suggested_name = suggestNameFromDirection(entry, direction);
  const reason_for_existing = reasonForExistingFromDirection(direction);
  const key_materials_description = keyMaterialsDescription(entry);

  return {
    direction,
    hero_image: entry,
    score,
    reference_image_ids,
    suggested_name,
    reason_for_existing,
    key_materials_description,
  };
}

function suggestNameFromDirection(entry: ImagesV3Entry, direction: DesignDirection): string {
  const styleWord = entry.style?.[0];
  const materialWord = entry.sub_material;
  switch (direction) {
    case "safe-centre":
      return styleWord && materialWord ? `${capitalize(materialWord)} ${capitalize(styleWord)}` : "Safe Centre";
    case "warm-character":
      return styleWord && materialWord ? `Warm ${capitalize(materialWord)}` : "Warm Character";
    case "stretch-statement":
      return styleWord && materialWord ? `Statement ${capitalize(materialWord)}` : "Stretch Statement";
    default:
      return "Design";
  }
}

function reasonForExistingFromDirection(direction: DesignDirection): string {
  switch (direction) {
    case "safe-centre":
      return "A clean modern look that works with almost any home";
    case "warm-character":
      return "For a warmer, more natural home";
    case "stretch-statement":
      return "For a stronger architectural transformation";
    default:
      return "";
  }
}

function keyMaterialsDescription(entry: ImagesV3Entry): string {
  const composition = entry.material_composition ?? [];
  if (composition.length > 0) {
    const words = composition
      .map((c) => `${c.sub_material}`)
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .slice(0, 3);
    return words.join(" + ");
  }
  return entry.sub_material ?? "";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── TRY · component swap within compatibility groups ──────────────────────

/**
 * Return 5-8 alternates for the target component role that fit the current
 * design's compatibility groups. Prevents style-clash swaps per PR-12 spec §5.2.
 */
export function retrieveTryAlternates(
  library: ImagesV3Entry[],
  query: TryQuery
): TryAlternate[] {
  const candidates = library.filter((entry) => {
    if (entry.component_role !== query.target_component_role) return false;

    const groups = entry.compatibility_group_ids ?? [];
    if (groups.length === 0) return false;

    const overlap = groups.some((g) => query.current_design_compatibility_groups.includes(g));
    if (!overlap) return false;

    if (query.material_family_filter && entry.material !== query.material_family_filter) {
      return false;
    }
    return true;
  });

  return candidates.slice(0, 8).map((entry) => ({
    entry,
    reason: "same compatibility group · matching style",
  }));
}

// ── CONNECT · resolve provenance for the Case Package ────────────────────

/**
 * Given a set of image_ids used in the composed design, return the full
 * ImagesV3Entry records for each. Used to attach reference metadata to the
 * Refacing Case at CONNECT (member-side handoff).
 */
export function resolveReferences(
  library: ImagesV3Entry[],
  imageIds: string[]
): ImagesV3Entry[] {
  const byId = new Map(library.map((e) => [e.image_id, e]));
  const out: ImagesV3Entry[] = [];
  for (const id of imageIds) {
    const e = byId.get(id);
    if (e) out.push(e);
  }
  return out;
}

