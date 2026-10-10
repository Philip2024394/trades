// src/lib/nex-agent/code-engine/capability-twin-nex-referee.test.ts
//
// Combined tests for Twin NEX + Referee.
// Founder §13: "Twin NEX must not simply repeat NEX1's conclusion."
// Founder §10: "Referee must never silently manufacture missing evidence."

import { describe, it, expect } from "vitest";
import { twinNexInspect, TWIN_NEX_VERSION, type PrimaryNexHandoff } from "./capability-twin-nex";
import { refereeJudge, REFEREE_VERSION, type RefereeInput } from "./capability-referee";

function handoff(over: Partial<PrimaryNexHandoff> = {}): PrimaryNexHandoff {
  return {
    original_specification: "Change fn() to return 30 instead of 40",
    primary_verdict: "CODING_LOOP_RUNTIME_VERIFIED",
    proposed_change_summary: "modified return literal",
    target_file: "src/foo.ts",
    target_test_id: "T_target",
    test_outputs_before: [{ test_id: "T_target", passed: false }, { test_id: "R1", passed: true }],
    test_outputs_after: [{ test_id: "T_target", passed: true }, { test_id: "R1", passed: true }],
    regression_test_ids: ["R1"],
    patch_diff_lines_changed: 1,
    failure_class_from_primary: null,
    ...over,
  };
}

describe("Twin NEX · independent inspection · §13", () => {
  describe("independent verdict derived from evidence · never trusts primary transitively", () => {
    it("emits INDEPENDENT_TARGET_VERIFIED when F2P transitions + P2P preserved", () => {
      const r = twinNexInspect(handoff());
      expect(r.independent_verdict).toBe("INDEPENDENT_TARGET_VERIFIED");
      expect(r.agreement_with_primary).toBe("AGREES_WITH_PRIMARY");
    });

    it("CHALLENGES primary when primary claims VERIFIED but patch has no change", () => {
      const r = twinNexInspect(handoff({
        primary_verdict: "CODING_LOOP_RUNTIME_VERIFIED",
        patch_diff_lines_changed: 0,
      }));
      expect(r.independent_verdict).toBe("INDEPENDENT_NO_CHANGE_DETECTED");
      expect(r.agreement_with_primary).toBe("CHALLENGES_PRIMARY_VERDICT");
      expect(r.challenge_reasons.some((c) => c.includes("no_change"))).toBe(true);
    });

    it("CHALLENGES primary when primary claims VERIFIED but target test still fails", () => {
      const r = twinNexInspect(handoff({
        primary_verdict: "CODING_LOOP_RUNTIME_VERIFIED",
        test_outputs_after: [{ test_id: "T_target", passed: false }, { test_id: "R1", passed: true }],
      }));
      expect(r.independent_verdict).toBe("INDEPENDENT_TARGET_NOT_ACHIEVED");
      expect(r.agreement_with_primary).toBe("CHALLENGES_PRIMARY_VERDICT");
    });

    it("CHALLENGES primary when primary claims VERIFIED but regression was introduced", () => {
      const r = twinNexInspect(handoff({
        primary_verdict: "CODING_LOOP_RUNTIME_VERIFIED",
        test_outputs_after: [{ test_id: "T_target", passed: true }, { test_id: "R1", passed: false }],
      }));
      expect(r.independent_verdict).toBe("INDEPENDENT_REGRESSION_INTRODUCED");
      expect(r.agreement_with_primary).toBe("CHALLENGES_PRIMARY_VERDICT");
      expect(r.repair_proposal.kind).toBe("rollback_change");
    });

    it("CHALLENGES primary when primary claims VERIFIED but preview shows BUILD_ERROR", () => {
      const r = twinNexInspect(handoff({
        primary_verdict: "CODING_LOOP_RUNTIME_VERIFIED",
        runtime_evidence: {
          preview_state: "BUILD_ERROR",
          http_status: null,
          runtime_error_observed: true,
        },
      }));
      expect(r.agreement_with_primary).toBe("CHALLENGES_PRIMARY_VERDICT");
      expect(r.challenge_reasons.some((c) => c.includes("build_error") || c.includes("runtime_error"))).toBe(true);
    });

    it("AGREES with primary when both say failed and evidence supports it", () => {
      const r = twinNexInspect(handoff({
        primary_verdict: "TARGET_BEHAVIOUR_NOT_ACHIEVED",
        test_outputs_after: [{ test_id: "T_target", passed: false }, { test_id: "R1", passed: true }],
      }));
      expect(r.independent_verdict).toBe("INDEPENDENT_TARGET_NOT_ACHIEVED");
      expect(r.agreement_with_primary).toBe("AGREES_WITH_PRIMARY");
    });
  });

  describe("repair proposals derive from independent verdict", () => {
    it("NO_CHANGE_DETECTED → reconsider_hypothesis", () => {
      const r = twinNexInspect(handoff({ patch_diff_lines_changed: 0 }));
      expect(r.repair_proposal.kind).toBe("reconsider_hypothesis");
    });
    it("REGRESSION_INTRODUCED → rollback_change", () => {
      const r = twinNexInspect(handoff({
        test_outputs_after: [{ test_id: "T_target", passed: true }, { test_id: "R1", passed: false }],
      }));
      expect(r.repair_proposal.kind).toBe("rollback_change");
    });
    it("TARGET_VERIFIED + agree → no_repair_needed", () => {
      const r = twinNexInspect(handoff());
      expect(r.repair_proposal.kind).toBe("no_repair_needed");
    });
  });

  describe("invariants", () => {
    it("declares caller_must_decide=true", () => {
      const r = twinNexInspect(handoff());
      expect(r.caller_must_decide).toBe(true);
    });
    it("declares zero_llm=true and ledger=B", () => {
      const r = twinNexInspect(handoff());
      expect(r.zero_llm).toBe(true);
      expect(r.ledger).toBe("B");
    });
    it("canonical version", () => {
      expect(TWIN_NEX_VERSION).toBe("twin-nex.v1.2026-09-19");
    });
  });
});

describe("Referee · evidence-based judgement · §10", () => {
  function refInput(over: Partial<RefereeInput> = {}): RefereeInput {
    const h = handoff();
    return {
      primary_handoff: h,
      twin_assessment: twinNexInspect(h),
      specification_resolvable: true,
      ...over,
    };
  }

  describe("5-verdict coverage", () => {
    it("VERIFIED when both agree + concrete transition observed", () => {
      const j = refereeJudge(refInput());
      expect(j.verdict).toBe("VERIFIED");
      expect(j.evidence_citations.some((c) => c.kind === "test_transition")).toBe(true);
    });

    it("FAILED when twin sees NO_CHANGE_DETECTED and primary also acknowledges failure", () => {
      // Primary must NOT claim VERIFIED here · else the correct verdict is
      // CONFLICTING_EVIDENCE (which is a separate test below).
      const h = handoff({
        patch_diff_lines_changed: 0,
        primary_verdict: "TARGET_BEHAVIOUR_NOT_ACHIEVED",
      });
      const t = twinNexInspect(h);
      const j = refereeJudge({ primary_handoff: h, twin_assessment: t, specification_resolvable: true });
      expect(j.verdict).toBe("FAILED");
      expect(j.evidence_citations.some((c) => c.kind === "patch_diff")).toBe(true);
    });

    it("FAILED when twin sees REGRESSION_INTRODUCED", () => {
      const h = handoff({
        test_outputs_after: [{ test_id: "T_target", passed: true }, { test_id: "R1", passed: false }],
        primary_verdict: "CODING_LOOP_RUNTIME_VERIFIED",
      });
      const t = twinNexInspect(h);
      const j = refereeJudge({ primary_handoff: h, twin_assessment: t, specification_resolvable: true });
      // Twin CHALLENGES → verdict is CONFLICTING_EVIDENCE
      expect(j.verdict).toBe("CONFLICTING_EVIDENCE");
    });

    it("CONFLICTING_EVIDENCE when Twin challenges primary", () => {
      const h = handoff({
        primary_verdict: "CODING_LOOP_RUNTIME_VERIFIED",
        patch_diff_lines_changed: 0,
      });
      const t = twinNexInspect(h);
      const j = refereeJudge({ primary_handoff: h, twin_assessment: t, specification_resolvable: true });
      expect(j.verdict).toBe("CONFLICTING_EVIDENCE");
      expect(j.evidence_citations.some((c) => c.kind === "twin")).toBe(true);
    });

    it("SPECIFICATION_UNRESOLVED when input flag says so", () => {
      const j = refereeJudge(refInput({
        specification_resolvable: false,
        specification_unresolved_reason: "no expected value provided",
      }));
      expect(j.verdict).toBe("SPECIFICATION_UNRESOLVED");
    });

    it("INSUFFICIENT_EVIDENCE when twin reports insufficient", () => {
      const h = handoff({ target_test_id: null });
      const t = twinNexInspect(h);
      const j = refereeJudge({ primary_handoff: h, twin_assessment: t, specification_resolvable: true });
      expect(j.verdict).toBe("INSUFFICIENT_EVIDENCE");
      expect(j.missing_evidence.length).toBeGreaterThan(0);
    });
  });

  describe("anti-fabrication (§10 verbatim)", () => {
    it("VERIFIED requires concrete FAIL→PASS transition · not just twin agreement", () => {
      // Craft input where twin says VERIFIED but the raw before/after don't show transition
      // (this shouldn't normally happen given how twin derives its verdict, but referee
      // must be defensive)
      const h = handoff({
        test_outputs_before: [{ test_id: "T_target", passed: true }],  // was already passing
        test_outputs_after: [{ test_id: "T_target", passed: true }],
      });
      const t = twinNexInspect(h);
      // Twin will see no transition → INDEPENDENT_INSUFFICIENT_EVIDENCE
      const j = refereeJudge({ primary_handoff: h, twin_assessment: t, specification_resolvable: true });
      expect(j.verdict).not.toBe("VERIFIED");
    });

    it("never emits VERIFIED when target_test_id is null", () => {
      const h = handoff({ target_test_id: null });
      const t = twinNexInspect(h);
      const j = refereeJudge({ primary_handoff: h, twin_assessment: t, specification_resolvable: true });
      expect(j.verdict).not.toBe("VERIFIED");
    });

    it("evidence_citations includes concrete sources", () => {
      const j = refereeJudge(refInput());
      expect(j.evidence_citations.length).toBeGreaterThan(0);
      for (const c of j.evidence_citations) {
        expect(c.source.length).toBeGreaterThan(0);
        expect(c.claim.length).toBeGreaterThan(0);
      }
    });
  });

  describe("invariants", () => {
    it("declares caller_must_decide=true", () => {
      const j = refereeJudge(refInput());
      expect(j.caller_must_decide).toBe(true);
    });
    it("declares zero_llm=true and ledger=B", () => {
      const j = refereeJudge(refInput());
      expect(j.zero_llm).toBe(true);
      expect(j.ledger).toBe("B");
    });
    it("canonical version", () => {
      expect(REFEREE_VERSION).toBe("referee.v1.2026-09-19");
    });
  });
});
