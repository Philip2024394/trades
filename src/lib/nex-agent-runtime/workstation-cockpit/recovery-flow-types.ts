// §36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit · recovery-flow
// NEX bounded infrastructure · recovery-flow types · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Locked 4-state promotion ladder for a suggested file change.
// SUGGESTED → AUTHORISED → CHANGED → VERIFIED. Never collapsed.
// Every transition requires an evidence citation.

import type { FileChangeAction } from "./cockpit-state-types";

// ── Locked 4-state ladder ───────────────────────────────────────────────

export type RecoveryStepState = "SUGGESTED" | "AUTHORISED" | "CHANGED" | "VERIFIED";

export const RECOVERY_STEP_STATES: readonly RecoveryStepState[] = Object.freeze([
  "SUGGESTED",
  "AUTHORISED",
  "CHANGED",
  "VERIFIED",
]);

// ── Locked promotion events ─────────────────────────────────────────────
//
// A SUGGESTED step becomes AUTHORISED when the founder (or an already-signed
// bounded authorisation) accepts it. AUTHORISED becomes CHANGED when a real
// git-tracked file change is observed for that path. CHANGED becomes
// VERIFIED only when a real test-run evidence pointer is attached AND
// tests_status === PASS.

export type RecoveryPromotionEventId =
  | "EVENT_AUTHORISE_SUGGESTION"
  | "EVENT_OBSERVE_FILE_CHANGE"
  | "EVENT_ATTACH_TEST_EVIDENCE_PASS"
  | "EVENT_ATTACH_TEST_EVIDENCE_FAIL"
  | "EVENT_REJECT_SUGGESTION";

export const RECOVERY_PROMOTION_EVENTS: readonly RecoveryPromotionEventId[] = Object.freeze([
  "EVENT_AUTHORISE_SUGGESTION",
  "EVENT_OBSERVE_FILE_CHANGE",
  "EVENT_ATTACH_TEST_EVIDENCE_PASS",
  "EVENT_ATTACH_TEST_EVIDENCE_FAIL",
  "EVENT_REJECT_SUGGESTION",
]);

// ── Refusal codes (locked · 6) ──────────────────────────────────────────

export type RecoveryFlowRefusalCode =
  | "RFR_INVALID_REQUEST"
  | "RFR_MISSING_AUTHORISATION_REF"
  | "RFR_MISSING_EVIDENCE_REF"
  | "RFR_ILLEGAL_PROMOTION"
  | "RFR_UNAUTHORISED_TARGET_PATH"
  | "RFR_PROTECTED_TARGET_PATH";

export const RECOVERY_FLOW_REFUSAL_CODES: readonly RecoveryFlowRefusalCode[] = Object.freeze([
  "RFR_INVALID_REQUEST",
  "RFR_MISSING_AUTHORISATION_REF",
  "RFR_MISSING_EVIDENCE_REF",
  "RFR_ILLEGAL_PROMOTION",
  "RFR_UNAUTHORISED_TARGET_PATH",
  "RFR_PROTECTED_TARGET_PATH",
]);

// ── One recovery step record ────────────────────────────────────────────

export interface RecoveryStep {
  readonly step_id: string;                       // stable id per suggestion (e.g. mission-id + path + index)
  readonly path: string;
  readonly proposed_action: FileChangeAction;
  readonly reason: string;
  readonly current_state: RecoveryStepState;
  readonly test_result: "PASS" | "FAIL" | "NOT_RUN";
  readonly history: readonly RecoveryHistoryEntry[];
}

export interface RecoveryHistoryEntry {
  readonly from_state: RecoveryStepState;
  readonly to_state: RecoveryStepState;
  readonly event_id: RecoveryPromotionEventId;
  readonly at_iso: string;
  readonly authorisation_ref: string | null;
  readonly evidence_ref: string | null;
  readonly test_evidence_ref: string | null;
}

// ── Promotion request shape ─────────────────────────────────────────────

export interface PromoteRecoveryStepRequest {
  readonly step: RecoveryStep;
  readonly event_id: RecoveryPromotionEventId;
  readonly at_iso: string;
  readonly authorisation_ref: string | null;
  readonly evidence_ref: string | null;
  readonly test_evidence_ref: string | null;
  // Guards
  readonly authorised_target_paths: readonly string[]; // paths the mission has authority to modify
  readonly protected_target_paths: readonly string[];  // paths that MUST NOT be modified
}

export interface PromoteRecoveryStepSuccess {
  readonly kind: "SUCCESS";
  readonly next_step: RecoveryStep;
  readonly grep_marker: "§36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit";
}

export interface PromoteRecoveryStepFailure {
  readonly kind: "FAILURE";
  readonly refusal_code: RecoveryFlowRefusalCode;
  readonly reason: string;
  readonly grep_marker: "§36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit";
}

export type PromoteRecoveryStepResult = PromoteRecoveryStepSuccess | PromoteRecoveryStepFailure;
