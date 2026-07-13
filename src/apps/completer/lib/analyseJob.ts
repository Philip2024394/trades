// Job archetype detection + missing-material analysis.
//
// Given a list of materials the trade already has (from Job Cost Mode
// lines, Notebook, or the Site queue) plus optional job tags, find the
// best-matching archetype and return the expected materials the trade
// hasn't got yet.

import {
  JOB_ARCHETYPE_FIXTURES,
  type ArchetypeMaterial,
  type ArchetypeTag,
  type JobArchetype
} from "../data/jobArchetypes";

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function nameMatches(a: string, b: string): boolean {
  const na = normalise(a);
  const nb = normalise(b);
  if (na.includes(nb) || nb.includes(na)) return true;
  // Token overlap
  const ta = new Set(na.split(" ").filter(Boolean));
  const tb = new Set(nb.split(" ").filter(Boolean));
  let overlap = 0;
  ta.forEach((t) => {
    if (tb.has(t) && t.length >= 3) overlap++;
  });
  return overlap >= 2;
}

/**
 * Score every archetype against current materials + tags. Highest score
 * wins. Ties resolved by taking the first (more specialised archetypes
 * come first in the fixture order).
 */
export function detectArchetype(
  existingMaterialNames: string[],
  tags: string[]
): JobArchetype | null {
  let best: { archetype: JobArchetype; score: number } | null = null;

  for (const arch of JOB_ARCHETYPE_FIXTURES) {
    let score = 0;

    // Match by tags
    const tagsLower = tags.map((t) => t.toLowerCase());
    for (const t of arch.matchTags) {
      if (tagsLower.includes(t)) score += 3;
    }

    // Match by materials name
    for (const mn of arch.matchMaterialNames) {
      for (const existing of existingMaterialNames) {
        if (nameMatches(existing, mn)) {
          score += 2;
          break;
        }
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { archetype: arch, score };
    }
  }

  return best?.archetype ?? null;
}

export type MissingMaterialWithReason = ArchetypeMaterial & {
  reason: string;
};

/**
 * Compare the archetype's expected materials to what the trade already
 * has, and return the missing ones — grouped by criticality.
 */
export function missingMaterials(
  archetype: JobArchetype,
  existingMaterialNames: string[]
): MissingMaterialWithReason[] {
  const missing: MissingMaterialWithReason[] = [];
  for (const expected of archetype.expectedMaterials) {
    const hasIt = existingMaterialNames.some((existing) =>
      nameMatches(existing, expected.name)
    );
    if (!hasIt) {
      missing.push({
        ...expected,
        reason:
          expected.criticality === "essential"
            ? "Job stops without this"
            : expected.criticality === "recommended"
              ? "You usually need this on a job like this"
              : "Sometimes needed — depends on substrate / customer"
      });
    }
  }
  return missing;
}

export type JobAnalysis = {
  archetype: JobArchetype | null;
  missing: MissingMaterialWithReason[];
  essentialMissing: number;
  recommendedMissing: number;
  situationalMissing: number;
};

export function analyseJob(
  existingMaterialNames: string[],
  tags: string[] = []
): JobAnalysis {
  const archetype = detectArchetype(existingMaterialNames, tags);
  if (!archetype) {
    return {
      archetype: null,
      missing: [],
      essentialMissing: 0,
      recommendedMissing: 0,
      situationalMissing: 0
    };
  }
  const missing = missingMaterials(archetype, existingMaterialNames);
  return {
    archetype,
    missing,
    essentialMissing: missing.filter((m) => m.criticality === "essential").length,
    recommendedMissing: missing.filter((m) => m.criticality === "recommended").length,
    situationalMissing: missing.filter((m) => m.criticality === "situational").length
  };
}
