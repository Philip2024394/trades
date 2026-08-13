// Construction Rules Library · validateCombination().
//
// Given a proposed component combination · fires every applicable rule ·
// returns a ValidationReport with per-rule status + suggested fixes. Never
// mutates the combination · never renders · pure function.
//
// Doctrine: docs/brains/nex-construction-rules-library-eighth-genome-philip-2026-08-04.md

import type { CombinationSpec, ComponentPredicate, ConstructionRule, RuleFiring, ValidationReport } from "./types";
import { SEED_RULES } from "./rules";

const VALIDATOR_VERSION = "cr_validator_1.0";

function combinationHas(combination: CombinationSpec, pred: ComponentPredicate): boolean {
  return combination.some((c) => c.slot === pred.slot && c.value === pred.value);
}

function combinationHasSlot(combination: CombinationSpec, slot: string): boolean {
  return combination.some((c) => c.slot === slot);
}

function triggersFor(rule: ConstructionRule, combination: CombinationSpec): boolean {
  return rule.if_present.every((pred) => combinationHas(combination, pred));
}

function evaluateRule(rule: ConstructionRule, combination: CombinationSpec): RuleFiring | undefined {
  if (!triggersFor(rule, combination)) return undefined;

  const missing_required: ComponentPredicate[] = [];
  if (rule.then_requires) {
    for (const req of rule.then_requires) {
      // If the required predicate specifies an EXACT value AND the combination
      // has that slot with a DIFFERENT value · that's a violation.
      // If the required predicate says slot=value=`present` we only check the slot exists.
      if (req.value === "present") {
        if (!combinationHasSlot(combination, req.slot)) missing_required.push(req);
      } else {
        if (!combinationHas(combination, req)) missing_required.push(req);
      }
    }
  }

  const forbidden_present: ComponentPredicate[] = [];
  if (rule.forbids) {
    for (const forb of rule.forbids) {
      if (combinationHas(combination, forb)) forbidden_present.push(forb);
    }
  }

  const violated = missing_required.length > 0 || forbidden_present.length > 0;
  return {
    rule_id: rule.rule_id,
    severity: rule.severity,
    reason: rule.reason,
    status: violated ? "violated" : "satisfied",
    missing_required: missing_required.length > 0 ? missing_required : undefined,
    forbidden_present: forbidden_present.length > 0 ? forbidden_present : undefined,
    suggested_fix: violated ? rule.suggested_fix : undefined,
    citation: rule.citation,
  };
}

export function validateCombination(combination: CombinationSpec, opts?: { rules?: readonly ConstructionRule[]; domain?: string }): ValidationReport {
  const now = new Date().toISOString();
  const applicable = (opts?.rules ?? SEED_RULES).filter((r) => (opts?.domain ? r.domain === opts.domain || r.domain === "general" : true));
  const firings: RuleFiring[] = [];
  for (const rule of applicable) {
    const firing = evaluateRule(rule, combination);
    if (firing) firings.push(firing);
  }

  const passes = firings.filter((f) => f.status === "satisfied").length;
  const advisories = firings.filter((f) => f.status === "violated" && f.severity === "advisory").length;
  const warns = firings.filter((f) => f.status === "violated" && f.severity === "warn").length;
  const required_failures = firings.filter((f) => f.status === "violated" && f.severity === "required").length;
  const impossible_failures = firings.filter((f) => f.status === "violated" && f.severity === "impossible").length;

  let overall: ValidationReport["overall"];
  if (impossible_failures > 0) overall = "impossible";
  else if (required_failures > 0) overall = "invalid";
  else if (warns > 0) overall = "has_warnings";
  else if (advisories > 0) overall = "advisory_only";
  else overall = "valid";

  return {
    combination,
    firings,
    passes,
    advisories,
    warns,
    required_failures,
    impossible_failures,
    overall,
    validator_version: VALIDATOR_VERSION,
    generated_at: now,
  };
}
