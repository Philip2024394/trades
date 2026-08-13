// Voice Intelligence Platform · types.
//
// Voice reads from the Design Document · Render Manifest · Reality Report ·
// Material Intelligence · Spatial Measurements · never invents an explanation.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

export type VoiceIntent =
  | "why_choice"                         // "why did you choose oak here?"
  | "what_is"                            // "what material is this?"
  | "how_wide"                           // "how wide is that staircase?"
  | "can_be_built"                       // "can this be built?"
  | "show_alternatives"                  // "show me alternatives"
  | "explain_evolution"                  // "why did the design evolve?"
  | "cost_estimate"                      // "what does this cost?"
  | "maintenance"                        // "how do I maintain it?"
  | "custom";

export type VoiceQuery = {
  intent: VoiceIntent;
  target_path?: string;                  // JSON-pointer into the Design Document
  free_text?: string;
  audience?: "customer" | "installer" | "specifier" | "regulator";
};

export type VoiceEvidence = {
  source: "design_document" | "render_manifest" | "reality_report" | "material_intelligence" | "spatial_measurement" | "recommendation" | "design_history";
  reference: string;                     // path or id
  snippet?: string;
};

export type VoiceExplanation = {
  answer: string;                        // rendered natural-language answer
  evidence: readonly VoiceEvidence[];    // every claim traceable
  confidence: "high" | "medium" | "low";
  refused?: { reason: string };          // set when Voice would have to guess
  generated_at: string;
};

// Everything Voice needs to answer any query · assembled by the caller.
export type VoiceContext<Doc = unknown> = {
  design_document: Doc;
  render_manifest?: unknown;
  reality_report?: unknown;
  material_lookups?: Record<string, unknown>;
  spatial_measurements?: Record<string, unknown>;
  design_history?: unknown;              // DesignHistory<Doc>
  recommendations?: readonly unknown[];
};
