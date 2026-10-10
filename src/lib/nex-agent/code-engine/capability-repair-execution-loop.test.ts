import { describe, it, expect } from "vitest";
import { runRepairLoop, REPAIR_EXECUTION_LOOP_VERSION, type AttemptExecutor } from "./capability-repair-execution-loop";
import type { FailureClassification } from "./capability-failure-classifier";
import type { PrimaryNexHandoff, TwinNexAssessment } from "./capability-twin-nex";
import type { RefereeJudgement } from "./capability-referee";

function stubHandoff(over: Partial<PrimaryNexHandoff> = {}): PrimaryNexHandoff & { changed_symbols_hint?: string; expected_value_hint?: string } {
  return {
    original_specification: "return 30",
    primary_verdict: "TARGET_BEHAVIOUR_NOT_ACHIEVED",
    proposed_change_summary: "attempted",
    target_file: "src/foo.ts",
    target_test_id: "T",
    test_outputs_before: [{ test_id: "T", passed: false }],
    test_outputs_after: [{ test_id: "T", passed: false }],
    regression_test_ids: [],
    patch_diff_lines_changed: 1,
    failure_class_from_primary: null,
    changed_symbols_hint: "foo",
    expected_value_hint: "30",
    ...over,
  };
}

function stubFailure(cls: FailureClassification["failure_class"] = "TARGET_ASSERTION"): FailureClassification {
  return {
    failure_class: cls,
    evidence_signals: [],
    rationale: "stub",
    caller_must_decide: true,
    verifier_verdict: "TARGET_BEHAVIOUR_NOT_ACHIEVED" as never,
    ambiguity_flags: [],
    input_digest: "stub",
    classified_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
    version: "test",
  };
}

function stubTwin(): TwinNexAssessment {
  return {
    independent_verdict: "INDEPENDENT_TARGET_NOT_ACHIEVED",
    agreement_with_primary: "AGREES_WITH_PRIMARY",
    challenge_reasons: [],
    repair_proposal: { kind: "reconsider_hypothesis", rationale: "target not achieved" },
    evidence_signals: [],
    caller_must_decide: true,
    input_digest: "stub",
    assessed_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
    version: "test",
  };
}

function stubReferee(verdict: RefereeJudgement["verdict"] = "FAILED"): RefereeJudgement {
  return {
    verdict,
    rationale: "stub",
    evidence_citations: [],
    missing_evidence: [],
    primary_verdict: "TARGET_BEHAVIOUR_NOT_ACHIEVED",
    twin_verdict: "INDEPENDENT_TARGET_NOT_ACHIEVED",
    caller_must_decide: true,
    input_digest: "stub",
    assessed_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
    version: "test",
  };
}

function fakeExecutor(seq: readonly Awaited<ReturnType<AttemptExecutor["applyAndTest"]>>[]): AttemptExecutor {
  let i = 0;
  return {
    applyAndTest: async () => seq[Math.min(i++, seq.length - 1)],
  };
}

describe("repair execution loop · Phase 7 closed loop", () => {
  describe("early exits", () => {
    it("did_not_start when no target_file supplied", async () => {
      const receipt = await runRepairLoop({
        primary_handoff: stubHandoff({ target_file: null }),
        failure_classification: stubFailure(),
        twin_assessment: stubTwin(),
        referee_judgement: stubReferee(),
        executor: fakeExecutor([]),
      });
      expect(receipt.outcome).toBe("did_not_start");
    });

    it("specification_unresolved when Referee reports spec unresolved", async () => {
      const receipt = await runRepairLoop({
        primary_handoff: stubHandoff(),
        failure_classification: stubFailure(),
        twin_assessment: stubTwin(),
        referee_judgement: stubReferee("SPECIFICATION_UNRESOLVED"),
        executor: fakeExecutor([]),
      });
      expect(receipt.outcome).toBe("specification_unresolved");
    });

    it("insufficient_evidence when Referee reports insufficient", async () => {
      const receipt = await runRepairLoop({
        primary_handoff: stubHandoff(),
        failure_classification: stubFailure(),
        twin_assessment: stubTwin(),
        referee_judgement: stubReferee("INSUFFICIENT_EVIDENCE"),
        executor: fakeExecutor([]),
      });
      expect(receipt.outcome).toBe("insufficient_evidence");
    });

    it("conflicting_evidence when Referee reports conflict", async () => {
      const receipt = await runRepairLoop({
        primary_handoff: stubHandoff(),
        failure_classification: stubFailure(),
        twin_assessment: stubTwin(),
        referee_judgement: stubReferee("CONFLICTING_EVIDENCE"),
        executor: fakeExecutor([]),
      });
      expect(receipt.outcome).toBe("conflicting_evidence");
    });
  });

  describe("closed loop · repair succeeds", () => {
    it("repair_verified on first attempt when operator succeeds and target passes", async () => {
      const receipt = await runRepairLoop({
        primary_handoff: stubHandoff(),
        failure_classification: stubFailure(),
        twin_assessment: stubTwin(),
        referee_judgement: stubReferee(),
        executor: fakeExecutor([
          { operator_ok: true, target_test_after: true, regression_ids_after: [], operator_refusal_reason: null },
        ]),
      });
      expect(receipt.outcome).toBe("repair_verified");
      expect(receipt.succeeded_on_attempt).toBe(1);
      expect(receipt.attempts.length).toBe(1);
      expect(receipt.attempts[0].outcome).toBe("target_verified_after_repair");
    });

    it("repair_verified on second attempt when first fails but second succeeds", async () => {
      const receipt = await runRepairLoop({
        primary_handoff: stubHandoff(),
        failure_classification: stubFailure(),
        twin_assessment: stubTwin(),
        referee_judgement: stubReferee(),
        executor: fakeExecutor([
          { operator_ok: true, target_test_after: false, regression_ids_after: [], operator_refusal_reason: null },
          { operator_ok: true, target_test_after: true, regression_ids_after: [], operator_refusal_reason: null },
        ]),
      });
      expect(receipt.outcome).toBe("repair_verified");
      expect(receipt.succeeded_on_attempt).toBe(2);
      expect(receipt.attempts.length).toBe(2);
    });
  });

  describe("closed loop · repair fails · recovery exhausted", () => {
    it("recovery_exhausted after 3 failed attempts by default", async () => {
      const receipt = await runRepairLoop({
        primary_handoff: stubHandoff(),
        failure_classification: stubFailure(),
        twin_assessment: stubTwin(),
        referee_judgement: stubReferee(),
        executor: fakeExecutor([
          { operator_ok: true, target_test_after: false, regression_ids_after: [], operator_refusal_reason: null },
          { operator_ok: true, target_test_after: false, regression_ids_after: [], operator_refusal_reason: null },
          { operator_ok: true, target_test_after: false, regression_ids_after: [], operator_refusal_reason: null },
        ]),
      });
      expect(receipt.outcome).toBe("recovery_exhausted");
      expect(receipt.attempts.length).toBe(3);
      expect(receipt.succeeded_on_attempt).toBeNull();
      expect(receipt.user_work_preserved).toBe(true);
    });

    it("recovery_exhausted for failure classes with no available repair hypothesis (SYNTAX/TYPE)", async () => {
      const receipt = await runRepairLoop({
        primary_handoff: stubHandoff(),
        failure_classification: stubFailure("SYNTAX"),
        twin_assessment: stubTwin(),
        referee_judgement: stubReferee(),
        executor: fakeExecutor([]),
      });
      expect(receipt.outcome).toBe("recovery_exhausted");
      expect(receipt.attempts.length).toBe(0);  // no attempts because no hypothesis available
    });

    it("respects max_attempts override", async () => {
      const receipt = await runRepairLoop({
        primary_handoff: stubHandoff(),
        failure_classification: stubFailure(),
        twin_assessment: stubTwin(),
        referee_judgement: stubReferee(),
        executor: fakeExecutor([
          { operator_ok: true, target_test_after: false, regression_ids_after: [], operator_refusal_reason: null },
          { operator_ok: true, target_test_after: false, regression_ids_after: [], operator_refusal_reason: null },
        ]),
        max_attempts: 2,
      });
      expect(receipt.attempts.length).toBe(2);
      expect(receipt.outcome).toBe("recovery_exhausted");
    });
  });

  describe("regression detection during repair", () => {
    it("marks attempt as regression_introduced when regression_ids_after is non-empty", async () => {
      const receipt = await runRepairLoop({
        primary_handoff: stubHandoff(),
        failure_classification: stubFailure(),
        twin_assessment: stubTwin(),
        referee_judgement: stubReferee(),
        executor: fakeExecutor([
          { operator_ok: true, target_test_after: true, regression_ids_after: ["R1"], operator_refusal_reason: null },
        ]),
      });
      // Target passed but regression introduced · not a valid repair
      expect(receipt.attempts[0].outcome).toBe("regression_introduced");
      expect(receipt.outcome).toBe("recovery_exhausted");
    });
  });

  describe("operator refusal", () => {
    it("marks attempt operator_refused when operator returns operator_ok=false", async () => {
      const receipt = await runRepairLoop({
        primary_handoff: stubHandoff(),
        failure_classification: stubFailure(),
        twin_assessment: stubTwin(),
        referee_judgement: stubReferee(),
        executor: fakeExecutor([
          { operator_ok: false, target_test_after: null, regression_ids_after: [], operator_refusal_reason: "target_not_found" },
        ]),
        max_attempts: 1,
      });
      expect(receipt.attempts[0].outcome).toBe("operator_refused");
    });
  });

  describe("anti-fabrication · repair_verified requires observed target-test transition", () => {
    it("does NOT mark repair_verified when target_test_after is null (unknown)", async () => {
      const receipt = await runRepairLoop({
        primary_handoff: stubHandoff(),
        failure_classification: stubFailure(),
        twin_assessment: stubTwin(),
        referee_judgement: stubReferee(),
        executor: fakeExecutor([
          { operator_ok: true, target_test_after: null, regression_ids_after: [], operator_refusal_reason: null },
        ]),
        max_attempts: 1,
      });
      expect(receipt.outcome).not.toBe("repair_verified");
      expect(receipt.attempts[0].outcome).toBe("operator_applied");
    });
  });

  describe("invariants", () => {
    it("declares zero_llm=true, ledger=B, caller_must_decide=true", async () => {
      const receipt = await runRepairLoop({
        primary_handoff: stubHandoff(),
        failure_classification: stubFailure(),
        twin_assessment: stubTwin(),
        referee_judgement: stubReferee(),
        executor: fakeExecutor([
          { operator_ok: true, target_test_after: true, regression_ids_after: [], operator_refusal_reason: null },
        ]),
      });
      expect(receipt.zero_llm).toBe(true);
      expect(receipt.ledger).toBe("B");
      expect(receipt.caller_must_decide).toBe(true);
    });

    it("user_work_preserved is always true (loop does not touch user workspace directly)", async () => {
      const receipt = await runRepairLoop({
        primary_handoff: stubHandoff(),
        failure_classification: stubFailure(),
        twin_assessment: stubTwin(),
        referee_judgement: stubReferee(),
        executor: fakeExecutor([
          { operator_ok: true, target_test_after: false, regression_ids_after: [], operator_refusal_reason: null },
          { operator_ok: true, target_test_after: false, regression_ids_after: [], operator_refusal_reason: null },
          { operator_ok: true, target_test_after: false, regression_ids_after: [], operator_refusal_reason: null },
        ]),
      });
      expect(receipt.user_work_preserved).toBe(true);
    });

    it("canonical version", () => {
      expect(REPAIR_EXECUTION_LOOP_VERSION).toBe("repair-execution-loop.v1.2026-09-19");
    });
  });
});
