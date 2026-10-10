// §36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit · recovery-flow
// NEX bounded infrastructure · recovery-flow state machine · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Pure function · zero I/O. Enforces the SUGGESTED → AUTHORISED → CHANGED
// → VERIFIED promotion ladder. Illegal promotions refuse. Missing
// authorisation refuses. Missing evidence refuses. Protected-target and
// unauthorised-target paths refuse. Never collapses states.

import type {
  PromoteRecoveryStepFailure,
  PromoteRecoveryStepRequest,
  PromoteRecoveryStepResult,
  PromoteRecoveryStepSuccess,
  RecoveryFlowRefusalCode,
  RecoveryHistoryEntry,
  RecoveryPromotionEventId,
  RecoveryStep,
  RecoveryStepState,
} from "./recovery-flow-types";

const GREP_MARKER = "§36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit" as const;

function fail(
  code: RecoveryFlowRefusalCode,
  reason: string,
): PromoteRecoveryStepFailure {
  return {
    kind: "FAILURE",
    refusal_code: code,
    reason,
    grep_marker: GREP_MARKER,
  };
}

// ── Locked transition table ────────────────────────────────────────────

const TRANSITIONS: ReadonlyMap<RecoveryStepState, ReadonlyMap<RecoveryPromotionEventId, RecoveryStepState>> = new Map<
  RecoveryStepState,
  ReadonlyMap<RecoveryPromotionEventId, RecoveryStepState>
>([
  ["SUGGESTED", new Map<RecoveryPromotionEventId, RecoveryStepState>([
    ["EVENT_AUTHORISE_SUGGESTION", "AUTHORISED"],
    ["EVENT_REJECT_SUGGESTION", "SUGGESTED"], // rejection leaves state; test_result → NOT_RUN, but path is closed downstream by caller
  ])],
  ["AUTHORISED", new Map<RecoveryPromotionEventId, RecoveryStepState>([
    ["EVENT_OBSERVE_FILE_CHANGE", "CHANGED"],
  ])],
  ["CHANGED", new Map<RecoveryPromotionEventId, RecoveryStepState>([
    ["EVENT_ATTACH_TEST_EVIDENCE_PASS", "VERIFIED"],
    ["EVENT_ATTACH_TEST_EVIDENCE_FAIL", "CHANGED"], // stays CHANGED · test_result flips to FAIL
  ])],
  ["VERIFIED", new Map<RecoveryPromotionEventId, RecoveryStepState>([]) /* terminal · no further promotions */],
]);

function isKnownState(s: string): s is RecoveryStepState {
  return s === "SUGGESTED" || s === "AUTHORISED" || s === "CHANGED" || s === "VERIFIED";
}

function normaliseRoot(p: string): string {
  return p.endsWith("/") ? p.slice(0, -1) : p;
}

function isUnderRoot(path: string, root: string): boolean {
  const r = normaliseRoot(root);
  if (r.length === 0) return false;
  return path === r || path.startsWith(`${r}/`);
}

function isProtectedPath(path: string, protectedPaths: readonly string[]): boolean {
  return protectedPaths.some((p) => isUnderRoot(path, p));
}

function isAuthorisedPath(path: string, authorised: readonly string[]): boolean {
  if (authorised.length === 0) return false;
  return authorised.some((p) => isUnderRoot(path, p));
}

// ── Entry point ────────────────────────────────────────────────────────

export function promoteRecoveryStep(request: PromoteRecoveryStepRequest): PromoteRecoveryStepResult {
  if (!request || typeof request !== "object") {
    return fail("RFR_INVALID_REQUEST", "request must be an object");
  }
  const { step, event_id, at_iso, authorisation_ref, evidence_ref, test_evidence_ref, authorised_target_paths, protected_target_paths } = request;
  if (!step || typeof step !== "object" || typeof step.step_id !== "string" || typeof step.path !== "string") {
    return fail("RFR_INVALID_REQUEST", "step is malformed");
  }
  if (!isKnownState(step.current_state)) {
    return fail("RFR_INVALID_REQUEST", `unknown current_state '${step.current_state}'`);
  }
  if (typeof at_iso !== "string" || at_iso.length === 0) {
    return fail("RFR_INVALID_REQUEST", "at_iso required");
  }

  // Guard 1 · protected target
  if (isProtectedPath(step.path, protected_target_paths ?? [])) {
    return fail("RFR_PROTECTED_TARGET_PATH", `path '${step.path}' is under a protected root · cannot be promoted`);
  }
  // Guard 2 · authorised target (only enforced when authorised list is provided AND non-empty)
  if ((authorised_target_paths ?? []).length > 0 && !isAuthorisedPath(step.path, authorised_target_paths)) {
    return fail("RFR_UNAUTHORISED_TARGET_PATH", `path '${step.path}' is not in the mission's authorised target set`);
  }

  // Guard 3 · event-specific authorisation/evidence requirements
  if (event_id === "EVENT_AUTHORISE_SUGGESTION") {
    if (!authorisation_ref || authorisation_ref.length === 0) {
      return fail("RFR_MISSING_AUTHORISATION_REF", "EVENT_AUTHORISE_SUGGESTION requires an authorisation_ref");
    }
  }
  if (event_id === "EVENT_OBSERVE_FILE_CHANGE") {
    if (!evidence_ref || evidence_ref.length === 0) {
      return fail("RFR_MISSING_EVIDENCE_REF", "EVENT_OBSERVE_FILE_CHANGE requires an evidence_ref (e.g. git-status entry)");
    }
  }
  if (event_id === "EVENT_ATTACH_TEST_EVIDENCE_PASS" || event_id === "EVENT_ATTACH_TEST_EVIDENCE_FAIL") {
    if (!test_evidence_ref || test_evidence_ref.length === 0) {
      return fail("RFR_MISSING_EVIDENCE_REF", `${event_id} requires a test_evidence_ref`);
    }
  }

  // Guard 4 · legal transition
  const outbound = TRANSITIONS.get(step.current_state);
  if (!outbound || !outbound.has(event_id)) {
    return fail("RFR_ILLEGAL_PROMOTION", `event '${event_id}' is not valid from state '${step.current_state}'`);
  }

  // Derive next state + test_result
  let nextState = outbound.get(event_id) as RecoveryStepState;
  let nextTestResult: RecoveryStep["test_result"] = step.test_result;
  if (event_id === "EVENT_ATTACH_TEST_EVIDENCE_PASS") nextTestResult = "PASS";
  if (event_id === "EVENT_ATTACH_TEST_EVIDENCE_FAIL") nextTestResult = "FAIL";
  if (event_id === "EVENT_REJECT_SUGGESTION") {
    // Rejection leaves the step at SUGGESTED but marks the test_result as NOT_RUN
    // and appends a history entry recording the rejection.
    nextState = "SUGGESTED";
    nextTestResult = "NOT_RUN";
  }

  const historyEntry: RecoveryHistoryEntry = {
    from_state: step.current_state,
    to_state: nextState,
    event_id,
    at_iso,
    authorisation_ref: authorisation_ref ?? null,
    evidence_ref: evidence_ref ?? null,
    test_evidence_ref: test_evidence_ref ?? null,
  };

  const next_step: RecoveryStep = {
    step_id: step.step_id,
    path: step.path,
    proposed_action: step.proposed_action,
    reason: step.reason,
    current_state: nextState,
    test_result: nextTestResult,
    history: Object.freeze([...step.history, historyEntry]),
  };

  const success: PromoteRecoveryStepSuccess = {
    kind: "SUCCESS",
    next_step,
    grep_marker: GREP_MARKER,
  };
  return success;
}

// ── Convenience: create fresh SUGGESTED step ───────────────────────────

export function createSuggestedStep(input: {
  readonly step_id: string;
  readonly path: string;
  readonly proposed_action: RecoveryStep["proposed_action"];
  readonly reason: string;
}): RecoveryStep {
  return {
    step_id: input.step_id,
    path: input.path,
    proposed_action: input.proposed_action,
    reason: input.reason,
    current_state: "SUGGESTED",
    test_result: "NOT_RUN",
    history: Object.freeze([]),
  };
}
