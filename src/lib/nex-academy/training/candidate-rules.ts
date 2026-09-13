// WO-ACADEMY-02 · candidate rule set applied ONLY during training.
//
// The training engine tests hypothesised rule additions against the
// specialist's stderr WITHOUT modifying the specialist's source. The
// candidate rules live in memory during the training run. If the
// verdict is IMPROVED, the RuleAdditionProposal is emitted and a
// FOUNDER-signed WO is required to adopt them through the existing
// WO-03 pipeline (§P-U · training never grants authority).
//
// This module intentionally re-implements the augmentation on TOP of
// the real WO-07 output — it never touches wo7-run-specialist.ts.

import type { SpecialistFinding } from "@/lib/nex1-orchestrator/wo7-types";

export interface CandidateRule {
  readonly rule_id: string;
  readonly description: string;
  readonly pattern_regex: string;         // JS regex source
  readonly finding_rule: string;          // e.g. "esm-import-outside-module"
  readonly severity: SpecialistFinding["severity"];
}

/**
 * Given the real specialist's findings PLUS the real stderr the specialist
 * produced, apply the candidate rules on top of the stderr and return the
 * augmented finding set. The real findings are preserved; candidate rules
 * only ADD findings when they match patterns the real specialist missed.
 *
 * This is what the training-run compares against the baseline — did the
 * candidate rules cover cases the real specialist did not?
 */
export function applyCandidateRules(input: {
  readonly real_findings: readonly SpecialistFinding[];
  readonly real_stderr: string;
  readonly candidate_rules: readonly CandidateRule[];
}): readonly SpecialistFinding[] {
  const augmented: SpecialistFinding[] = [...input.real_findings];
  const already_matched_lines = new Set<number>();
  for (const f of input.real_findings) if (f.line !== null) already_matched_lines.add(f.line);

  for (const rule of input.candidate_rules) {
    let re: RegExp;
    try { re = new RegExp(rule.pattern_regex, "m"); }
    catch { continue; }   // invalid regex is a failed candidate; the training verdict will notice
    const match = re.exec(input.real_stderr);
    if (!match) continue;
    // Only add if no existing finding already covers this
    const already = augmented.some((f) => f.rule === rule.finding_rule);
    if (already) continue;
    augmented.push({
      path: null,
      line: null,
      column: null,
      severity: rule.severity,
      rule: rule.finding_rule,
      message: `[candidate rule ${rule.rule_id}] ${match[0]}`,
    });
  }
  return augmented;
}

// ── Curated slice-1 candidate rules for wo7-node-syntax-specialist ─────

/**
 * Slice-1 target weakness: ESM-import errors ("Cannot use import statement
 * outside a module"). The real specialist parseNodeSyntaxError does not
 * currently classify these as a distinct rule.
 */
export const SLICE1_CANDIDATE_RULES: readonly CandidateRule[] = Object.freeze([
  {
    rule_id: "candidate-esm-import-outside-module",
    description: "ES-module import statement in a CommonJS context — Node emits this specific message",
    pattern_regex: "Cannot use import statement outside a module",
    finding_rule: "esm-import-outside-module",
    severity: "error",
  },
  {
    rule_id: "candidate-require-of-esm",
    description: "CommonJS require() of an ES-module — the specific ERR_REQUIRE_ESM message",
    pattern_regex: "ERR_REQUIRE_ESM|require\\(\\) of ES Module",
    finding_rule: "require-of-esm",
    severity: "error",
  },
  {
    rule_id: "candidate-unexpected-token-export",
    description: "Naked 'export' keyword in a CommonJS file — Node parser rejects it",
    pattern_regex: "SyntaxError: Unexpected token 'export'",
    finding_rule: "unexpected-export-in-cjs",
    severity: "error",
  },
]);
