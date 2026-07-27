// Query Decomposer + Multi-image Combiner — Phase 2 of the Roadmap.
//
// Takes a user query like "European oak Victorian monkey tail volute
// pink runner luxury townhouse" and:
//
//   1. Decomposes it into intent fragments (category-tagged)
//   2. Searches the manifest for images with matching intent tokens
//   3. Combines evidence across MULTIPLE images (Gold Standard —
//      no single perfect match required)
//   4. Returns per-fragment understanding + coverage % + supporting rows
//
// Per ADR-0034: "The user must never feel that NEX does not understand
// their request." Per ADR-0035: reads ALL bands, filters by band only
// when the caller explicitly requests quality-only.

import { promises as fs } from "node:fs";
import path from "node:path";
import { INTENT_VOCAB, type IntentCategory, type UserIntentTokens } from "./userIntentTokens";

// ── Query fragment ──────────────────────────────────────────────

export type QueryFragment = {
  fragment: string;
  category: IntentCategory | "unknown";
  confidence: number; // 0-100
};

export type QueryUnderstanding = {
  raw_query: string;
  fragments: QueryFragment[];
  overall_understanding: number; // avg confidence
  category_understanding: Record<IntentCategory, number>; // per-category avg
};

// ── Multi-image evidence ─────────────────────────────────────────

export type EvidenceRow = {
  url: string;
  master_score: number;
  knowledge_band: string;
  primary_brain: string | null;
  fragments_matched: string[]; // which query fragments this image covers
  match_ratio: number; // fragments_matched / total_fragments
};

export type RelationshipCoverage = {
  fragment: string;
  traversal:
    | "parent"
    | "child"
    | "sibling"
    | "collection_inheritance"
    | "architectural"
    | "material"
    | "manufacturing"
    | "designer"
    | "installation";
  supporting_urls: string[];
  inferred_confidence: number; // 0-100
};

/** 4-part generation brief per Philip's Design Philosophy (2026-07-27).
 *  Every brief has these four sections. If any part is dropped, the
 *  brief fails the Design Philosophy contract. */
export type GenerationBrief = {
  fragments_composable: string[];
  fragments_still_missing: string[];
  prompt_stem: string; // legacy short seed — kept for backward compat
  reference_image_instructions: {
    reference_url: string | null;
    reference_role: string;
    study_features: string[];
  };
  material_change: {
    replace: string | null;
    with: string | null;
    material_properties: string[];
  };
  keep: string[];
  design_philosophy: {
    immutable: true;
    text: string;
  };
  assembled_ai_prompt: string; // ready-to-paste for ChatGPT/image-gen
} | null;

/** The Design Philosophy — attached to every generation brief.
 *  Immutable per Philip 2026-07-27. */
export const NEX_DESIGN_PHILOSOPHY =
  "Never assume the customer wants an existing staircase copied. Use reference images only to understand style, craftsmanship and quality, then create an original design that matches the customer's requirements while maintaining realistic construction and professional joinery. Every staircase should look like it could be built by a master staircase manufacturer, with accurate proportions, believable structural details, and photorealistic materials.";

export type MultiImageAnswer = {
  understanding: QueryUnderstanding;
  coverage_percent: number; // legacy — kept for backwards compat
  covered_fragments: string[];
  uncovered_fragments: string[];
  evidence: EvidenceRow[];
  headline: string;
  // ADR-0036 · 5-metric split + reasoning continuation
  metrics: {
    understanding_percent: number;
    direct_evidence_percent: number;
    knowledge_relationships_percent: number;
    generation_readiness_percent: number;
    overall_capability_percent: number;
  };
  relationship_coverage: RelationshipCoverage[];
  generation_brief: GenerationBrief;
};

// ── Query Decomposer ────────────────────────────────────────────

/** Decompose a user query into intent fragments matched against the
 *  known vocabulary. Multi-word terms are matched before single words
 *  so "monkey tail volute" doesn't get split into 3 fragments. */
export function decomposeQuery(query: string): QueryUnderstanding {
  const q = query.toLowerCase();
  const fragments: QueryFragment[] = [];
  const covered = new Set<number>(); // char indices already claimed by a fragment

  // Pass 1 — try to match every vocab phrase (longest first so
  // multi-word phrases win over single words).
  const allTerms: Array<{ term: string; category: IntentCategory }> = [];
  for (const category of Object.keys(INTENT_VOCAB) as IntentCategory[]) {
    for (const term of INTENT_VOCAB[category]) {
      allTerms.push({ term, category });
    }
  }
  allTerms.sort((a, b) => b.term.length - a.term.length);

  for (const { term, category } of allTerms) {
    const idx = q.indexOf(term);
    if (idx < 0) continue;
    // Skip if any char in this span is already covered
    let overlap = false;
    for (let i = idx; i < idx + term.length; i++) {
      if (covered.has(i)) {
        overlap = true;
        break;
      }
    }
    if (overlap) continue;
    fragments.push({ fragment: term, category, confidence: 100 });
    for (let i = idx; i < idx + term.length; i++) covered.add(i);
  }

  // Pass 2 — any unclaimed word > 3 chars becomes an "unknown" fragment
  // with 50% confidence (NEX has the word but doesn't know its category)
  const words = q.match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const w of words) {
    if (w.length <= 3) continue;
    const idx = q.indexOf(w);
    if (idx < 0) continue;
    if (covered.has(idx)) continue;
    fragments.push({ fragment: w, category: "unknown", confidence: 50 });
    for (let i = idx; i < idx + w.length; i++) covered.add(i);
  }

  // Per-category averages
  const category_understanding: Record<IntentCategory, number> = {
    materials: 0,
    components: 0,
    styles: 0,
    construction: 0,
    applications: 0,
    search_phrases: 0,
  };
  const catCounts: Record<IntentCategory, number> = {
    materials: 0,
    components: 0,
    styles: 0,
    construction: 0,
    applications: 0,
    search_phrases: 0,
  };
  for (const f of fragments) {
    if (f.category === "unknown") continue;
    category_understanding[f.category] += f.confidence;
    catCounts[f.category]++;
  }
  for (const c of Object.keys(category_understanding) as IntentCategory[]) {
    if (catCounts[c] > 0) category_understanding[c] /= catCounts[c];
  }

  const overall_understanding =
    fragments.length === 0
      ? 0
      : Math.round(
          fragments.reduce((sum, f) => sum + f.confidence, 0) / fragments.length
        );

  return {
    raw_query: query,
    fragments,
    overall_understanding,
    category_understanding,
  };
}

// ── Multi-image combiner ────────────────────────────────────────

const MANIFEST_PATH = path.join(process.cwd(), "data", "nex-image-manifest.json");

async function loadManifest(): Promise<Array<Record<string, unknown>>> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw) as { images?: Record<string, Record<string, unknown>> };
    const rows: Array<Record<string, unknown>> = [];
    for (const [url, row] of Object.entries(parsed.images ?? {})) {
      rows.push({ ...row, url });
    }
    return rows;
  } catch {
    return [];
  }
}

/** Given a decomposed query, find images whose USER INTENT TOKENS
 *  cover the requested fragments. Combines evidence across multiple
 *  images (Gold Standard: no single perfect match required). */
export async function combineEvidence(
  understanding: QueryUnderstanding,
  opts: { minBand?: string; maxEvidence?: number } = {}
): Promise<MultiImageAnswer> {
  const manifest = await loadManifest();
  const bandOrder = ["visual", "limited", "reference", "specialist", "good", "excellent", "master"];
  const minBandIdx = opts.minBand ? bandOrder.indexOf(opts.minBand) : 0;

  const target_fragments = understanding.fragments
    .filter((f) => f.category !== "unknown")
    .map((f) => f.fragment);
  const target_set = new Set(target_fragments);

  const scored: EvidenceRow[] = [];
  for (const row of manifest) {
    // Band filter
    const band = (row.knowledge_band as string) ?? "visual";
    if (bandOrder.indexOf(band) < minBandIdx) continue;

    // Extract intent tokens from this row's description
    const description = (row.description as string) ?? "";
    if (!description) continue;
    const { extractUserIntentTokens } = await import("./userIntentTokens");
    const tokens: UserIntentTokens = extractUserIntentTokens(description);
    const allTokens = [
      ...tokens.materials,
      ...tokens.components,
      ...tokens.styles,
      ...tokens.construction,
      ...tokens.applications,
      ...tokens.search_phrases,
    ];
    const matched = allTokens.filter((t) => target_set.has(t));
    if (matched.length === 0) continue;

    scored.push({
      url: row.url as string,
      master_score:
        ((row.master_image_score as { master_score?: number } | undefined)?.master_score) ?? 0,
      knowledge_band: band,
      primary_brain: ((row.primary_brain as string | null) ?? null),
      fragments_matched: matched,
      match_ratio: matched.length / Math.max(1, target_fragments.length),
    });
  }

  // Rank by (fragments covered × 10) + master_score/10 — prioritise coverage
  scored.sort((a, b) => {
    const scoreA = a.fragments_matched.length * 10 + a.master_score / 10;
    const scoreB = b.fragments_matched.length * 10 + b.master_score / 10;
    return scoreB - scoreA;
  });

  // Greedy fragment coverage — pick images until all fragments covered
  // OR the top N images are exhausted
  const covered = new Set<string>();
  const evidence: EvidenceRow[] = [];
  const cap = opts.maxEvidence ?? 8;
  for (const row of scored) {
    const newContribution = row.fragments_matched.filter((f) => !covered.has(f));
    if (newContribution.length === 0) continue;
    evidence.push(row);
    for (const f of row.fragments_matched) covered.add(f);
    if (evidence.length >= cap) break;
    if (covered.size >= target_set.size) break;
  }

  const covered_fragments = [...covered];
  const uncovered_fragments = target_fragments.filter((f) => !covered.has(f));
  const coverage_percent =
    target_fragments.length === 0
      ? 100
      : Math.round((covered.size / target_fragments.length) * 100);

  // ADR-0036 · Stage 3 — Relationship traversal for uncovered fragments
  const relationship_coverage = await traverseRelationships(
    uncovered_fragments,
    understanding,
    manifest
  );
  const relationship_covered_set = new Set(relationship_coverage.map((r) => r.fragment));

  // ADR-0036 · Stage 4 — Generation Brief for whatever remains
  const still_missing = uncovered_fragments.filter((f) => !relationship_covered_set.has(f));
  const generation_brief = await buildGenerationBrief(understanding, evidence, still_missing);

  // ADR-0036 · 5 metrics
  const understanding_percent = understanding.overall_understanding;
  const direct_evidence_percent = coverage_percent;
  const knowledge_relationships_percent =
    target_fragments.length === 0
      ? 0
      : Math.round((relationship_covered_set.size / target_fragments.length) * 100);
  const generation_readiness_percent = generation_brief
    ? Math.round(
        (generation_brief.fragments_composable.length /
          Math.max(1, target_fragments.length)) *
          100
      )
    : 0;
  const overall_capability_percent = Math.round(
    understanding_percent * 0.25 +
      direct_evidence_percent * 0.25 +
      knowledge_relationships_percent * 0.25 +
      generation_readiness_percent * 0.25
  );

  // Headline per ADR-0036 — NEVER lead with a low coverage % without qualifying words
  let headline: string;
  if (target_fragments.length === 0) {
    headline = `I understood the query at ${understanding_percent}%. Add materials, styles, or components to sharpen the request.`;
  } else if (overall_capability_percent >= 85) {
    headline = `I understand your request completely. Direct evidence covers ${direct_evidence_percent}%; relationships and generation fill the rest. Overall capability: ${overall_capability_percent}%.`;
  } else {
    headline = `I understand your request (${understanding_percent}%). Direct evidence covers ${direct_evidence_percent}%. Relationship traversals reached ${knowledge_relationships_percent}% more. Generation-brief readiness: ${generation_readiness_percent}%. Overall capability: ${overall_capability_percent}%.`;
  }

  return {
    understanding,
    coverage_percent,
    covered_fragments,
    uncovered_fragments,
    evidence,
    headline,
    metrics: {
      understanding_percent,
      direct_evidence_percent,
      knowledge_relationships_percent,
      generation_readiness_percent,
      overall_capability_percent,
    },
    relationship_coverage,
    generation_brief,
  };
}

// ── ADR-0036 · Stage 3 — Relationship Traversal ────────────────

async function traverseRelationships(
  uncovered: string[],
  understanding: QueryUnderstanding,
  manifest: Array<Record<string, unknown>>
): Promise<RelationshipCoverage[]> {
  if (uncovered.length === 0) return [];
  const results: RelationshipCoverage[] = [];

  // Build a fragment → category map so we know which traversals apply
  const fragCategory = new Map<string, string>();
  for (const f of understanding.fragments) fragCategory.set(f.fragment, f.category);

  const { extractUserIntentTokens } = await import("./userIntentTokens");

  for (const fragment of uncovered) {
    const category = fragCategory.get(fragment) ?? "unknown";
    const traversalOrder: Array<RelationshipCoverage["traversal"]> = [
      "collection_inheritance",
      "architectural",
      "material",
      "manufacturing",
      "sibling",
      "designer",
      "installation",
      "parent",
      "child",
    ];

    for (const traversal of traversalOrder) {
      const hits = manifest.filter((row) => {
        const tokens = extractUserIntentTokens((row.description as string) ?? "");
        // Traversal predicate — each traversal type looks for a
        // different flavour of related knowledge. Keeps it simple
        // pre-Phase-3 graph; each traversal returns supporting rows.
        switch (traversal) {
          case "collection_inheritance": {
            const memberships = (row.collection_memberships as string[]) ?? [];
            // If the fragment appears in another row's collection cluster,
            // that's inheritance coverage
            return memberships.some((m) => m.toLowerCase().includes(fragmentRootWord(fragment)));
          }
          case "architectural":
            return category === "styles" && tokens.styles.length > 0;
          case "material":
            return category === "materials" && tokens.materials.length > 0;
          case "manufacturing":
            return tokens.construction.some((c) => c.toLowerCase().includes(fragmentRootWord(fragment)));
          case "sibling": {
            const family = row.family_tree as { children?: unknown[] } | undefined;
            return (family?.children?.length ?? 0) > 0;
          }
          case "designer":
            return category === "styles" && (row.knowledge_band as string) === "good";
          case "installation":
            return tokens.applications.some((a) => a.toLowerCase().includes(fragmentRootWord(fragment)));
          case "parent": {
            const family = row.family_tree as { parent_url?: string } | undefined;
            return !!family?.parent_url;
          }
          case "child": {
            const family = row.family_tree as { children?: unknown[] } | undefined;
            return (family?.children?.length ?? 0) > 0;
          }
          default:
            return false;
        }
      });
      if (hits.length > 0) {
        results.push({
          fragment,
          traversal,
          supporting_urls: hits.slice(0, 3).map((r) => r.url as string),
          inferred_confidence: Math.min(80, 30 + hits.length * 5),
        });
        break; // one traversal wins per fragment (highest-priority)
      }
    }
  }

  return results;
}

function fragmentRootWord(fragment: string): string {
  // "european oak" → "oak", "monkey tail volute" → "volute", "victorian" → "victorian"
  const words = fragment.split(/\s+/);
  return words[words.length - 1].toLowerCase();
}

// ── ADR-0036 · Stage 4 — Generation Brief ──────────────────────

async function buildGenerationBrief(
  understanding: QueryUnderstanding,
  evidence: EvidenceRow[],
  still_missing: string[]
): Promise<GenerationBrief> {
  const fragments = understanding.fragments.filter((f) => f.category !== "unknown");
  if (fragments.length === 0) return null;
  const composable = fragments.map((f) => f.fragment);

  // Extract fragment categories
  const materials = fragments.filter((f) => f.category === "materials").map((f) => f.fragment);
  const components = fragments.filter((f) => f.category === "components").map((f) => f.fragment);
  const styles = fragments.filter((f) => f.category === "styles").map((f) => f.fragment);
  const construction = fragments.filter((f) => f.category === "construction").map((f) => f.fragment);
  const applications = fragments.filter((f) => f.category === "applications").map((f) => f.fragment);

  // Legacy prompt_stem (backward compat)
  const stemParts: string[] = ["Ultra photorealistic architectural photography of a"];
  if (styles.length) stemParts.push(styles.join(" "));
  if (construction.length) stemParts.push(construction.join(" "));
  stemParts.push("staircase");
  if (materials.length) stemParts.push(`in ${materials.join(" and ")}`);
  if (components.length) stemParts.push(`featuring ${components.join(", ")}`);
  if (applications.length) stemParts.push(`set in a ${applications.join(", ")}`);
  stemParts.push(
    ". Rendered in premium architectural visualization quality with realistic lighting and material detail throughout."
  );
  const prompt_stem = stemParts.join(" ").replace(/\s+/g, " ").trim();

  // Pick the strongest evidence row as the QUALITY BAR reference (not
  // a copy target) per Philip's Design Philosophy — the reference is
  // inspiration only, never the answer itself.
  const referenceRow = evidence[0];
  const reference_url = referenceRow ? referenceRow.url : null;

  // Study features come from what NEX ALREADY knows about the reference
  const study_features = referenceRow
    ? referenceRow.fragments_matched.map((f) => `${f} (as seen in reference)`)
    : [];

  // Assembled AI prompt — this is what NEX would paste into
  // ChatGPT/image-gen. Prepends the NEX Staircase Design System Prompt
  // (Philip 2026-07-27) as the behavioural contract, then follows
  // the 4-part reference/change/keep/philosophy structure.
  const { NEX_STAIRCASE_DESIGN_SYSTEM_PROMPT } = await import(
    "./staircaseDesignSystemPrompt"
  );
  const assembled: string[] = [
    "═══════════════════════════════════════════════════════════════",
    "NEX STAIRCASE DESIGN SYSTEM PROMPT (behavioural contract)",
    "═══════════════════════════════════════════════════════════════",
    NEX_STAIRCASE_DESIGN_SYSTEM_PROMPT,
    "",
    "═══════════════════════════════════════════════════════════════",
    "GENERATION BRIEF FOR THIS SPECIFIC REQUEST",
    "═══════════════════════════════════════════════════════════════",
    "",
    "REFERENCE IMAGE INSTRUCTIONS.",
    reference_url
      ? `Reference URL: ${reference_url}. This image is ONLY a quality bar — study proportions, materials, joinery, lighting. Do NOT copy exactly.`
      : "No reference image supplied — design purely from the requirements.",
    referenceRow
      ? `Study features: ${referenceRow.fragments_matched.join(", ")}.`
      : "",
    "",
    "REQUIREMENTS (must be present in the generated image):",
    styles.length ? `Style: ${styles.join(" · ")}` : "",
    materials.length ? `Materials: ${materials.join(" · ")}` : "",
    components.length ? `Components: ${components.join(" · ")}` : "",
    construction.length ? `Construction: ${construction.join(" · ")}` : "",
    applications.length ? `Application context: ${applications.join(" · ")}` : "",
    "",
    "KEEP (preserve from reference if present):",
    "Overall proportions · realistic joinery · photorealistic lighting · premium furniture-grade finish quality.",
    "",
    "DESIGN PHILOSOPHY (immutable):",
    NEX_DESIGN_PHILOSOPHY,
    "",
    still_missing.length
      ? `NOTE: These aspects have no direct evidence in the current library — generate them from the reference's quality bar + the specification above: ${still_missing.join(", ")}.`
      : "",
    "",
    "OUTPUT: Ultra photorealistic architectural product render. Every detail must look like it could be built by a master staircase manufacturer with accurate proportions and believable structural details.",
  ]
    .filter((s) => s.length > 0)
    .join("\n");

  return {
    fragments_composable: composable,
    fragments_still_missing: still_missing,
    prompt_stem,
    reference_image_instructions: {
      reference_url,
      reference_role:
        "Quality bar reference. Study the properties. DO NOT copy this image exactly unless the user specifically asks.",
      study_features,
    },
    material_change: {
      replace: null, // populated when user query includes "replace X with Y" pattern (future)
      with: null,
      material_properties: materials,
    },
    keep: [
      "Overall proportions",
      "Realistic joinery",
      "Photorealistic lighting",
      "Premium furniture-grade finish quality",
    ],
    design_philosophy: {
      immutable: true,
      text: NEX_DESIGN_PHILOSOPHY,
    },
    assembled_ai_prompt: assembled,
  };
}
