// Image Critic Brain · types.
//
// Not "looks nice". Scores every rendered image across 10 dimensions with
// evidence and suggested edits. Feeds Learning Loop + informs Reality Advisor.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

export type CritiqueDimension =
  | "realism" | "lighting" | "composition" | "typography" | "brand_consistency"
  | "construction_accuracy" | "anatomy" | "perspective" | "marketing_quality" | "accessibility";

export const CRITIQUE_DIMENSIONS: readonly CritiqueDimension[] = [
  "realism", "lighting", "composition", "typography", "brand_consistency",
  "construction_accuracy", "anatomy", "perspective", "marketing_quality", "accessibility",
];

export type DimensionScore = {
  dimension: CritiqueDimension;
  score: number;                         // 0..100
  evidence: readonly string[];           // what informed this score
};

export type CritiqueIssue = {
  dimension: CritiqueDimension;
  severity: "info" | "warn" | "error";
  message: string;
};

export type CritiqueSuggestion = {
  dimension: CritiqueDimension;
  edit_command: string;                  // parsable by Editing Platform · e.g. "Increase the logo by 15%"
  expected_gain: number;                 // predicted score delta
};

export type CritiqueContext = {
  design_document?: unknown;             // for heuristic checks that don't require pixels
  render_manifest?: unknown;
  reality_report?: unknown;
  hero_intelligence?: unknown;
  grammar_violations?: readonly { severity: string; rule: string }[];
};

export type CritiqueReport = {
  overall_score: number;                 // 0..100 · unweighted mean of dimensions
  scores: readonly DimensionScore[];
  issues: readonly CritiqueIssue[];
  suggestions: readonly CritiqueSuggestion[];
  critic_version: string;
  generated_at: string;
};
