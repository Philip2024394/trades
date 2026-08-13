// Construction Intelligence Platform · engineering-brain contract.
//
// Understands regulations · clearances · manufacturability · fixings ·
// tolerances. Composes with Reality Advisor. Never mutates a design ·
// only reports compliance.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

export type ConstructionDomain = "staircase" | "kitchen" | "wardrobe" | "door" | "window" | "roofing" | "flooring" | "bathroom" | "structural";

export type RuleCategory =
  | "building_regulation" | "clearance" | "load_bearing" | "manufacturability"
  | "installation" | "fixing" | "tolerance" | "accessibility" | "safety";

export type RuleSeverity = "info" | "advisory" | "required";

export type ConstructionRule = {
  id: string;
  domain: ConstructionDomain;
  category: RuleCategory;
  severity: RuleSeverity;
  title: string;
  citation?: string;                     // e.g. "Building Regs Part K · England 2013"
  min?: number;
  max?: number;
  unit?: string;                         // e.g. "mm" · "deg" · "kg/m²"
  applies_when?: string;                 // free-text condition · human-authored
  advice: string;
  provenance: { named_expert: string; authored: string };
};

export type ComplianceCheck = {
  rule_id: string;
  domain: ConstructionDomain;
  severity: RuleSeverity;
  passed: boolean;
  measured?: number;
  message: string;
  citation?: string;
};

export type ComplianceReport = {
  domain: ConstructionDomain;
  checks: readonly ComplianceCheck[];
  total_rules_checked: number;
  passes: number;
  advisories: number;
  failures: number;
  generated_at: string;
};

export type MeasurementInput = { path?: string; value: number; unit: string };

export type ComplianceQuery = {
  domain: ConstructionDomain;
  measurements: Record<string, MeasurementInput>;   // keyed by rule.applies_to metric name
  context?: { location?: "domestic" | "commercial"; use?: "primary" | "secondary" | "loft" | "external" };
};
