// §36-E-7 · WAVE-E7 · 2026-09-14 · session-lifecycle
// NEX bounded infrastructure · lifecycle state machine · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Pure function · zero I/O. Deterministic (currentState, event) → nextState
// or refusal. Illegal transitions refuse. Terminal states refuse further events.

import type {
  LifecycleEvent,
  LifecycleEventId,
  LifecycleHistoryEntry,
  LifecycleState,
  MissionLifecycleRecord,
  TransitionFailure,
  TransitionRequest,
  TransitionResult,
  TransitionSuccess,
} from "./lifecycle-types";
import {
  LIFECYCLE_EVENT_IDS,
  LIFECYCLE_STATES,
  TERMINAL_STATES,
} from "./lifecycle-types";

const GREP_MARKER = "§36-E-7 · WAVE-E7 · 2026-09-14 · session-lifecycle" as const;

// ── Locked transition table ────────────────────────────────────────────
//
// Map from source state → set of (event_id → destination state).

const TRANSITIONS: ReadonlyMap<LifecycleState, ReadonlyMap<LifecycleEventId, LifecycleState>> = new Map<
  LifecycleState,
  ReadonlyMap<LifecycleEventId, LifecycleState>
>([
  ["CREATED", new Map<LifecycleEventId, LifecycleState>([
    ["EVENT_PREPARE", "PREPARED"],
    ["EVENT_REFUSE_MISSION", "REFUSED"],
    ["EVENT_CANCEL", "CANCELLED"],
  ])],
  ["PREPARED", new Map<LifecycleEventId, LifecycleState>([
    ["EVENT_AUTHORISE", "AUTHORISED"],
    ["EVENT_REFUSE_MISSION", "REFUSED"],
    ["EVENT_CANCEL", "CANCELLED"],
  ])],
  ["AUTHORISED", new Map<LifecycleEventId, LifecycleState>([
    ["EVENT_START_EXECUTION", "EXECUTING"],
    ["EVENT_CANCEL", "CANCELLED"],
  ])],
  ["EXECUTING", new Map<LifecycleEventId, LifecycleState>([
    ["EVENT_START_TESTING", "TESTING"],
    ["EVENT_EXECUTION_ERRORED", "FAILED"],
    ["EVENT_CANCEL", "CANCELLED"],
  ])],
  ["TESTING", new Map<LifecycleEventId, LifecycleState>([
    ["EVENT_TESTING_PASSED", "REVIEWING"],
    ["EVENT_TESTING_FAILED", "FAILED"],
    ["EVENT_CANCEL", "CANCELLED"],
  ])],
  ["REVIEWING", new Map<LifecycleEventId, LifecycleState>([
    ["EVENT_START_REFUTATION", "REFUTING"],
    ["EVENT_REVIEW_REJECTED", "FAILED"],
    ["EVENT_CANCEL", "CANCELLED"],
  ])],
  ["REFUTING", new Map<LifecycleEventId, LifecycleState>([
    ["EVENT_REFUTATION_RESOLVED", "VERIFIED"],
    ["EVENT_REFUTATION_UNRESOLVED", "FAILED"],
    ["EVENT_CANCEL", "CANCELLED"],
  ])],
  ["VERIFIED", new Map<LifecycleEventId, LifecycleState>([
    ["EVENT_COMPLETE", "COMPLETED"],
    ["EVENT_CANCEL", "CANCELLED"],
  ])],
  ["FAILED", new Map<LifecycleEventId, LifecycleState>([
    ["EVENT_START_RECOVERY", "RECOVERING"],
    ["EVENT_RETRY_FROM_AUTHORISED", "AUTHORISED"],
    ["EVENT_CANCEL", "CANCELLED"],
  ])],
  ["RECOVERING", new Map<LifecycleEventId, LifecycleState>([
    ["EVENT_RECOVERY_SUCCEEDED", "EXECUTING"],
    ["EVENT_RECOVERY_ABANDONED", "CANCELLED"],
    ["EVENT_CANCEL", "CANCELLED"],
  ])],
  // Terminal states have no outbound transitions.
  ["COMPLETED", new Map()],
  ["REFUSED", new Map()],
  ["CANCELLED", new Map()],
]);

// ── Failure helper ──────────────────────────────────────────────────────

function fail(
  code: TransitionFailure["refusal_code"],
  reason: string,
): TransitionFailure {
  return {
    kind: "FAILURE",
    refusal_code: code,
    reason,
    grep_marker: GREP_MARKER,
  };
}

// ── Structural validators ───────────────────────────────────────────────

function isKnownState(s: string): s is LifecycleState {
  return LIFECYCLE_STATES.includes(s as LifecycleState);
}

function isKnownEventId(id: string): id is LifecycleEventId {
  return LIFECYCLE_EVENT_IDS.includes(id as LifecycleEventId);
}

function isTerminal(s: LifecycleState): boolean {
  return TERMINAL_STATES.includes(s);
}

// ── Duplicate/stale detection ──────────────────────────────────────────

function isDuplicateEvent(record: MissionLifecycleRecord, event: LifecycleEvent): boolean {
  // Same event_id + same emitted_at_iso already present in history
  return record.history.some(
    (h) => h.event_id === event.event_id && h.emitted_at_iso === event.emitted_at_iso,
  );
}

function isStaleEvent(record: MissionLifecycleRecord, event: LifecycleEvent): boolean {
  if (record.history.length === 0) {
    return event.emitted_at_iso < record.last_event_iso;
  }
  const lastIso = record.history[record.history.length - 1].emitted_at_iso;
  return event.emitted_at_iso < lastIso;
}

// ── Authorisation gate ──────────────────────────────────────────────────

function requiresAuthorisationRef(eventId: LifecycleEventId): boolean {
  return eventId === "EVENT_AUTHORISE";
}

// ── Entry point ────────────────────────────────────────────────────────

export function applyLifecycleEvent(request: TransitionRequest): TransitionResult {
  if (!request || typeof request !== "object") {
    return fail("SLC_ILLEGAL_TRANSITION", "request object required");
  }
  const { record, event } = request;
  if (!record || typeof record !== "object") {
    return fail("SLC_ILLEGAL_TRANSITION", "record required");
  }
  if (!event || typeof event !== "object") {
    return fail("SLC_ILLEGAL_TRANSITION", "event required");
  }
  if (!isKnownState(record.current_state)) {
    return fail("SLC_UNKNOWN_STATE", `unknown current_state '${record.current_state}'`);
  }
  if (!isKnownEventId(event.event_id)) {
    return fail("SLC_UNKNOWN_EVENT", `unknown event_id '${event.event_id}'`);
  }
  if (isTerminal(record.current_state)) {
    return fail(
      "SLC_TERMINAL_STATE",
      `mission in terminal state '${record.current_state}' · no further events allowed`,
    );
  }
  if (isDuplicateEvent(record, event)) {
    return fail(
      "SLC_DUPLICATE_EVENT",
      `event '${event.event_id}' already recorded at '${event.emitted_at_iso}'`,
    );
  }
  if (isStaleEvent(record, event)) {
    return fail(
      "SLC_STALE_EVENT",
      `event timestamp '${event.emitted_at_iso}' precedes last recorded event`,
    );
  }
  if (requiresAuthorisationRef(event.event_id) && !event.authorisation_ref) {
    return fail(
      "SLC_ILLEGAL_TRANSITION",
      `event '${event.event_id}' requires authorisation_ref · none provided`,
    );
  }

  const fromState = record.current_state;
  const validTransitions = TRANSITIONS.get(fromState);
  if (!validTransitions) {
    return fail("SLC_ILLEGAL_TRANSITION", `no transitions from '${fromState}'`);
  }
  const nextState = validTransitions.get(event.event_id);
  if (!nextState) {
    return fail(
      "SLC_ILLEGAL_TRANSITION",
      `event '${event.event_id}' not valid from state '${fromState}'`,
    );
  }

  const historyEntry: LifecycleHistoryEntry = {
    from_state: fromState,
    to_state: nextState,
    event_id: event.event_id,
    emitted_at_iso: event.emitted_at_iso,
    authorisation_ref: event.authorisation_ref,
    evidence_ref: event.evidence_ref,
  };

  const next_record: MissionLifecycleRecord = {
    mission_id: record.mission_id,
    current_state: nextState,
    last_event_iso: event.emitted_at_iso,
    history: Object.freeze([...record.history, historyEntry]),
  };

  const success: TransitionSuccess = {
    kind: "SUCCESS",
    next_record,
    transition: historyEntry,
    grep_marker: GREP_MARKER,
  };
  return success;
}

// ── Convenience: create a fresh mission record ─────────────────────────

export function createMissionLifecycle(
  mission_id: string,
  created_at_iso: string,
): MissionLifecycleRecord {
  return {
    mission_id,
    current_state: "CREATED",
    last_event_iso: created_at_iso,
    history: Object.freeze([]),
  };
}
