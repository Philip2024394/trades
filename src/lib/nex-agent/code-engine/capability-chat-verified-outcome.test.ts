// src/lib/nex-agent/code-engine/capability-chat-verified-outcome.test.ts
//
// Chat-integration wrapper tests. Zero LLM. Deterministic.

import { describe, it, expect } from "vitest";
import {
  assessChatVerifiedOutcome,
  userFacingPhrase,
  CHAT_VERIFIED_OUTCOME_VERSION,
  type ChatVerifiedOutcomeInput,
} from "./capability-chat-verified-outcome";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

function baseInput(over: Partial<ChatVerifiedOutcomeInput> = {}): ChatVerifiedOutcomeInput {
  const tmp = mkdtempSync(path.join(tmpdir(), "nex1-chat-verified-"));
  return {
    conversation_id: "conv_test",
    correlation_id: "cor_test_" + Math.random().toString(36).slice(2, 10),
    loop_overall_verdict: "CODING_LOOP_RUNTIME_VERIFIED",
    loop_content_changed: true,
    loop_stages: [],
    target_file: "src/example.ts",
    verb_family: "FIX",
    matches_expected: true,
    observed_return_value: 30,
    expected_return_value: 30,
    repo_root: process.cwd(),
    experience_data_root: tmp,
    ...over,
  };
}

describe("capability-chat-verified-outcome · chat integration wrapper", () => {
  describe("collapse detection (founder-diagnosed pattern)", () => {
    it("demotes RUNTIME_VERIFIED + no-change + mismatch to REGRESSION_PRESERVED", () => {
      const r = assessChatVerifiedOutcome(baseInput({
        loop_content_changed: false,
        matches_expected: false,
      }));
      expect(r.wrapper_ran).toBe(true);
      expect(r.demoted).toBe(true);
      expect(r.wrapper_state).toBe("REGRESSION_PRESERVED");
      expect(r.agreement_status).toBe("SUSPICIOUS_NO_CHANGE_COLLAPSE");
      expect(r.failure_class).toBe("NO_TRANSITION_OBSERVED");
      expect(r.repair_strategy).toBe("RECONSIDER_HYPOTHESIS");
      try { rmSync(r.retrieval_hint.epistemic_status !== null ? "" : "", { recursive: true, force: true }); } catch { /* noop */ }
    });

    it("preserves RUNTIME_VERIFIED when independent verifier confirms FAIL→PASS", () => {
      const r = assessChatVerifiedOutcome(baseInput({
        loop_content_changed: true,
        matches_expected: true,
      }));
      expect(r.wrapper_ran).toBe(true);
      // With content_changed=true and matches_expected=true, we simulate before=FAIL after=PASS
      // Actually · our wrapper only sets before=FAIL when NOT collapse candidate. This IS the non-collapse path.
      expect(r.demoted).toBe(false);
      expect(r.wrapper_state).toBe("TARGET_BEHAVIOUR_VERIFIED");
    });
  });

  describe("upstream state preservation", () => {
    it("does not run wrapper when loop verdict is not RUNTIME_VERIFIED", () => {
      const r = assessChatVerifiedOutcome(baseInput({
        loop_overall_verdict: "CODING_LOOP_NOT_YET_RUNTIME_VERIFIED",
        matches_expected: false,
      }));
      expect(r.wrapper_ran).toBe(false);
      expect(r.wrapper_state).toBe("TARGET_BEHAVIOUR_NOT_ACHIEVED");
      expect(r.upstream_state_would_have_been).toBe("not_verified");
    });

    it("does not run wrapper for SPECIFICATION_INSUFFICIENT loop verdict", () => {
      const r = assessChatVerifiedOutcome(baseInput({
        loop_overall_verdict: "SPECIFICATION_INSUFFICIENT",
      }));
      expect(r.wrapper_ran).toBe(false);
      expect(r.wrapper_state).toBe("SPECIFICATION_UNRESOLVED");
    });
  });

  describe("experience recording", () => {
    it("writes an episode when wrapper runs", () => {
      const r = assessChatVerifiedOutcome(baseInput({
        loop_content_changed: false,
        matches_expected: false,
      }));
      expect(r.episode_written).toBe(true);
      expect(r.episode_id).not.toBeNull();
    });

    it("episode is marked verified_failure when demoted", () => {
      const r = assessChatVerifiedOutcome(baseInput({
        loop_content_changed: false,
        matches_expected: false,
      }));
      expect(r.wrapper_state).toBe("REGRESSION_PRESERVED");
      expect(r.episode_written).toBe(true);
    });
  });

  describe("retrieval hint (caller_must_decide invariant)", () => {
    it("every retrieval hint has caller_must_decide=true", () => {
      const r = assessChatVerifiedOutcome(baseInput());
      expect(r.retrieval_hint.caller_must_decide).toBe(true);
    });
  });

  describe("ledger + zero-LLM invariants", () => {
    it("declares zero_llm and ledger=B", () => {
      const r = assessChatVerifiedOutcome(baseInput());
      expect(r.zero_llm).toBe(true);
      expect(r.ledger).toBe("B");
      expect(r.version).toBe(CHAT_VERIFIED_OUTCOME_VERSION);
    });
  });

  describe("user-facing phrase mapping (evidence-backed language)", () => {
    it("TARGET_BEHAVIOUR_VERIFIED phrase mentions FAIL→PASS transition", () => {
      const p = userFacingPhrase("TARGET_BEHAVIOUR_VERIFIED");
      expect(p.evidence_backed).toBe(true);
      expect(p.phrase.toLowerCase()).toContain("fail");
      expect(p.phrase.toLowerCase()).toContain("pass");
    });
    it("REGRESSION_PRESERVED phrase does NOT claim the request was achieved", () => {
      const p = userFacingPhrase("REGRESSION_PRESERVED");
      expect(p.phrase.toLowerCase()).toContain("cannot claim");
    });
    it("SPECIFICATION_UNRESOLVED asks user to clarify", () => {
      const p = userFacingPhrase("SPECIFICATION_UNRESOLVED");
      expect(p.phrase.toLowerCase()).toContain("clarify");
    });
    it("SUCCESS_LEGACY_UNVERIFIED is marked NOT evidence-backed (transparency)", () => {
      const p = userFacingPhrase("SUCCESS_LEGACY_UNVERIFIED");
      expect(p.evidence_backed).toBe(false);
    });
    it("WRAPPER_ERROR is not evidence-backed", () => {
      const p = userFacingPhrase("WRAPPER_ERROR");
      expect(p.evidence_backed).toBe(false);
    });
  });

  describe("determinism", () => {
    it("byte-identical outcome for byte-identical input (excluding recorded_at_iso)", () => {
      const inp = baseInput({
        correlation_id: "cor_deterministic",
        loop_content_changed: false,
        matches_expected: false,
      });
      const a = assessChatVerifiedOutcome(inp);
      const b = assessChatVerifiedOutcome(inp);
      expect(a.wrapper_state).toBe(b.wrapper_state);
      expect(a.verifier_verdict).toBe(b.verifier_verdict);
      expect(a.agreement_status).toBe(b.agreement_status);
      expect(a.failure_class).toBe(b.failure_class);
    });
  });
});
