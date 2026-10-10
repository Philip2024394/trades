// src/lib/nex-agent/code-engine/capability-failure-classifier.test.ts
//
// Phase 6 tests · 9-way failure classifier + repair strategy mapping

import { describe, it, expect } from "vitest";
import {
  classifyFailure,
  suggestRepairStrategy,
  FAILURE_CLASSIFIER_VERSION,
  type FailureClassifierInput,
} from "./capability-failure-classifier";
import { verifyIndependently, type VerifierInput, type TestOutputs } from "./capability-independent-verifier";

function outs(exit: number, ts: { test_id: string; passed: boolean }[]): TestOutputs {
  return {
    exit_code: exit,
    test_results: ts.map((t) => ({
      test_id: t.test_id,
      test_file: "t.test.ts",
      passed: t.passed,
      assertion_error: t.passed ? null : "assertion failed",
    })),
    stdout_hash_prefix: "hash",
  };
}

function makeVerifierInput(over: Partial<VerifierInput> = {}): VerifierInput {
  return {
    spec_id: "s",
    patch_diff: "diff",
    patch_diff_lines_changed: 1,
    parent_sha: "p",
    patched_sha: "q",
    test_outputs_before: outs(1, [{ test_id: "T1", passed: false }, { test_id: "R1", passed: true }]),
    test_outputs_after: outs(0, [{ test_id: "T1", passed: true }, { test_id: "R1", passed: true }]),
    fail_to_pass_ids: ["T1"],
    pass_to_pass_ids: ["R1"],
    acceptance_predicates: ["fn()"],
    correlation_id: "c",
    ...over,
  };
}

describe("failure classifier · Phase 6", () => {
  describe("SYNTAX", () => {
    it("classifies syntax compile errors as SYNTAX", () => {
      const receipt = verifyIndependently(makeVerifierInput());
      const r = classifyFailure({
        verifier_receipt: receipt,
        coder_emissions: {
          compile_errors: [{ kind: "syntax", message: "Unexpected token" }],
        },
      });
      expect(r.failure_class).toBe("SYNTAX");
      expect(r.evidence_signals).toContain("compile_error:syntax");
    });
  });

  describe("TYPE", () => {
    it("classifies type errors as TYPE (when no syntax)", () => {
      const receipt = verifyIndependently(makeVerifierInput());
      const r = classifyFailure({
        verifier_receipt: receipt,
        coder_emissions: { compile_errors: [{ kind: "type", message: "TS2322" }] },
      });
      expect(r.failure_class).toBe("TYPE");
    });

    it("SYNTAX wins over TYPE when both present (ordering invariant)", () => {
      const receipt = verifyIndependently(makeVerifierInput());
      const r = classifyFailure({
        verifier_receipt: receipt,
        coder_emissions: {
          compile_errors: [
            { kind: "syntax", message: "x" },
            { kind: "type", message: "y" },
          ],
        },
      });
      expect(r.failure_class).toBe("SYNTAX");
    });
  });

  describe("TIMEOUT + RUNTIME_CRASH", () => {
    it("TIMEOUT beats CRASH when both fire", () => {
      const receipt = verifyIndependently(makeVerifierInput());
      const r = classifyFailure({
        verifier_receipt: receipt,
        coder_emissions: { timed_out: true, exit_code: 137 },
      });
      expect(r.failure_class).toBe("TIMEOUT");
    });

    it("RUNTIME_CRASH when exit_code > 1 and no timeout", () => {
      const receipt = verifyIndependently(makeVerifierInput());
      const r = classifyFailure({
        verifier_receipt: receipt,
        coder_emissions: { exit_code: 139 },
      });
      expect(r.failure_class).toBe("RUNTIME_CRASH");
    });
  });

  describe("P2P_REGRESSION", () => {
    it("classifies P2P regression when verifier reports it", () => {
      const receipt = verifyIndependently(
        makeVerifierInput({
          test_outputs_after: outs(1, [
            { test_id: "T1", passed: false },
            { test_id: "R1", passed: false },  // regressed
          ]),
        }),
      );
      const r = classifyFailure({ verifier_receipt: receipt });
      expect(r.failure_class).toBe("P2P_REGRESSION");
      expect(r.evidence_signals).toContain("verifier:p2p_regression");
    });
  });

  describe("NO_TRANSITION_OBSERVED", () => {
    it("classifies founder-diagnosed collapse", () => {
      // NO-CHANGE substrate: F2P was PASS before AND after
      const receipt = verifyIndependently(
        makeVerifierInput({
          test_outputs_before: outs(0, [{ test_id: "T1", passed: true }]),
          test_outputs_after: outs(0, [{ test_id: "T1", passed: true }]),
          pass_to_pass_ids: [],
        }),
      );
      const r = classifyFailure({ verifier_receipt: receipt });
      expect(r.failure_class).toBe("NO_TRANSITION_OBSERVED");
      expect(r.ambiguity_flags).toContain("could_be_no_change_collapse_or_incomplete_fix");
    });
  });

  describe("TARGET_ASSERTION", () => {
    it("classifies assertion error + no transition as TARGET_ASSERTION", () => {
      const receipt = verifyIndependently(
        makeVerifierInput({
          test_outputs_before: outs(1, [{ test_id: "T1", passed: false }]),
          test_outputs_after: outs(1, [{ test_id: "T1", passed: false }]),  // still failing
          pass_to_pass_ids: [],
        }),
      );
      const r = classifyFailure({
        verifier_receipt: receipt,
        coder_emissions: { assertion_errors: [{ test_id: "T1", message: "expected 30 got 40" }] },
      });
      expect(r.failure_class).toBe("TARGET_ASSERTION");
    });
  });

  describe("UNKNOWN", () => {
    it("emits UNKNOWN when no classifying signal fires", () => {
      // A REGRESSION_PRESERVED verdict (no F2P failure · no crash · no assertion)
      const receipt = verifyIndependently(
        makeVerifierInput({
          test_outputs_before: outs(0, [{ test_id: "T1", passed: true }, { test_id: "R1", passed: true }]),
          test_outputs_after: outs(0, [{ test_id: "T1", passed: true }, { test_id: "R1", passed: true }]),
        }),
      );
      // But no F2P transition either · so NO_TRANSITION_OBSERVED fires
      // Different case: no F2P defined at all
      const r = classifyFailure({
        verifier_receipt: verifyIndependently(
          makeVerifierInput({
            fail_to_pass_ids: [],
            test_outputs_before: outs(0, [{ test_id: "R1", passed: true }]),
            test_outputs_after: outs(0, [{ test_id: "R1", passed: true }]),
          }),
        ),
      });
      // verdict here is VERIFICATION_INSUFFICIENT (no F2P)
      expect(["UNKNOWN", "SPECIFICATION_UNRESOLVED"]).toContain(r.failure_class);
    });
  });

  describe("SPECIFICATION_UNRESOLVED", () => {
    it("propagates verifier SPECIFICATION_UNRESOLVED verdict", () => {
      // Cannot easily fabricate via verifier without enabling mutation V3.
      // Test the classifier logic directly by simulating that verdict.
      const receipt = verifyIndependently(makeVerifierInput());
      const spoofed = { ...receipt, verdict: "SPECIFICATION_UNRESOLVED" as const };
      const r = classifyFailure({ verifier_receipt: spoofed });
      expect(r.failure_class).toBe("SPECIFICATION_UNRESOLVED");
    });
  });

  describe("evidence signal capture", () => {
    it("captures multiple signals when present", () => {
      const receipt = verifyIndependently(
        makeVerifierInput({
          test_outputs_after: outs(1, [
            { test_id: "T1", passed: false },
            { test_id: "R1", passed: false },
          ]),
        }),
      );
      const r = classifyFailure({
        verifier_receipt: receipt,
        coder_emissions: {
          assertion_errors: [{ test_id: "T1", message: "x" }],
          exit_code: 1,
        },
      });
      expect(r.evidence_signals.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("determinism + isolation invariants", () => {
    it("produces identical classification for identical input", () => {
      const receipt = verifyIndependently(makeVerifierInput());
      const inp: FailureClassifierInput = {
        verifier_receipt: receipt,
        coder_emissions: { compile_errors: [{ kind: "type", message: "TS2322" }] },
      };
      const a = classifyFailure(inp);
      const b = classifyFailure(inp);
      expect(a.failure_class).toBe(b.failure_class);
      expect(a.evidence_signals).toEqual(b.evidence_signals);
      expect(a.input_digest).toBe(b.input_digest);
    });

    it("declares zero_llm=true · ledger=B · caller_must_decide=true", () => {
      const receipt = verifyIndependently(makeVerifierInput());
      const r = classifyFailure({ verifier_receipt: receipt });
      expect(r.zero_llm).toBe(true);
      expect(r.ledger).toBe("B");
      expect(r.caller_must_decide).toBe(true);
    });

    it("stamps version", () => {
      const receipt = verifyIndependently(makeVerifierInput());
      const r = classifyFailure({ verifier_receipt: receipt });
      expect(r.version).toBe(FAILURE_CLASSIFIER_VERSION);
    });
  });

  describe("repair strategy suggestion", () => {
    it("SYNTAX → FIX_SYNTAX_FIRST", () => {
      expect(suggestRepairStrategy("SYNTAX").primary).toBe("FIX_SYNTAX_FIRST");
    });
    it("TYPE → FIX_TYPES_FIRST", () => {
      expect(suggestRepairStrategy("TYPE").primary).toBe("FIX_TYPES_FIRST");
    });
    it("P2P_REGRESSION → PRESERVE_P2P_ROLLBACK", () => {
      expect(suggestRepairStrategy("P2P_REGRESSION").primary).toBe("PRESERVE_P2P_ROLLBACK");
    });
    it("NO_TRANSITION_OBSERVED → RECONSIDER_HYPOTHESIS", () => {
      expect(suggestRepairStrategy("NO_TRANSITION_OBSERVED").primary).toBe("RECONSIDER_HYPOTHESIS");
    });
    it("SPECIFICATION_UNRESOLVED → ESCALATE_TO_SPEC_CLARIFICATION", () => {
      expect(suggestRepairStrategy("SPECIFICATION_UNRESOLVED").primary).toBe("ESCALATE_TO_SPEC_CLARIFICATION");
    });
    it("UNKNOWN → NONE_APPLICABLE (honest boundary)", () => {
      expect(suggestRepairStrategy("UNKNOWN").primary).toBe("NONE_APPLICABLE");
    });
  });
});
