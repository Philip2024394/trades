// src/lib/nex-agent/code-engine/capability-independent-verifier.test.ts
//
// Phase 5 tests · proves the founder-diagnosed collapse is structurally prevented

import { describe, it, expect } from "vitest";
import {
  verifyIndependently,
  fuseVerdict,
  analyseAgreement,
  INDEPENDENT_VERIFIER_VERSION,
  type VerifierInput,
  type TestOutputs,
} from "./capability-independent-verifier";

// ─── Test helpers ────────────────────────────────────────────────────────

function makeOutputs(exit_code: number, tests: readonly { test_id: string; passed: boolean }[]): TestOutputs {
  return {
    exit_code,
    test_results: tests.map((t) => ({
      test_id: t.test_id,
      test_file: "test.ts",
      passed: t.passed,
      assertion_error: t.passed ? null : "assertion failed",
    })),
    stdout_hash_prefix: "abc1234567890def",
  };
}

function baseInput(overrides: Partial<VerifierInput> = {}): VerifierInput {
  const defaults: VerifierInput = {
    spec_id: "spec_test",
    patch_diff: "some diff",
    patch_diff_lines_changed: 1,
    parent_sha: "parent_sha",
    patched_sha: "patched_sha",
    test_outputs_before: makeOutputs(1, [{ test_id: "T1", passed: false }, { test_id: "R1", passed: true }]),
    test_outputs_after: makeOutputs(0, [{ test_id: "T1", passed: true }, { test_id: "R1", passed: true }]),
    fail_to_pass_ids: ["T1"],
    pass_to_pass_ids: ["R1"],
    acceptance_predicates: ["fn(3) === 30"],
    correlation_id: "corr_test",
  };
  return { ...defaults, ...overrides };
}

describe("independent verifier · Phase 5", () => {
  describe("verdict TARGET_BEHAVIOUR_VERIFIED", () => {
    it("emits when FAIL_TO_PASS transitions FAIL→PASS and PASS_TO_PASS preserved", () => {
      const receipt = verifyIndependently(baseInput());
      expect(receipt.verdict).toBe("TARGET_BEHAVIOUR_VERIFIED");
      expect(receipt.fusion_predicate_fired).toBe("P3");
      expect(receipt.sub_verdicts.v1_f2p_p2p.f2p_all_transitioned).toBe(true);
      expect(receipt.sub_verdicts.v1_f2p_p2p.p2p_all_preserved).toBe(true);
    });
  });

  describe("founder-diagnosed NO-CHANGE collapse · structurally prevented", () => {
    it("does NOT emit TARGET_BEHAVIOUR_VERIFIED when parent already had F2P passing (no transition)", () => {
      // The exact founder-diagnosed pattern: fixture returns 40, spec asks for 30,
      // but a weak spec-derived test PASSES on both before and after (no change),
      // so coder-side would emit CODING_LOOP_RUNTIME_VERIFIED.
      // Verifier requires observed FAIL→PASS transition · this must not qualify.
      const receipt = verifyIndependently(baseInput({
        test_outputs_before: makeOutputs(0, [{ test_id: "T1", passed: true }, { test_id: "R1", passed: true }]),
        test_outputs_after: makeOutputs(0, [{ test_id: "T1", passed: true }, { test_id: "R1", passed: true }]),
      }));

      expect(receipt.verdict).not.toBe("TARGET_BEHAVIOUR_VERIFIED");
      expect(receipt.verdict).not.toBe("SEMANTICALLY_VERIFIED");
      // Since P2P preserved but F2P didn't transition (was already passing), verdict is REGRESSION_PRESERVED
      expect(receipt.verdict).toBe("REGRESSION_PRESERVED");
      expect(receipt.sub_verdicts.v1_f2p_p2p.f2p_all_transitioned).toBe(false);
    });

    it("agreement analysis flags coder-VERIFIED + verifier-REGRESSION_PRESERVED as SUSPICIOUS_NO_CHANGE_COLLAPSE", () => {
      const agreement = analyseAgreement("CODING_LOOP_RUNTIME_VERIFIED", "REGRESSION_PRESERVED");
      expect(agreement.agreement_status).toBe("SUSPICIOUS_NO_CHANGE_COLLAPSE");
      expect(agreement.diagnostic).toContain("NO-CHANGE");
    });
  });

  describe("verdict REGRESSION_PRESERVED", () => {
    it("emits when P2P preserved but F2P did not transition", () => {
      const receipt = verifyIndependently(baseInput({
        test_outputs_before: makeOutputs(0, [{ test_id: "T1", passed: true }, { test_id: "R1", passed: true }]),
        test_outputs_after: makeOutputs(0, [{ test_id: "T1", passed: true }, { test_id: "R1", passed: true }]),
      }));

      expect(receipt.verdict).toBe("REGRESSION_PRESERVED");
      expect(receipt.fusion_predicate_fired).toBe("P4");
    });
  });

  describe("verdict CODE_EXECUTED", () => {
    it("emits when P2P regressed and F2P didn't transition but code didn't crash", () => {
      const receipt = verifyIndependently(baseInput({
        test_outputs_after: makeOutputs(1, [{ test_id: "T1", passed: false }, { test_id: "R1", passed: false }]),
      }));

      // P2P regressed (R1 was PASS, now FAIL). Not TARGET_VERIFIED. Not REGRESSION_PRESERVED.
      // Code did not crash (exit_code 1, not > 1). So CODE_EXECUTED.
      expect(receipt.sub_verdicts.v1_f2p_p2p.p2p_all_preserved).toBe(false);
      expect(receipt.sub_verdicts.v1_f2p_p2p.p2p_regressed_ids).toContain("R1");
      expect(receipt.verdict).toBe("CODE_EXECUTED");
    });
  });

  describe("verdict VERIFICATION_INSUFFICIENT", () => {
    it("emits when no acceptance predicates provided", () => {
      const receipt = verifyIndependently(baseInput({
        acceptance_predicates: [],
      }));

      expect(receipt.verdict).toBe("VERIFICATION_INSUFFICIENT");
      expect(receipt.fusion_predicate_fired).toBe("P0");
    });

    it("emits when no fail_to_pass ids provided", () => {
      const receipt = verifyIndependently(baseInput({
        fail_to_pass_ids: [],
      }));

      expect(receipt.verdict).toBe("VERIFICATION_INSUFFICIENT");
    });
  });

  describe("deterministic reproducibility", () => {
    it("emits byte-identical receipt for identical input", () => {
      const input = baseInput();
      const a = verifyIndependently(input);
      const b = verifyIndependently(input);
      // input_digest identical
      expect(a.input_digest).toEqual(b.input_digest);
      // sub_verdicts identical
      expect(JSON.stringify(a.sub_verdicts)).toBe(JSON.stringify(b.sub_verdicts));
      // reproducibility seed identical
      expect(a.reproducibility.prng_seed).toBe(b.reproducibility.prng_seed);
      // verdict identical
      expect(a.verdict).toBe(b.verdict);
    });

    it("emits different prng_seed for different inputs", () => {
      const a = verifyIndependently(baseInput({ patch_diff: "diff-a" }));
      const b = verifyIndependently(baseInput({ patch_diff: "diff-b" }));
      expect(a.reproducibility.prng_seed).not.toBe(b.reproducibility.prng_seed);
    });
  });

  describe("verifier isolation invariants", () => {
    it("declares reasoning_trace_read=false structurally", () => {
      const receipt = verifyIndependently(baseInput());
      expect(receipt.verifier_process_isolation.reasoning_trace_read).toBe(false);
    });

    it("declares zero_llm=true", () => {
      const receipt = verifyIndependently(baseInput());
      expect(receipt.zero_llm).toBe(true);
    });

    it("emits ledger=B", () => {
      const receipt = verifyIndependently(baseInput());
      expect(receipt.ledger).toBe("B");
    });
  });

  describe("fusion algorithm ordering", () => {
    it("P0 (coverage) fires before P3 (target verified)", () => {
      const { verdict, fired } = fuseVerdict({
        v1_f2p_p2p: { f2p_count: 0, f2p_transitions: [], f2p_all_transitioned: true, p2p_count: 0, p2p_all_preserved: true, p2p_regressed_ids: [] },
        v1_execution: { patched_exit_code: 0, patched_crashed: false, executed_without_crash: true },
        v3_mutation: { enabled: false, mutants_generated: 0, mutants_survived: 0, survival_ratio: 0, threshold_tau_spec: 0.2, spec_appears_under_specified: false },
        v_coverage: { coverage_floor_met: false, coverage_reasons: ["insufficient_test_coverage"] },
      });
      expect(verdict).toBe("VERIFICATION_INSUFFICIENT");
      expect(fired).toBe("P0");
    });

    it("P1 (spec unresolved) fires before P3", () => {
      const { verdict } = fuseVerdict({
        v1_f2p_p2p: { f2p_count: 1, f2p_transitions: [{ id: "T1", parent: "FAIL", patched: "PASS" }], f2p_all_transitioned: true, p2p_count: 1, p2p_all_preserved: true, p2p_regressed_ids: [] },
        v1_execution: { patched_exit_code: 0, patched_crashed: false, executed_without_crash: true },
        v3_mutation: { enabled: true, mutants_generated: 20, mutants_survived: 10, survival_ratio: 0.5, threshold_tau_spec: 0.2, spec_appears_under_specified: true },
        v_coverage: { coverage_floor_met: true, coverage_reasons: [] },
      });
      expect(verdict).toBe("SPECIFICATION_UNRESOLVED");
    });
  });

  describe("agreement analysis · founder-diagnosed collapse signatures", () => {
    it("flags CODER_VERIFIED + VERIFIER_SPECIFICATION_UNRESOLVED as SUSPICIOUS_SPEC_TOO_WEAK", () => {
      const a = analyseAgreement("CODING_LOOP_RUNTIME_VERIFIED", "SPECIFICATION_UNRESOLVED");
      expect(a.agreement_status).toBe("SUSPICIOUS_SPEC_TOO_WEAK");
    });

    it("flags CODER_VERIFIED + VERIFIER_SEMANTIC_FAILED as CONTRADICTION", () => {
      const a = analyseAgreement("CODING_LOOP_RUNTIME_VERIFIED", "SEMANTIC_VERIFICATION_FAILED");
      expect(a.agreement_status).toBe("CONTRADICTION");
    });

    it("AGREE when both point to VERIFIED", () => {
      const a = analyseAgreement("CODING_LOOP_RUNTIME_VERIFIED", "TARGET_BEHAVIOUR_VERIFIED");
      expect(a.agreement_status).toBe("AGREE");
    });
  });

  describe("version stamp", () => {
    it("has canonical version constant", () => {
      expect(INDEPENDENT_VERIFIER_VERSION).toBe("independent-verifier.v1.2026-09-19");
    });
  });
});
