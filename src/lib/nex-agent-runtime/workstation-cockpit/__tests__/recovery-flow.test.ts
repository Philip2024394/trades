// §36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit · recovery-flow
// NEX bounded infrastructure · recovery-flow tests · 2026-09-14

import { describe, expect, it } from "vitest";
import { createSuggestedStep, promoteRecoveryStep } from "../recovery-flow";
import type {
  PromoteRecoveryStepFailure,
  PromoteRecoveryStepRequest,
  PromoteRecoveryStepSuccess,
  RecoveryPromotionEventId,
  RecoveryStep,
} from "../recovery-flow-types";

// ── Fixture builders ────────────────────────────────────────────────────

function initialStep(): RecoveryStep {
  return createSuggestedStep({
    step_id: "s-1",
    path: "src/app/demo/page.tsx",
    proposed_action: "MODIFIED",
    reason: "component render failure · missing children prop",
  });
}

function req(
  step: RecoveryStep,
  event_id: RecoveryPromotionEventId,
  overrides: Partial<PromoteRecoveryStepRequest> = {},
): PromoteRecoveryStepRequest {
  return {
    step,
    event_id,
    at_iso: overrides.at_iso ?? "2026-09-14T15:00:00.000Z",
    authorisation_ref: overrides.authorisation_ref ?? null,
    evidence_ref: overrides.evidence_ref ?? null,
    test_evidence_ref: overrides.test_evidence_ref ?? null,
    authorised_target_paths: overrides.authorised_target_paths ?? ["src/app/demo/"],
    protected_target_paths: overrides.protected_target_paths ?? [
      "src/lib/nex-agent-runtime/programming-mission/",
      "src/lib/nex-agent-runtime/c1-nex-facial-state-model/",
    ],
  };
}

function asSuccess(r: ReturnType<typeof promoteRecoveryStep>): PromoteRecoveryStepSuccess {
  if (r.kind !== "SUCCESS") throw new Error(`unexpected refusal ${(r as PromoteRecoveryStepFailure).refusal_code}`);
  return r;
}

// ── §A · Initial state ──────────────────────────────────────────────────

describe("§36-W-2 · W2 · recovery-flow · §A · initial state", () => {
  it("A-1 · createSuggestedStep starts at SUGGESTED with NOT_RUN + empty history", () => {
    const s = initialStep();
    expect(s.current_state).toBe("SUGGESTED");
    expect(s.test_result).toBe("NOT_RUN");
    expect(s.history.length).toBe(0);
  });
});

// ── §B · Happy-path promotion ladder ────────────────────────────────────

describe("§36-W-2 · W2 · recovery-flow · §B · happy path promotion", () => {
  it("B-1 · SUGGESTED → AUTHORISED via EVENT_AUTHORISE_SUGGESTION (with authorisation_ref)", () => {
    const step = initialStep();
    const r = asSuccess(promoteRecoveryStep(req(step, "EVENT_AUTHORISE_SUGGESTION", { authorisation_ref: "founder-sig-1" })));
    expect(r.next_step.current_state).toBe("AUTHORISED");
    expect(r.next_step.history.length).toBe(1);
    expect(r.next_step.history[0].authorisation_ref).toBe("founder-sig-1");
  });
  it("B-2 · AUTHORISED → CHANGED via EVENT_OBSERVE_FILE_CHANGE (with evidence_ref)", () => {
    let step = initialStep();
    step = asSuccess(promoteRecoveryStep(req(step, "EVENT_AUTHORISE_SUGGESTION", { authorisation_ref: "founder-sig-1" }))).next_step;
    const r = asSuccess(promoteRecoveryStep(req(step, "EVENT_OBSERVE_FILE_CHANGE", { evidence_ref: "git:M src/app/demo/page.tsx" })));
    expect(r.next_step.current_state).toBe("CHANGED");
    expect(r.next_step.history.length).toBe(2);
  });
  it("B-3 · CHANGED → VERIFIED via EVENT_ATTACH_TEST_EVIDENCE_PASS (test_result flips to PASS)", () => {
    let step = initialStep();
    step = asSuccess(promoteRecoveryStep(req(step, "EVENT_AUTHORISE_SUGGESTION", { authorisation_ref: "founder-sig-1" }))).next_step;
    step = asSuccess(promoteRecoveryStep(req(step, "EVENT_OBSERVE_FILE_CHANGE", { evidence_ref: "git:M src/app/demo/page.tsx" }))).next_step;
    const r = asSuccess(promoteRecoveryStep(req(step, "EVENT_ATTACH_TEST_EVIDENCE_PASS", { test_evidence_ref: "vitest:47/47 pass" })));
    expect(r.next_step.current_state).toBe("VERIFIED");
    expect(r.next_step.test_result).toBe("PASS");
  });
});

// ── §C · Test failure branch ────────────────────────────────────────────

describe("§36-W-2 · W2 · recovery-flow · §C · test failure branch", () => {
  it("C-1 · CHANGED + EVENT_ATTACH_TEST_EVIDENCE_FAIL → stays CHANGED · test_result = FAIL", () => {
    let step = initialStep();
    step = asSuccess(promoteRecoveryStep(req(step, "EVENT_AUTHORISE_SUGGESTION", { authorisation_ref: "founder-sig-1" }))).next_step;
    step = asSuccess(promoteRecoveryStep(req(step, "EVENT_OBSERVE_FILE_CHANGE", { evidence_ref: "git:M" }))).next_step;
    const r = asSuccess(promoteRecoveryStep(req(step, "EVENT_ATTACH_TEST_EVIDENCE_FAIL", { test_evidence_ref: "vitest:1 fail" })));
    expect(r.next_step.current_state).toBe("CHANGED");
    expect(r.next_step.test_result).toBe("FAIL");
  });
});

// ── §D · Rejection ──────────────────────────────────────────────────────

describe("§36-W-2 · W2 · recovery-flow · §D · rejection", () => {
  it("D-1 · SUGGESTED + EVENT_REJECT_SUGGESTION → stays SUGGESTED · test_result = NOT_RUN · history grows", () => {
    const step = initialStep();
    const r = asSuccess(promoteRecoveryStep(req(step, "EVENT_REJECT_SUGGESTION")));
    expect(r.next_step.current_state).toBe("SUGGESTED");
    expect(r.next_step.test_result).toBe("NOT_RUN");
    expect(r.next_step.history.length).toBe(1);
    expect(r.next_step.history[0].event_id).toBe("EVENT_REJECT_SUGGESTION");
  });
});

// ── §E · Illegal-promotion refusals ─────────────────────────────────────

describe("§36-W-2 · W2 · recovery-flow · §E · illegal-promotion refusals", () => {
  it("E-1 · SUGGESTED + EVENT_OBSERVE_FILE_CHANGE → RFR_ILLEGAL_PROMOTION", () => {
    const step = initialStep();
    const r = promoteRecoveryStep(req(step, "EVENT_OBSERVE_FILE_CHANGE", { evidence_ref: "git:M" })) as PromoteRecoveryStepFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("RFR_ILLEGAL_PROMOTION");
  });
  it("E-2 · SUGGESTED + EVENT_ATTACH_TEST_EVIDENCE_PASS → RFR_ILLEGAL_PROMOTION", () => {
    const step = initialStep();
    const r = promoteRecoveryStep(req(step, "EVENT_ATTACH_TEST_EVIDENCE_PASS", { test_evidence_ref: "x" })) as PromoteRecoveryStepFailure;
    expect(r.refusal_code).toBe("RFR_ILLEGAL_PROMOTION");
  });
  it("E-3 · VERIFIED (terminal) + any event → RFR_ILLEGAL_PROMOTION", () => {
    let step = initialStep();
    step = asSuccess(promoteRecoveryStep(req(step, "EVENT_AUTHORISE_SUGGESTION", { authorisation_ref: "x" }))).next_step;
    step = asSuccess(promoteRecoveryStep(req(step, "EVENT_OBSERVE_FILE_CHANGE", { evidence_ref: "x" }))).next_step;
    step = asSuccess(promoteRecoveryStep(req(step, "EVENT_ATTACH_TEST_EVIDENCE_PASS", { test_evidence_ref: "x" }))).next_step;
    expect(step.current_state).toBe("VERIFIED");
    const r = promoteRecoveryStep(req(step, "EVENT_OBSERVE_FILE_CHANGE", { evidence_ref: "x" })) as PromoteRecoveryStepFailure;
    expect(r.refusal_code).toBe("RFR_ILLEGAL_PROMOTION");
  });
});

// ── §F · Authorisation-evidence guards ──────────────────────────────────

describe("§36-W-2 · W2 · recovery-flow · §F · authorisation-evidence guards", () => {
  it("F-1 · EVENT_AUTHORISE_SUGGESTION without authorisation_ref → RFR_MISSING_AUTHORISATION_REF", () => {
    const step = initialStep();
    const r = promoteRecoveryStep(req(step, "EVENT_AUTHORISE_SUGGESTION", { authorisation_ref: null })) as PromoteRecoveryStepFailure;
    expect(r.refusal_code).toBe("RFR_MISSING_AUTHORISATION_REF");
  });
  it("F-2 · EVENT_OBSERVE_FILE_CHANGE without evidence_ref → RFR_MISSING_EVIDENCE_REF", () => {
    let step = initialStep();
    step = asSuccess(promoteRecoveryStep(req(step, "EVENT_AUTHORISE_SUGGESTION", { authorisation_ref: "x" }))).next_step;
    const r = promoteRecoveryStep(req(step, "EVENT_OBSERVE_FILE_CHANGE", { evidence_ref: null })) as PromoteRecoveryStepFailure;
    expect(r.refusal_code).toBe("RFR_MISSING_EVIDENCE_REF");
  });
  it("F-3 · EVENT_ATTACH_TEST_EVIDENCE_PASS without test_evidence_ref → RFR_MISSING_EVIDENCE_REF", () => {
    let step = initialStep();
    step = asSuccess(promoteRecoveryStep(req(step, "EVENT_AUTHORISE_SUGGESTION", { authorisation_ref: "x" }))).next_step;
    step = asSuccess(promoteRecoveryStep(req(step, "EVENT_OBSERVE_FILE_CHANGE", { evidence_ref: "x" }))).next_step;
    const r = promoteRecoveryStep(req(step, "EVENT_ATTACH_TEST_EVIDENCE_PASS", { test_evidence_ref: null })) as PromoteRecoveryStepFailure;
    expect(r.refusal_code).toBe("RFR_MISSING_EVIDENCE_REF");
  });
});

// ── §G · Protected-target guard ─────────────────────────────────────────

describe("§36-W-2 · W2 · recovery-flow · §G · protected-target guard", () => {
  it("G-1 · path under a protected root → RFR_PROTECTED_TARGET_PATH", () => {
    const step = createSuggestedStep({
      step_id: "s-x",
      path: "src/lib/nex-agent-runtime/programming-mission/typed-data-contract-authoring.ts",
      proposed_action: "MODIFIED",
      reason: "hypothetical mutation to Route 2 primitive",
    });
    const r = promoteRecoveryStep(req(step, "EVENT_AUTHORISE_SUGGESTION", { authorisation_ref: "founder-sig-1" })) as PromoteRecoveryStepFailure;
    expect(r.refusal_code).toBe("RFR_PROTECTED_TARGET_PATH");
  });
  it("G-2 · path outside protected roots + inside authorised roots → allowed", () => {
    const step = initialStep(); // src/app/demo/page.tsx · authorised root src/app/demo/
    const r = asSuccess(promoteRecoveryStep(req(step, "EVENT_AUTHORISE_SUGGESTION", { authorisation_ref: "founder-sig-1" })));
    expect(r.next_step.current_state).toBe("AUTHORISED");
  });
});

// ── §H · Unauthorised-target guard ──────────────────────────────────────

describe("§36-W-2 · W2 · recovery-flow · §H · unauthorised-target guard", () => {
  it("H-1 · path outside authorised roots (with non-empty allowlist) → RFR_UNAUTHORISED_TARGET_PATH", () => {
    const step = createSuggestedStep({
      step_id: "s-y",
      path: "src/app/somewhere-else/page.tsx",
      proposed_action: "MODIFIED",
      reason: "attempt to modify unauthorised path",
    });
    const r = promoteRecoveryStep(req(step, "EVENT_AUTHORISE_SUGGESTION", { authorisation_ref: "founder-sig-1", authorised_target_paths: ["src/app/demo/"] })) as PromoteRecoveryStepFailure;
    expect(r.refusal_code).toBe("RFR_UNAUTHORISED_TARGET_PATH");
  });
  it("H-2 · empty authorised_target_paths → no unauthorised-target check", () => {
    const step = initialStep();
    const r = asSuccess(promoteRecoveryStep(req(step, "EVENT_AUTHORISE_SUGGESTION", { authorisation_ref: "founder-sig-1", authorised_target_paths: [] })));
    expect(r.next_step.current_state).toBe("AUTHORISED");
  });
});

// ── §I · Malformed request ──────────────────────────────────────────────

describe("§36-W-2 · W2 · recovery-flow · §I · malformed request", () => {
  it("I-1 · null request → RFR_INVALID_REQUEST", () => {
    const r = promoteRecoveryStep(null as never) as PromoteRecoveryStepFailure;
    expect(r.refusal_code).toBe("RFR_INVALID_REQUEST");
  });
  it("I-2 · missing step → RFR_INVALID_REQUEST", () => {
    const r = promoteRecoveryStep({ event_id: "EVENT_AUTHORISE_SUGGESTION", at_iso: "2026-09-14T15:00:00.000Z", authorisation_ref: "x", evidence_ref: null, test_evidence_ref: null, authorised_target_paths: [], protected_target_paths: [] } as never) as PromoteRecoveryStepFailure;
    expect(r.refusal_code).toBe("RFR_INVALID_REQUEST");
  });
  it("I-3 · unknown current_state → RFR_INVALID_REQUEST", () => {
    const badStep = { ...initialStep(), current_state: "UNKNOWN" as never };
    const r = promoteRecoveryStep(req(badStep, "EVENT_AUTHORISE_SUGGESTION", { authorisation_ref: "x" })) as PromoteRecoveryStepFailure;
    expect(r.refusal_code).toBe("RFR_INVALID_REQUEST");
  });
});

// ── §J · SUGGESTED ≠ CHANGED ≠ VERIFIED (locked distinction) ──────────

describe("§36-W-2 · W2 · recovery-flow · §J · locked state distinction", () => {
  it("J-1 · suggesting a change does NOT create a CHANGED entry", () => {
    const step = initialStep(); // SUGGESTED
    expect(step.current_state).toBe("SUGGESTED");
    // No way to go SUGGESTED → CHANGED directly (only via AUTHORISED)
    const r = promoteRecoveryStep(req(step, "EVENT_OBSERVE_FILE_CHANGE", { evidence_ref: "git:M" })) as PromoteRecoveryStepFailure;
    expect(r.refusal_code).toBe("RFR_ILLEGAL_PROMOTION");
  });
  it("J-2 · CHANGED does NOT imply VERIFIED · test evidence required", () => {
    let step = initialStep();
    step = asSuccess(promoteRecoveryStep(req(step, "EVENT_AUTHORISE_SUGGESTION", { authorisation_ref: "x" }))).next_step;
    step = asSuccess(promoteRecoveryStep(req(step, "EVENT_OBSERVE_FILE_CHANGE", { evidence_ref: "git:M" }))).next_step;
    expect(step.current_state).toBe("CHANGED");
    expect(step.test_result).toBe("NOT_RUN"); // still NOT_RUN · not auto-promoted
    // Only EVENT_ATTACH_TEST_EVIDENCE_PASS promotes; no evidence == still CHANGED
  });
});

// ── §K · Grep marker ───────────────────────────────────────────────────

describe("§36-W-2 · W2 · recovery-flow · §K · grep marker", () => {
  it("K-1 · success carries §36-W-2 marker", () => {
    const step = initialStep();
    const r = asSuccess(promoteRecoveryStep(req(step, "EVENT_AUTHORISE_SUGGESTION", { authorisation_ref: "x" })));
    expect(r.grep_marker).toBe("§36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit");
  });
  it("K-2 · failure carries §36-W-2 marker", () => {
    const r = promoteRecoveryStep(null as never);
    if (r.kind === "FAILURE") expect(r.grep_marker).toBe("§36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit");
  });
});
