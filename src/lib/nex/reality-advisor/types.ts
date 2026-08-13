// Reality Advisor Platform · contract.
//
// Philip 2026-08-04: "The Reality Advisor never changes the design. It only
// advises." Sits between Planning and Rendering. Reads a proposed Design
// Document · returns 7-level realism classification + 7-dimension validation
// scores + advisory notes.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

// ─── 7-level realism classification ─────────────────────────────────────

export type RealismClassification =
  | "realistic"                          // buildable today with standard practice
  | "possible"                           // buildable with engineering
  | "requires_engineering"               // needs structural or specialist input
  | "requires_structural_changes"        // building modification required
  | "building_regulations_required"      // regs consent needed
  | "not_recommended"                    // feasible but strongly advised against
  | "impossible";                        // cannot be built

export const REALISM_ORDER: readonly RealismClassification[] = [
  "realistic", "possible", "requires_engineering", "requires_structural_changes",
  "building_regulations_required", "not_recommended", "impossible",
];

// ─── 7 validation score dimensions ──────────────────────────────────────

export type ValidationScore = {
  design_score: number;                  // 0-100 · aesthetic strength
  construction_score: number;            // 0-100 · buildability
  safety_score: number;                  // 0-100 · risk to occupants + installers
  budget_score: number;                  // 0-100 · realism vs. stated budget
  maintenance_score: number;             // 0-100 · long-term serviceability
  building_regulation_score: number;     // 0-100 · compliance likelihood
  reality_score: number;                 // 0-100 · overall "this can be built"
};

// ─── Advisory note ──────────────────────────────────────────────────────

export type AdvisoryConcern = {
  category: "structural" | "joinery" | "manufacturing" | "installation" | "cost"
    | "safety" | "building_regulations" | "accessibility" | "maintenance"
    | "durability" | "material_compatibility";
  severity: "info" | "warn" | "error";
  message: string;
  suggested_action?: string;
};

// ─── Input · a proposed design ──────────────────────────────────────────

export type RealityQuery = {
  domain: string;                        // "staircase" · "kitchen" · "roofing" · etc.
  design_summary: string;                // short natural-language description
  key_measurements?: readonly { label: string; value: number; unit: string }[];
  materials?: readonly string[];
  location?: "domestic" | "commercial" | "public";
  budget_estimate_gbp?: number;
  metadata?: Record<string, unknown>;
};

// ─── Output · advisory report ───────────────────────────────────────────

export type RealityReport = {
  classification: RealismClassification;
  scores: ValidationScore;
  concerns: readonly AdvisoryConcern[];
  reasoning: readonly string[];
  advisor_version: string;
  generated_at: string;
};

// ─── Platform contract ──────────────────────────────────────────────────

export type RealityAdvisorPlatform = {
  advise(query: RealityQuery): RealityReport;
};
