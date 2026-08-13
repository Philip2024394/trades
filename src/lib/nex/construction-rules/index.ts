// Construction Rules Library · public exports.
//
// Doctrine: docs/brains/nex-construction-rules-library-eighth-genome-philip-2026-08-04.md

export { SEED_RULES, RULES_INDEX, listRules, getRule, rulesForDomain, count } from "./rules";
export { validateCombination } from "./validate";
export type {
  ConstructionRule, RuleSeverity, RuleDomain,
  ComponentPredicate, CombinationSpec,
  RuleFiring, ValidationReport,
} from "./types";
