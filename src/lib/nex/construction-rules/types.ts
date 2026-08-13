// Construction Rules Library · types (Philip 2026-08-04 · 8th Design Genome library).
//
// Distinct from `relationship-library` (which says A connects to B) and from
// `construction-platform/rules.ts` (which checks numeric Building Regs).
// Construction Rules encode WHY component combinations are valid or invalid ·
// enabling automatic validation BEFORE rendering or manufacturing.
//
// Doctrine: docs/brains/nex-construction-rules-library-eighth-genome-philip-2026-08-04.md

export type RuleSeverity = "advisory" | "warn" | "required" | "impossible";
export type RuleDomain = "staircase" | "kitchen" | "wardrobe" | "roofing" | "doors" | "loft_ladders" | "general";

export type ComponentPredicate = {
  slot: string;                          // e.g. "handrail_termination" · "newel_family"
  value: string;                         // e.g. "scroll_volute" · "volute_turned"
};

export type ConstructionRule = {
  rule_id: string;
  domain: RuleDomain;
  severity: RuleSeverity;
  citation?: string;                     // "Building Regs Part K" · "BS 585-1" · etc.
  reason: string;                        // WHY the rule exists · used by Voice + suggested_fix
  if_present: readonly ComponentPredicate[];
  then_requires?: readonly ComponentPredicate[];
  forbids?: readonly ComponentPredicate[];
  suggested_fix?: string;
  provenance: { named_expert: string; authored: string };
};

export type CombinationSpec = readonly ComponentPredicate[];

export type RuleFiring = {
  rule_id: string;
  severity: RuleSeverity;
  reason: string;
  status: "satisfied" | "violated";
  missing_required?: readonly ComponentPredicate[];
  forbidden_present?: readonly ComponentPredicate[];
  suggested_fix?: string;
  citation?: string;
};

export type ValidationReport = {
  combination: CombinationSpec;
  firings: readonly RuleFiring[];
  passes: number;
  advisories: number;
  warns: number;
  required_failures: number;
  impossible_failures: number;
  overall: "valid" | "advisory_only" | "has_warnings" | "invalid" | "impossible";
  validator_version: string;
  generated_at: string;
};
