// src/lib/nex/programmer-review/test-quality.ts
//
// NEX Programmer Agent · Phase C · test-quality analyzer
// Philip 2026-09-05 · AUTHORIZE §9
//
// Detects that TESTS PASSING is not the same as CORRECTNESS.
// The analyzer inspects declared coverage vs required edge cases and
// raises findings when tests systematically miss material behaviors.
//
// Rules (deterministic · no LLM):
//   1. required edge cases not in covered set → MATERIAL test_gap
//   2. `known_gaps` non-empty → MATERIAL test_gap (implementer already
//      acknowledged the gap)
//   3. tests.passed > 0 but tests.summary suggests only-positive
//      coverage (heuristic: mentions "success" · "happy path" · "normal"
//      but not "error" · "failure" · "reject" · "boundary" · "edge")
//      → WARNING test_weakness
//   4. tests.passed === 0 → INFO test_gap (no tests present)

import type { Finding, FindingCategory, FindingSeverity, ReviewRequest } from "./types";

let _fid = 0;
function nextFindingId(prefix: string): string {
  _fid += 1;
  return `${prefix}_${Date.now().toString(36)}_${_fid}`;
}

const POSITIVE_ONLY_HINTS = /(happy\s*path|success|normal|standard|typical|passes)/i;
const NEGATIVE_COVERAGE_HINTS = /(error|failure|reject|boundary|edge|invalid|missing|negative|throws|refuses)/i;

/** Compute the set of REQUIRED edge cases not covered by tests. */
export function missingEdgeCases(req: ReviewRequest): string[] {
  const required = new Set((req.requirement_details.edge_cases_required ?? []).map((s) => s.toLowerCase().trim()));
  const covered = new Set((req.requirement_details.edge_cases_covered ?? []).map((s) => s.toLowerCase().trim()));
  const missing: string[] = [];
  for (const r of required) if (!covered.has(r)) missing.push(r);
  return missing;
}

/** Detect test-quality findings for the given review request. */
export function analyzeTestQuality(req: ReviewRequest): Finding[] {
  const findings: Finding[] = [];

  // Rule 1: uncovered required edge cases → MATERIAL test_gap
  const missing = missingEdgeCases(req);
  if (missing.length > 0) {
    findings.push(mkFinding({
      severity: "MATERIAL",
      category: "test_gap",
      message: `${missing.length} required edge case(s) not covered by tests: ${missing.join(", ")}`,
      rationale: "Test suite passes for the covered cases but does not exercise the required edge behaviors. Green tests do not prove correctness for uncovered branches.",
      evidence_pointer: `review:${req.review_id}:requirement_details.edge_cases_required vs edge_cases_covered`,
      affected_behavior: `Behaviors relying on: ${missing.join(", ")}`,
      recommended_correction: `Add explicit tests exercising each uncovered edge case, then re-verify.`,
    }));
  }

  // Rule 2: implementer-acknowledged known_gaps → MATERIAL test_gap
  const knownGaps = req.tests.known_gaps ?? [];
  if (knownGaps.length > 0) {
    findings.push(mkFinding({
      severity: "MATERIAL",
      category: "test_gap",
      message: `Implementer acknowledged ${knownGaps.length} known test gap(s): ${knownGaps.slice(0, 3).join("; ")}${knownGaps.length > 3 ? "…" : ""}`,
      rationale: "Known gaps mean the passing test suite explicitly does not establish correctness for those cases.",
      evidence_pointer: `review:${req.review_id}:tests.known_gaps`,
      affected_behavior: knownGaps.join(", "),
      recommended_correction: "Add tests covering each declared gap.",
    }));
  }

  // Rule 3: positive-only test suite → WARNING test_weakness
  const summary = (req.tests.summary ?? "").toLowerCase();
  if (req.tests.passed > 0 && POSITIVE_ONLY_HINTS.test(summary) && !NEGATIVE_COVERAGE_HINTS.test(summary)) {
    findings.push(mkFinding({
      severity: "WARNING",
      category: "test_weakness",
      message: "Tests appear to cover only positive/happy-path behaviors (no error/negative/boundary coverage mentioned).",
      rationale: "A test suite that never asserts negative behavior can pass while genuine defects remain in error handling, boundary conditions, or failure paths.",
      evidence_pointer: `review:${req.review_id}:tests.summary`,
      affected_behavior: "Error paths · boundary conditions · negative inputs",
      recommended_correction: "Add negative tests · boundary tests · error-path assertions.",
    }));
  }

  // Rule 4: no tests at all → INFO test_gap
  if (req.tests.passed === 0 && req.tests.failed === 0) {
    findings.push(mkFinding({
      severity: "INFO",
      category: "test_gap",
      message: "No tests present for this implementation.",
      rationale: "Absence of tests is not itself proof of incorrectness, but it removes one source of independent evidence for correctness.",
      evidence_pointer: `review:${req.review_id}:tests.passed=0`,
      affected_behavior: "All behaviors",
      recommended_correction: "Add tests covering the declared requirement and its edge cases.",
    }));
  }

  return findings;
}

/** Convenience count-by-severity for aggregate reasoning. */
export function tallyFindingsBySeverity(findings: Finding[]): Record<FindingSeverity, number> {
  const tally: Record<FindingSeverity, number> = { INFO: 0, WARNING: 0, MATERIAL: 0, CRITICAL: 0 };
  for (const f of findings) tally[f.severity] += 1;
  return tally;
}

/** Convenience count-by-category. */
export function tallyFindingsByCategory(findings: Finding[]): Partial<Record<FindingCategory, number>> {
  const tally: Partial<Record<FindingCategory, number>> = {};
  for (const f of findings) tally[f.category] = (tally[f.category] ?? 0) + 1;
  return tally;
}

// Local helper — internal only.
function mkFinding(input: Omit<Finding, "finding_id">): Finding {
  return { ...input, finding_id: nextFindingId("f") };
}
