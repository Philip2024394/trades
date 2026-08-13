// Construction Intelligence Platform · public exports.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

export { CONSTRUCTION_RULES, listRules, getRule, rulesForDomain } from "./rules";
export { check } from "./check";
export type {
  ConstructionDomain, ConstructionRule, ComplianceCheck, ComplianceReport,
  ComplianceQuery, MeasurementInput, RuleCategory, RuleSeverity,
} from "./types";
