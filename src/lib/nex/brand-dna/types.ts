// Brand DNA · types (Philip 2026-08-04).
//
// Every upload strengthens one or more brand-personality profiles. Distinct
// from Style DNA (per-image) and Design DNA (per-project) · Brand DNA is a
// GLOBAL taxonomy of brand archetypes each with a growing evidence base.
//
// Doctrine: docs/brains/nex-six-intelligence-layers-and-design-genome-libraries-philip-2026-08-04.md

export type BrandArchetype =
  | "industrial" | "luxury" | "trade" | "premium" | "modern"
  | "family" | "minimal" | "corporate" | "heritage" | "eco";

export type BrandProfile = {
  archetype: BrandArchetype;
  display_name: string;
  keywords: readonly string[];             // e.g. ["strength", "engineering", "trade-focused"]
  colour_grammar_slots: readonly string[]; // colour meanings that tend to appear · e.g. ["strength", "premium"]
  audiences: readonly string[];
  observation_count: number;
  aggregate_confidence: number;            // 0..1
  evidence_asset_ids: readonly string[];
  history: readonly { at: string; delta: number; reason: string; evidence?: string }[];
  provenance: { named_expert: string; authored: string };
};
