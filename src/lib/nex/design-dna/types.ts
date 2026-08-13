// Design DNA Engine · types.
//
// Every PROJECT receives a fingerprint. Distinct from Vision Intelligence's
// image-level Style DNA · this aggregates every VisionAnalysis + material
// choice + reasoning chain across a project.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

export type ComplexityLabel = "very_low" | "low" | "medium" | "high" | "very_high";
export type ContrastLabel = "low" | "medium" | "high";
export type SymmetryLabel = "low" | "medium" | "high";

export type DesignDNAFingerprint = {
  project_id: string;
  captured_at: string;
  style_weights: Record<string, number>; // e.g. { luxury: 0.82, scandinavian: 0.14, industrial: 0.04 } · sums to ~1
  warmth_score: number;                  // 0..100
  complexity: ComplexityLabel;
  contrast: ContrastLabel;
  symmetry: SymmetryLabel;
  timber?: string;
  palette?: readonly string[];
  hardware?: string;
  lighting?: string;
  mood?: string;
  sample_size: number;                   // how many analyses fed this fingerprint
  provenance: { engine_version: string; generated_at: string };
};
