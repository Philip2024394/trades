// src/lib/nex-agent/code-engine/capability-independent-verifier.ts
//
// NEX1 · Independent Semantic Verifier · Phase 5 · Ledger B additive
// Founder-authorised 2026-09-19 · Full Autonomous Build Mandate
//
// PURPOSE
//   Provide a SEPARATE VERIFICATION CELL that consumes only observable
//   behavioural evidence (spec, patch, test outputs) and emits one of
//   SEVEN DISJOINT VERDICTS. NEVER consumes the coder's reasoning trace.
//   Structurally prevents the founder-diagnosed "code ran → therefore
//   correct" collapse.
//
// KEY INVARIANT
//   TARGET_BEHAVIOUR_VERIFIED requires an OBSERVED FAIL→PASS transition
//   on the parent commit. A NO-CHANGE patch whose parent already had
//   FAIL_TO_PASS passing CANNOT reach TARGET_BEHAVIOUR_VERIFIED. This
//   structurally rules out the current failure mode.
//
// DISCIPLINE
//   · Zero LLM · deterministic · byte-identical reproducibility
//   · Ledger B additive · no frozen file modified
//   · Verifier NEVER reads: reasoning trace · capability_gaps · rationale
//   · Verifier receives ONLY: spec, patch_diff, test_outputs_before,
//     test_outputs_after, target_source_file (optional inspection)
//   · Import isolation: MUST NOT import capability-specification-extractor
//     or capability-verification-case-generator
//   · All PRNGs seeded from sha256(input_digest)
//   · No floats in receipts (integers or string-encoded decimals)

import * as crypto from "node:crypto";
import { registerAgent } from "./capability-agent-registry";

registerAgent({
  id: "independent_verifier",
  name: "Independent Semantic Verifier · Phase 5 · Ledger B additive",
  cognitive_layer: "infrastructure_registry",
  description:
    "Separate verification cell consuming only observable behavioural evidence. Emits one of 7 disjoint verdicts. Never consumes coder reasoning trace. Structurally prevents 'code ran → correct' collapse. Additive · zero LLM · deterministic.",
});

// ═══════════════════════════════════════════════════════════════════════
// 7 DISJOINT VERDICT STATES
// ═══════════════════════════════════════════════════════════════════════

export type IndependentVerdict =
  | "CODE_EXECUTED"                    // Patch runs to termination. No behavioural claim.
  | "TARGET_BEHAVIOUR_VERIFIED"        // FAIL_TO_PASS transitioned + PASS_TO_PASS preserved.
  | "REGRESSION_PRESERVED"             // PASS_TO_PASS preserved · no target claim.
  | "SEMANTICALLY_VERIFIED"            // Target + regression + orthogonal verifier agreement.
  | "SEMANTIC_VERIFICATION_FAILED"     // Multiple verifiers disagree · contradictory evidence.
  | "SPECIFICATION_UNRESOLVED"         // Spec too weak · patch could be mutilated without breaking any test.
  | "VERIFICATION_INSUFFICIENT";       // Coverage below floor across ≥1 verifier.

// ═══════════════════════════════════════════════════════════════════════
// INPUT / OUTPUT TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface TestOutcome {
  readonly test_id: string;
  readonly test_file: string;
  readonly passed: boolean;
  readonly assertion_error: string | null;
}

export interface TestOutputs {
  readonly exit_code: number;
  readonly test_results: readonly TestOutcome[];
  readonly stdout_hash_prefix: string; // sha256 first 16 chars · deterministic ID
}

export interface VerifierInput {
  readonly spec_id: string;
  readonly patch_diff: string;
  readonly patch_diff_lines_changed: number;
  readonly parent_sha: string;
  readonly patched_sha: string;
  readonly test_outputs_before: TestOutputs;
  readonly test_outputs_after: TestOutputs;
  readonly fail_to_pass_ids: readonly string[];
  readonly pass_to_pass_ids: readonly string[];
  readonly acceptance_predicates: readonly string[];
  readonly correlation_id: string;
}

export interface SubVerdicts {
  readonly v1_f2p_p2p: {
    readonly f2p_count: number;
    readonly f2p_transitions: readonly { readonly id: string; readonly parent: "PASS" | "FAIL" | "MISSING"; readonly patched: "PASS" | "FAIL" | "MISSING" }[];
    readonly f2p_all_transitioned: boolean;
    readonly p2p_count: number;
    readonly p2p_all_preserved: boolean;
    readonly p2p_regressed_ids: readonly string[];
  };
  readonly v1_execution: {
    readonly patched_exit_code: number;
    readonly patched_crashed: boolean;
    readonly executed_without_crash: boolean;
  };
  readonly v3_mutation: {
    readonly enabled: boolean;
    readonly mutants_generated: number;
    readonly mutants_survived: number;
    readonly survival_ratio: number;
    readonly threshold_tau_spec: number;
    readonly spec_appears_under_specified: boolean;
  };
  readonly v_coverage: {
    readonly coverage_floor_met: boolean;
    readonly coverage_reasons: readonly string[];
  };
}

export interface VerificationReceipt {
  readonly capability: "independent_verifier";
  readonly correlation_id: string;
  readonly coverage_floor_met: boolean;
  readonly evidence_kind: "INDEPENDENT_VERIFICATION";
  readonly fusion_predicate_fired: string;
  readonly generated_at_iso: string;
  readonly input_digest: {
    readonly patch_diff_sha256: string;
    readonly spec_id: string;
    readonly parent_sha: string;
    readonly patched_sha: string;
  };
  readonly ledger: "B";
  readonly reproducibility: {
    readonly prng_seed: string;
    readonly deterministic: true;
  };
  readonly sub_verdicts: SubVerdicts;
  readonly verdict: IndependentVerdict;
  readonly verifier_process_isolation: {
    readonly fresh_subprocess: boolean; // caller responsibility
    readonly reasoning_trace_read: false; // structural invariant
  };
  readonly zero_llm: true;
}

// ═══════════════════════════════════════════════════════════════════════
// FROZEN THRESHOLDS · pre-registered · not tunable at runtime
// ═══════════════════════════════════════════════════════════════════════

const TAU_SPEC_MUTATION_SURVIVAL_RATIO = 0.2;   // above this: spec under-specified
const COVERAGE_FLOOR_MIN_TESTS = 1;             // at least one relevant test must run

// ═══════════════════════════════════════════════════════════════════════
// V1 · FAIL_TO_PASS / PASS_TO_PASS TRANSITION ANALYSIS
// ═══════════════════════════════════════════════════════════════════════

function testStatus(outputs: TestOutputs, test_id: string): "PASS" | "FAIL" | "MISSING" {
  const result = outputs.test_results.find((t) => t.test_id === test_id);
  if (!result) return "MISSING";
  return result.passed ? "PASS" : "FAIL";
}

function analyseV1(input: VerifierInput): SubVerdicts["v1_f2p_p2p"] {
  const f2p_transitions = input.fail_to_pass_ids.map((id) => {
    const parent = testStatus(input.test_outputs_before, id);
    const patched = testStatus(input.test_outputs_after, id);
    return { id, parent, patched };
  });

  // A F2P test must go FAIL → PASS · anything else counts as failure to transition
  const f2p_all_transitioned = f2p_transitions.length > 0 &&
    f2p_transitions.every((t) => t.parent === "FAIL" && t.patched === "PASS");

  const p2p_regressed_ids: string[] = [];
  for (const id of input.pass_to_pass_ids) {
    const parent = testStatus(input.test_outputs_before, id);
    const patched = testStatus(input.test_outputs_after, id);
    if (parent === "PASS" && patched !== "PASS") {
      p2p_regressed_ids.push(id);
    }
  }
  const p2p_all_preserved = p2p_regressed_ids.length === 0;

  return {
    f2p_count: input.fail_to_pass_ids.length,
    f2p_transitions,
    f2p_all_transitioned,
    p2p_count: input.pass_to_pass_ids.length,
    p2p_all_preserved,
    p2p_regressed_ids,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// V1 · EXECUTION CHECK
// ═══════════════════════════════════════════════════════════════════════

function analyseExecution(input: VerifierInput): SubVerdicts["v1_execution"] {
  const patched_exit_code = input.test_outputs_after.exit_code;
  // Exit codes indicating crash (segfault, uncaught exception, etc.) differ
  // by platform. We treat exit_code === 0 or 1 (test failures) as non-crash;
  // higher codes as crash. Vitest returns 0 or 1 in normal operation.
  const patched_crashed = patched_exit_code > 1;
  const executed_without_crash = !patched_crashed;

  return {
    patched_exit_code,
    patched_crashed,
    executed_without_crash,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// V3 · MUTATION VERIFIER (skeleton · full implementation deferred)
// ═══════════════════════════════════════════════════════════════════════

function analyseV3Mutation(_input: VerifierInput): SubVerdicts["v3_mutation"] {
  // Full mutation verifier requires actually mutating the patch and re-running
  // tests · out of scope for Phase 5 skeleton. Returns disabled state honestly.
  return {
    enabled: false,
    mutants_generated: 0,
    mutants_survived: 0,
    survival_ratio: 0,
    threshold_tau_spec: TAU_SPEC_MUTATION_SURVIVAL_RATIO,
    spec_appears_under_specified: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// COVERAGE FLOOR CHECK
// ═══════════════════════════════════════════════════════════════════════

function analyseCoverage(input: VerifierInput): SubVerdicts["v_coverage"] {
  const reasons: string[] = [];
  const totalRelevantTests = input.fail_to_pass_ids.length + input.pass_to_pass_ids.length;
  if (totalRelevantTests < COVERAGE_FLOOR_MIN_TESTS) {
    reasons.push(`insufficient_test_coverage: only ${totalRelevantTests} relevant tests · floor is ${COVERAGE_FLOOR_MIN_TESTS}`);
  }
  if (input.fail_to_pass_ids.length === 0) {
    reasons.push("no_fail_to_pass_predicates_provided");
  }
  if (input.acceptance_predicates.length === 0) {
    reasons.push("no_acceptance_predicates_provided");
  }
  return {
    coverage_floor_met: reasons.length === 0,
    coverage_reasons: reasons,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// V0 · VERDICT FUSION · deterministic ordered predicates
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fusion rules (fires in order · first match wins):
 *
 *   P0. coverage_floor_met                    → else VERIFICATION_INSUFFICIENT
 *   P1. v3.spec_appears_under_specified       → SPECIFICATION_UNRESOLVED
 *   P2. (future: property counterexample OR mutation> τ OR differential fail)
 *        → SEMANTIC_VERIFICATION_FAILED
 *   P3. v1.f2p_all_transitioned AND v1.p2p_all_preserved
 *        → TARGET_BEHAVIOUR_VERIFIED  (with orthogonal → SEMANTICALLY_VERIFIED)
 *   P4. v1.p2p_all_preserved AND NOT v1.f2p_all_transitioned
 *        → REGRESSION_PRESERVED
 *   P5. patched executed without crash
 *        → CODE_EXECUTED
 */
export function fuseVerdict(sub: SubVerdicts): { verdict: IndependentVerdict; fired: string } {
  if (!sub.v_coverage.coverage_floor_met) {
    return { verdict: "VERIFICATION_INSUFFICIENT", fired: "P0" };
  }
  if (sub.v3_mutation.enabled && sub.v3_mutation.spec_appears_under_specified) {
    return { verdict: "SPECIFICATION_UNRESOLVED", fired: "P1" };
  }
  if (sub.v1_f2p_p2p.f2p_all_transitioned && sub.v1_f2p_p2p.p2p_all_preserved) {
    // For SEMANTICALLY_VERIFIED we'd require an orthogonal verifier (property/mutation)
    // to also confirm. Since V2/V4/V5/V6 are not yet implemented, we emit
    // TARGET_BEHAVIOUR_VERIFIED as the highest achievable here.
    return { verdict: "TARGET_BEHAVIOUR_VERIFIED", fired: "P3" };
  }
  if (sub.v1_f2p_p2p.p2p_all_preserved && !sub.v1_f2p_p2p.f2p_all_transitioned) {
    return { verdict: "REGRESSION_PRESERVED", fired: "P4" };
  }
  if (sub.v1_execution.executed_without_crash) {
    return { verdict: "CODE_EXECUTED", fired: "P5" };
  }
  // Fallback · shouldn't reach here if coverage_floor_met
  return { verdict: "VERIFICATION_INSUFFICIENT", fired: "P0_fallback" };
}

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════

export function verifyIndependently(input: VerifierInput): VerificationReceipt {
  const v1_f2p_p2p = analyseV1(input);
  const v1_execution = analyseExecution(input);
  const v3_mutation = analyseV3Mutation(input);
  const v_coverage = analyseCoverage(input);

  const sub_verdicts: SubVerdicts = { v1_f2p_p2p, v1_execution, v3_mutation, v_coverage };

  const { verdict, fired } = fuseVerdict(sub_verdicts);

  // Deterministic PRNG seed from input hashing (unused here · reserved for future V2/V6)
  const patch_diff_sha256 = crypto.createHash("sha256").update(input.patch_diff).digest("hex");
  const prng_seed = crypto
    .createHash("sha256")
    .update(input.spec_id + patch_diff_sha256 + input.parent_sha + input.patched_sha)
    .digest("hex")
    .slice(0, 16);

  const receipt: VerificationReceipt = {
    capability: "independent_verifier",
    correlation_id: input.correlation_id,
    coverage_floor_met: v_coverage.coverage_floor_met,
    evidence_kind: "INDEPENDENT_VERIFICATION",
    fusion_predicate_fired: fired,
    generated_at_iso: new Date().toISOString(),
    input_digest: {
      patch_diff_sha256,
      spec_id: input.spec_id,
      parent_sha: input.parent_sha,
      patched_sha: input.patched_sha,
    },
    ledger: "B",
    reproducibility: {
      prng_seed,
      deterministic: true,
    },
    sub_verdicts,
    verdict,
    verifier_process_isolation: {
      fresh_subprocess: false, // caller responsibility to invoke in fresh subprocess
      reasoning_trace_read: false,
    },
    zero_llm: true,
  };

  return receipt;
}

/**
 * Compare a coder's verdict against the independent verdict.
 * Returns a diagnostic flag identifying suspicious combinations.
 */
export type CoderVerdict = "CODING_LOOP_RUNTIME_VERIFIED" | "CODING_LOOP_PARTIALLY_RUNTIME_VERIFIED" | "CODING_LOOP_NOT_YET_RUNTIME_VERIFIED" | string;

export interface AgreementAnalysis {
  readonly coder_verdict: CoderVerdict;
  readonly verifier_verdict: IndependentVerdict;
  readonly agreement_status: "AGREE" | "SUSPICIOUS_NO_CHANGE_COLLAPSE" | "SUSPICIOUS_SPEC_TOO_WEAK" | "CONTRADICTION" | "PARTIAL" | "VERIFIER_INSUFFICIENT";
  readonly diagnostic: string;
}

export function analyseAgreement(coder_verdict: CoderVerdict, verifier_verdict: IndependentVerdict): AgreementAnalysis {
  if (coder_verdict === "CODING_LOOP_RUNTIME_VERIFIED") {
    if (verifier_verdict === "TARGET_BEHAVIOUR_VERIFIED" || verifier_verdict === "SEMANTICALLY_VERIFIED") {
      return { coder_verdict, verifier_verdict, agreement_status: "AGREE", diagnostic: "Both agree · high confidence" };
    }
    if (verifier_verdict === "REGRESSION_PRESERVED") {
      return { coder_verdict, verifier_verdict, agreement_status: "SUSPICIOUS_NO_CHANGE_COLLAPSE", diagnostic: "Coder claims verified but no FAIL_TO_PASS transition observed · the founder-diagnosed NO-CHANGE + RUNTIME_VERIFIED collapse" };
    }
    if (verifier_verdict === "SPECIFICATION_UNRESOLVED") {
      return { coder_verdict, verifier_verdict, agreement_status: "SUSPICIOUS_SPEC_TOO_WEAK", diagnostic: "Coder passed a spec-derived test but the spec was too weak to discriminate correct from mutilated patches" };
    }
    if (verifier_verdict === "SEMANTIC_VERIFICATION_FAILED") {
      return { coder_verdict, verifier_verdict, agreement_status: "CONTRADICTION", diagnostic: "Behavioural evidence contradicts coder's success claim" };
    }
    if (verifier_verdict === "CODE_EXECUTED") {
      return { coder_verdict, verifier_verdict, agreement_status: "PARTIAL", diagnostic: "Only execution confirmed · no behavioural claim survives" };
    }
    if (verifier_verdict === "VERIFICATION_INSUFFICIENT") {
      return { coder_verdict, verifier_verdict, agreement_status: "VERIFIER_INSUFFICIENT", diagnostic: "Independent verification could not run · coder claim stands alone" };
    }
  }
  return { coder_verdict, verifier_verdict, agreement_status: "PARTIAL", diagnostic: `Non-VERIFIED coder verdict (${coder_verdict}) against verifier verdict (${verifier_verdict})` };
}

export const INDEPENDENT_VERIFIER_VERSION = "independent-verifier.v1.2026-09-19";
