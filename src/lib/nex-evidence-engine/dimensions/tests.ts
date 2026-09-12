// src/lib/nex-evidence-engine/dimensions/tests.ts
//
// NEX1 · EVIDENCE ENGINE · E-03 · Tests measurement.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// v0: pattern-based tally. The Evidence Engine runs a MICRO test harness
// inside an isolated area: it evaluates each supplied `test_case` object
// deterministically and returns pass/fail counts. This avoids invoking
// full test runners like vitest at Evidence-Engine measurement time (heavy)
// while proving the contract. Real project test invocation is a P2+ item.

import type { EvidenceRecord, MeasurementInput, EvidenceState } from "../types";
import {
  attributionMeasurement,
  hashSourceFiles,
  nextEvidenceId,
  provenance,
  reproducibility,
} from "../utilities";

const SCHEMA_VERSION = "v0.1.0";
const METHOD = "micro-test-harness-v0";

interface MicroTestCase {
  readonly id: string;
  readonly kind: "equals" | "throws" | "regex_match";
  readonly input?: unknown;
  readonly expected?: unknown;
  readonly script?: string;   // pure-JS expression string · evaluated deterministically
  readonly regex?: string;
  readonly against?: string;
}

interface TestsInputBundle {
  readonly test_cases: readonly MicroTestCase[];
}

/**
 * @summary v0 · deterministic micro test harness. Test cases are DATA · not
 * arbitrary code. Evidence Engine evaluates a small deterministic vocabulary
 * of test-case kinds. This limits scope · but scope-limit is the point ·
 * measurement never executes arbitrary user code beyond the tiny deterministic
 * evaluator.
 */
export function measureTests(input: MeasurementInput, bundle?: TestsInputBundle | null): EvidenceRecord {
  if (!bundle || !Array.isArray(bundle.test_cases) || bundle.test_cases.length === 0) {
    return skeleton(input, "NOT_MEASURED",
      "no test_cases supplied to Evidence Engine · v0 requires an explicit micro-test bundle",
      null, null);
  }
  const total = bundle.test_cases.length;
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];
  for (const tc of bundle.test_cases) {
    let ok = false;
    let reason = "";
    try {
      if (tc.kind === "equals") {
        ok = JSON.stringify(tc.input) === JSON.stringify(tc.expected);
        reason = ok ? "equal" : `expected ${JSON.stringify(tc.expected)} got ${JSON.stringify(tc.input)}`;
      } else if (tc.kind === "throws") {
        // We do not eval user code · v0: cases must supply pre-computed evidence
        // e.g. { kind: "throws", input: true/false, expected: true } to indicate
        // whether the harness caller observed a throw. Absent that we mark FAILED.
        if (typeof tc.input === "boolean" && typeof tc.expected === "boolean") {
          ok = tc.input === tc.expected;
          reason = ok ? "throw observation matched expectation" : "throw observation mismatch";
        } else {
          ok = false;
          reason = "kind=throws requires boolean input + boolean expected in v0";
        }
      } else if (tc.kind === "regex_match") {
        if (typeof tc.regex === "string" && typeof tc.against === "string") {
          const re = new RegExp(tc.regex);
          ok = re.test(tc.against);
          reason = ok ? "regex matched" : "regex did not match";
        } else {
          ok = false;
          reason = "kind=regex_match requires regex + against strings";
        }
      } else {
        ok = false;
        reason = "unknown kind";
      }
    } catch (e) {
      ok = false;
      reason = "harness error · " + (e as Error).message;
    }
    if (ok) passed++;
    else { failed++; failures.push(`${tc.id}: ${reason}`); }
  }
  const state: EvidenceState = failed === 0 ? "PASSED" : "FAILED";
  const value = { total, passed, failed, first_failures: failures.slice(0, 5) };
  const command = "internal-micro-test-harness-v0";

  return {
    record_type: "EVIDENCE_RECORD",
    evidence_id: nextEvidenceId(),
    schema_version: SCHEMA_VERSION,
    project_id: input.project_id,
    work_order_id: input.work_order_id,
    candidate_id: input.candidate_id,
    evidence_type: "tests",
    state,
    measurement: { unit: "count", value, precision: "integer", method_id: METHOD },
    value,
    baseline_value: null,
    candidate_value: failed,
    delta: null,
    methodology: "deterministic micro test harness · v0 supports kind ∈ {equals, throws (boolean pair), regex_match} · does NOT execute arbitrary code",
    tool: "internal-micro-harness",
    tool_version: SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    source_files: input.source_files.map((s) => s.path),
    source_hashes: hashSourceFiles(input.source_files),
    reproducibility_information: reproducibility(command, process.cwd()),
    limitations: "v0 · deterministic micro harness · not a general test runner · does not invoke vitest/jest/etc · P2+ item",
    provenance: provenance(input.requested_by, "evidence-engine@" + SCHEMA_VERSION, [], [{ tool: "internal-micro-harness", tool_version: SCHEMA_VERSION }]),
    confidence: "medium",
    attribution: attributionMeasurement(),
  };
}

function skeleton(input: MeasurementInput, state: EvidenceState, limitations: string, value: any, candidate_value: number | null): EvidenceRecord {
  return {
    record_type: "EVIDENCE_RECORD",
    evidence_id: nextEvidenceId(),
    schema_version: SCHEMA_VERSION,
    project_id: input.project_id,
    work_order_id: input.work_order_id,
    candidate_id: input.candidate_id,
    evidence_type: "tests",
    state,
    measurement: value !== null ? { unit: "count", value, precision: "integer", method_id: METHOD } : null,
    value,
    baseline_value: null,
    candidate_value,
    delta: null,
    methodology: METHOD,
    tool: "internal-micro-harness",
    tool_version: SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    source_files: input.source_files.map((s) => s.path),
    source_hashes: hashSourceFiles(input.source_files),
    reproducibility_information: reproducibility("n/a", process.cwd()),
    limitations,
    provenance: provenance(input.requested_by, "evidence-engine@" + SCHEMA_VERSION, [], [{ tool: "internal-micro-harness", tool_version: SCHEMA_VERSION }]),
    confidence: state === "BLOCKED" ? "insufficient" : state === "NOT_APPLICABLE" ? "high" : "medium",
    attribution: attributionMeasurement(),
  };
}
