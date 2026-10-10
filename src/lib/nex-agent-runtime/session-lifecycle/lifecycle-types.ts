// §36-E-7 · WAVE-E7 · 2026-09-14 · session-lifecycle
// NEX bounded infrastructure · lifecycle types · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.

// ── 13 locked states ────────────────────────────────────────────────────

export type LifecycleState =
  | "CREATED"
  | "PREPARED"
  | "AUTHORISED"
  | "EXECUTING"
  | "TESTING"
  | "REVIEWING"
  | "REFUTING"
  | "VERIFIED"
  | "COMPLETED"
  | "REFUSED"
  | "FAILED"
  | "RECOVERING"
  | "CANCELLED";

export const LIFECYCLE_STATES: readonly LifecycleState[] = Object.freeze([
  "CREATED",
  "PREPARED",
  "AUTHORISED",
  "EXECUTING",
  "TESTING",
  "REVIEWING",
  "REFUTING",
  "VERIFIED",
  "COMPLETED",
  "REFUSED",
  "FAILED",
  "RECOVERING",
  "CANCELLED",
]);

export const TERMINAL_STATES: readonly LifecycleState[] = Object.freeze([
  "COMPLETED",
  "REFUSED",
  "CANCELLED",
]);

// ── 18 locked events ────────────────────────────────────────────────────

export type LifecycleEventId =
  | "EVENT_PREPARE"
  | "EVENT_AUTHORISE"
  | "EVENT_START_EXECUTION"
  | "EVENT_START_TESTING"
  | "EVENT_TESTING_PASSED"
  | "EVENT_START_REFUTATION"
  | "EVENT_REFUTATION_RESOLVED"
  | "EVENT_COMPLETE"
  | "EVENT_REFUSE_MISSION"
  | "EVENT_TESTING_FAILED"
  | "EVENT_REVIEW_REJECTED"
  | "EVENT_REFUTATION_UNRESOLVED"
  | "EVENT_EXECUTION_ERRORED"
  | "EVENT_START_RECOVERY"
  | "EVENT_RECOVERY_SUCCEEDED"
  | "EVENT_RECOVERY_ABANDONED"
  | "EVENT_CANCEL"
  | "EVENT_RETRY_FROM_AUTHORISED";

export const LIFECYCLE_EVENT_IDS: readonly LifecycleEventId[] = Object.freeze([
  "EVENT_PREPARE",
  "EVENT_AUTHORISE",
  "EVENT_START_EXECUTION",
  "EVENT_START_TESTING",
  "EVENT_TESTING_PASSED",
  "EVENT_START_REFUTATION",
  "EVENT_REFUTATION_RESOLVED",
  "EVENT_COMPLETE",
  "EVENT_REFUSE_MISSION",
  "EVENT_TESTING_FAILED",
  "EVENT_REVIEW_REJECTED",
  "EVENT_REFUTATION_UNRESOLVED",
  "EVENT_EXECUTION_ERRORED",
  "EVENT_START_RECOVERY",
  "EVENT_RECOVERY_SUCCEEDED",
  "EVENT_RECOVERY_ABANDONED",
  "EVENT_CANCEL",
  "EVENT_RETRY_FROM_AUTHORISED",
]);

// ── Refusal codes (6) ───────────────────────────────────────────────────

export type LifecycleRefusalCode =
  | "SLC_ILLEGAL_TRANSITION"
  | "SLC_UNKNOWN_EVENT"
  | "SLC_UNKNOWN_STATE"
  | "SLC_TERMINAL_STATE"
  | "SLC_DUPLICATE_EVENT"
  | "SLC_STALE_EVENT";

export const LIFECYCLE_REFUSAL_CODES: readonly LifecycleRefusalCode[] = Object.freeze([
  "SLC_ILLEGAL_TRANSITION",
  "SLC_UNKNOWN_EVENT",
  "SLC_UNKNOWN_STATE",
  "SLC_TERMINAL_STATE",
  "SLC_DUPLICATE_EVENT",
  "SLC_STALE_EVENT",
]);

// ── Event record shape ──────────────────────────────────────────────────

export interface LifecycleEvent {
  readonly event_id: LifecycleEventId;
  readonly mission_id: string;
  readonly emitted_at_iso: string; // ISO-8601 timestamp
  readonly authorisation_ref: string | null; // required for EVENT_AUTHORISE
  readonly evidence_ref: string | null;      // optional evidence pointer
}

// ── Mission lifecycle record ────────────────────────────────────────────

export interface LifecycleHistoryEntry {
  readonly from_state: LifecycleState;
  readonly to_state: LifecycleState;
  readonly event_id: LifecycleEventId;
  readonly emitted_at_iso: string;
  readonly authorisation_ref: string | null;
  readonly evidence_ref: string | null;
}

export interface MissionLifecycleRecord {
  readonly mission_id: string;
  readonly current_state: LifecycleState;
  readonly last_event_iso: string;
  readonly history: readonly LifecycleHistoryEntry[];
}

// ── Transition request / response shapes ────────────────────────────────

export interface TransitionRequest {
  readonly record: MissionLifecycleRecord;
  readonly event: LifecycleEvent;
}

export interface TransitionSuccess {
  readonly kind: "SUCCESS";
  readonly next_record: MissionLifecycleRecord;
  readonly transition: LifecycleHistoryEntry;
  readonly grep_marker: "§36-E-7 · WAVE-E7 · 2026-09-14 · session-lifecycle";
}

export interface TransitionFailure {
  readonly kind: "FAILURE";
  readonly refusal_code: LifecycleRefusalCode;
  readonly reason: string;
  readonly grep_marker: "§36-E-7 · WAVE-E7 · 2026-09-14 · session-lifecycle";
}

export type TransitionResult = TransitionSuccess | TransitionFailure;
