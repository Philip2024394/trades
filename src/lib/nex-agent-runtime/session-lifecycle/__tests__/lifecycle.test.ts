// §36-E-7 · WAVE-E7 · 2026-09-14 · session-lifecycle
// NEX bounded infrastructure · lifecycle tests · 2026-09-14

import { describe, expect, it } from "vitest";
import { applyLifecycleEvent, createMissionLifecycle } from "../lifecycle";
import type {
  LifecycleEvent,
  LifecycleEventId,
  MissionLifecycleRecord,
  TransitionFailure,
  TransitionSuccess,
} from "../lifecycle-types";
import { LIFECYCLE_STATES } from "../lifecycle-types";

// ── Time helpers · monotonic ISO timestamps ────────────────────────────

function iso(offsetSec: number): string {
  const base = new Date("2026-09-14T10:00:00.000Z").getTime();
  return new Date(base + offsetSec * 1000).toISOString();
}

function ev(
  event_id: LifecycleEventId,
  timeOffset: number,
  overrides: Partial<LifecycleEvent> = {},
): LifecycleEvent {
  return {
    event_id,
    mission_id: overrides.mission_id ?? "mission-1",
    emitted_at_iso: iso(timeOffset),
    authorisation_ref: overrides.authorisation_ref ?? null,
    evidence_ref: overrides.evidence_ref ?? null,
    ...overrides,
  };
}

function initialRecord(): MissionLifecycleRecord {
  return createMissionLifecycle("mission-1", iso(0));
}

function applyOrThrow(
  record: MissionLifecycleRecord,
  event: LifecycleEvent,
): MissionLifecycleRecord {
  const r = applyLifecycleEvent({ record, event });
  if (r.kind !== "SUCCESS") throw new Error(`unexpected refusal: ${r.refusal_code}`);
  return r.next_record;
}

// ── §A · Locked-catalogue integrity ─────────────────────────────────────

describe("§36-E-7 · E7 · §A · locked-catalogue integrity", () => {
  it("A-1 · exactly 13 states in the locked list", () => {
    expect(LIFECYCLE_STATES.length).toBe(13);
  });
  it("A-2 · initial mission starts in CREATED", () => {
    expect(initialRecord().current_state).toBe("CREATED");
  });
});

// ── §B · Normal mission (happy path) ───────────────────────────────────

describe("§36-E-7 · E7 · §B · normal mission", () => {
  it("B-1 · full happy-path traversal reaches COMPLETED via all intermediate states", () => {
    let rec = initialRecord();
    rec = applyOrThrow(rec, ev("EVENT_PREPARE", 1));
    expect(rec.current_state).toBe("PREPARED");
    rec = applyOrThrow(rec, ev("EVENT_AUTHORISE", 2, { authorisation_ref: "founder-sig-abc" }));
    expect(rec.current_state).toBe("AUTHORISED");
    rec = applyOrThrow(rec, ev("EVENT_START_EXECUTION", 3));
    expect(rec.current_state).toBe("EXECUTING");
    rec = applyOrThrow(rec, ev("EVENT_START_TESTING", 4));
    expect(rec.current_state).toBe("TESTING");
    rec = applyOrThrow(rec, ev("EVENT_TESTING_PASSED", 5));
    expect(rec.current_state).toBe("REVIEWING");
    rec = applyOrThrow(rec, ev("EVENT_START_REFUTATION", 6));
    expect(rec.current_state).toBe("REFUTING");
    rec = applyOrThrow(rec, ev("EVENT_REFUTATION_RESOLVED", 7));
    expect(rec.current_state).toBe("VERIFIED");
    rec = applyOrThrow(rec, ev("EVENT_COMPLETE", 8));
    expect(rec.current_state).toBe("COMPLETED");
    expect(rec.history.length).toBe(8);
  });
});

// ── §C · Failed test path ──────────────────────────────────────────────

describe("§36-E-7 · E7 · §C · failed test", () => {
  it("C-1 · TESTING → FAILED via EVENT_TESTING_FAILED", () => {
    let rec = initialRecord();
    rec = applyOrThrow(rec, ev("EVENT_PREPARE", 1));
    rec = applyOrThrow(rec, ev("EVENT_AUTHORISE", 2, { authorisation_ref: "x" }));
    rec = applyOrThrow(rec, ev("EVENT_START_EXECUTION", 3));
    rec = applyOrThrow(rec, ev("EVENT_START_TESTING", 4));
    rec = applyOrThrow(rec, ev("EVENT_TESTING_FAILED", 5));
    expect(rec.current_state).toBe("FAILED");
  });
});

// ── §D · Failed authoring · EXECUTING → FAILED ─────────────────────────

describe("§36-E-7 · E7 · §D · failed authoring", () => {
  it("D-1 · EXECUTING → FAILED via EVENT_EXECUTION_ERRORED", () => {
    let rec = initialRecord();
    rec = applyOrThrow(rec, ev("EVENT_PREPARE", 1));
    rec = applyOrThrow(rec, ev("EVENT_AUTHORISE", 2, { authorisation_ref: "x" }));
    rec = applyOrThrow(rec, ev("EVENT_START_EXECUTION", 3));
    rec = applyOrThrow(rec, ev("EVENT_EXECUTION_ERRORED", 4));
    expect(rec.current_state).toBe("FAILED");
  });
});

// ── §E · Review rejection ──────────────────────────────────────────────

describe("§36-E-7 · E7 · §E · review rejection", () => {
  it("E-1 · REVIEWING → FAILED via EVENT_REVIEW_REJECTED", () => {
    let rec = initialRecord();
    rec = applyOrThrow(rec, ev("EVENT_PREPARE", 1));
    rec = applyOrThrow(rec, ev("EVENT_AUTHORISE", 2, { authorisation_ref: "x" }));
    rec = applyOrThrow(rec, ev("EVENT_START_EXECUTION", 3));
    rec = applyOrThrow(rec, ev("EVENT_START_TESTING", 4));
    rec = applyOrThrow(rec, ev("EVENT_TESTING_PASSED", 5));
    rec = applyOrThrow(rec, ev("EVENT_REVIEW_REJECTED", 6));
    expect(rec.current_state).toBe("FAILED");
  });
});

// ── §F · Refutation unresolved ─────────────────────────────────────────

describe("§36-E-7 · E7 · §F · refutation unresolved", () => {
  it("F-1 · REFUTING → FAILED via EVENT_REFUTATION_UNRESOLVED", () => {
    let rec = initialRecord();
    rec = applyOrThrow(rec, ev("EVENT_PREPARE", 1));
    rec = applyOrThrow(rec, ev("EVENT_AUTHORISE", 2, { authorisation_ref: "x" }));
    rec = applyOrThrow(rec, ev("EVENT_START_EXECUTION", 3));
    rec = applyOrThrow(rec, ev("EVENT_START_TESTING", 4));
    rec = applyOrThrow(rec, ev("EVENT_TESTING_PASSED", 5));
    rec = applyOrThrow(rec, ev("EVENT_START_REFUTATION", 6));
    rec = applyOrThrow(rec, ev("EVENT_REFUTATION_UNRESOLVED", 7));
    expect(rec.current_state).toBe("FAILED");
  });
});

// ── §G · Recovery ──────────────────────────────────────────────────────

describe("§36-E-7 · E7 · §G · recovery", () => {
  it("G-1 · FAILED → RECOVERING → EXECUTING via succeeded recovery", () => {
    let rec = initialRecord();
    rec = applyOrThrow(rec, ev("EVENT_PREPARE", 1));
    rec = applyOrThrow(rec, ev("EVENT_AUTHORISE", 2, { authorisation_ref: "x" }));
    rec = applyOrThrow(rec, ev("EVENT_START_EXECUTION", 3));
    rec = applyOrThrow(rec, ev("EVENT_EXECUTION_ERRORED", 4));
    rec = applyOrThrow(rec, ev("EVENT_START_RECOVERY", 5));
    expect(rec.current_state).toBe("RECOVERING");
    rec = applyOrThrow(rec, ev("EVENT_RECOVERY_SUCCEEDED", 6));
    expect(rec.current_state).toBe("EXECUTING");
  });
});

// ── §H · Retry ─────────────────────────────────────────────────────────

describe("§36-E-7 · E7 · §H · retry", () => {
  it("H-1 · FAILED → AUTHORISED via EVENT_RETRY_FROM_AUTHORISED", () => {
    let rec = initialRecord();
    rec = applyOrThrow(rec, ev("EVENT_PREPARE", 1));
    rec = applyOrThrow(rec, ev("EVENT_AUTHORISE", 2, { authorisation_ref: "x" }));
    rec = applyOrThrow(rec, ev("EVENT_START_EXECUTION", 3));
    rec = applyOrThrow(rec, ev("EVENT_EXECUTION_ERRORED", 4));
    rec = applyOrThrow(rec, ev("EVENT_RETRY_FROM_AUTHORISED", 5));
    expect(rec.current_state).toBe("AUTHORISED");
  });
});

// ── §I · Cancellation ──────────────────────────────────────────────────

describe("§36-E-7 · E7 · §I · cancellation", () => {
  it("I-1 · cancel from EXECUTING → CANCELLED (terminal)", () => {
    let rec = initialRecord();
    rec = applyOrThrow(rec, ev("EVENT_PREPARE", 1));
    rec = applyOrThrow(rec, ev("EVENT_AUTHORISE", 2, { authorisation_ref: "x" }));
    rec = applyOrThrow(rec, ev("EVENT_START_EXECUTION", 3));
    rec = applyOrThrow(rec, ev("EVENT_CANCEL", 4));
    expect(rec.current_state).toBe("CANCELLED");
  });
  it("I-2 · cancel from RECOVERING → CANCELLED", () => {
    let rec = initialRecord();
    rec = applyOrThrow(rec, ev("EVENT_PREPARE", 1));
    rec = applyOrThrow(rec, ev("EVENT_AUTHORISE", 2, { authorisation_ref: "x" }));
    rec = applyOrThrow(rec, ev("EVENT_START_EXECUTION", 3));
    rec = applyOrThrow(rec, ev("EVENT_EXECUTION_ERRORED", 4));
    rec = applyOrThrow(rec, ev("EVENT_START_RECOVERY", 5));
    rec = applyOrThrow(rec, ev("EVENT_CANCEL", 6));
    expect(rec.current_state).toBe("CANCELLED");
  });
});

// ── §J · Duplicate event ───────────────────────────────────────────────

describe("§36-E-7 · E7 · §J · duplicate event", () => {
  it("J-1 · same event_id + same timestamp on same mission → SLC_DUPLICATE_EVENT", () => {
    let rec = initialRecord();
    rec = applyOrThrow(rec, ev("EVENT_PREPARE", 1));
    const dupEvent = ev("EVENT_PREPARE", 1); // same timestamp
    const r = applyLifecycleEvent({ record: rec, event: dupEvent }) as TransitionFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SLC_DUPLICATE_EVENT");
  });
});

// ── §K · Stale event ───────────────────────────────────────────────────

describe("§36-E-7 · E7 · §K · stale event", () => {
  it("K-1 · event timestamp earlier than last recorded → SLC_STALE_EVENT", () => {
    let rec = initialRecord();
    rec = applyOrThrow(rec, ev("EVENT_PREPARE", 10));
    const staleEvent = ev("EVENT_AUTHORISE", 5, { authorisation_ref: "x" }); // earlier
    const r = applyLifecycleEvent({ record: rec, event: staleEvent }) as TransitionFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SLC_STALE_EVENT");
  });
});

// ── §L · Illegal transition ────────────────────────────────────────────

describe("§36-E-7 · E7 · §L · illegal transition", () => {
  it("L-1 · CREATED → EVENT_COMPLETE illegal → SLC_ILLEGAL_TRANSITION", () => {
    const rec = initialRecord();
    const r = applyLifecycleEvent({ record: rec, event: ev("EVENT_COMPLETE", 1) }) as TransitionFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SLC_ILLEGAL_TRANSITION");
  });
  it("L-2 · AUTHORISE without authorisation_ref → SLC_ILLEGAL_TRANSITION", () => {
    let rec = initialRecord();
    rec = applyOrThrow(rec, ev("EVENT_PREPARE", 1));
    const badAuth = ev("EVENT_AUTHORISE", 2, { authorisation_ref: null });
    const r = applyLifecycleEvent({ record: rec, event: badAuth }) as TransitionFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SLC_ILLEGAL_TRANSITION");
  });
});

// ── §M · Corrupted / unknown inputs ────────────────────────────────────

describe("§36-E-7 · E7 · §M · corrupted lifecycle inputs", () => {
  it("M-1 · unknown state → SLC_UNKNOWN_STATE", () => {
    const bogus: MissionLifecycleRecord = {
      mission_id: "x",
      current_state: "NOT_A_STATE" as never,
      last_event_iso: iso(0),
      history: [],
    };
    const r = applyLifecycleEvent({ record: bogus, event: ev("EVENT_PREPARE", 1) }) as TransitionFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SLC_UNKNOWN_STATE");
  });
  it("M-2 · unknown event_id → SLC_UNKNOWN_EVENT", () => {
    const rec = initialRecord();
    const r = applyLifecycleEvent({
      record: rec,
      event: { ...ev("EVENT_PREPARE", 1), event_id: "NOT_AN_EVENT" as never },
    }) as TransitionFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SLC_UNKNOWN_EVENT");
  });
});

// ── §N · Completed mission receiving new work ──────────────────────────

describe("§36-E-7 · E7 · §N · completed mission receiving new work", () => {
  it("N-1 · after COMPLETED, further events refuse with SLC_TERMINAL_STATE", () => {
    let rec = initialRecord();
    rec = applyOrThrow(rec, ev("EVENT_PREPARE", 1));
    rec = applyOrThrow(rec, ev("EVENT_AUTHORISE", 2, { authorisation_ref: "x" }));
    rec = applyOrThrow(rec, ev("EVENT_START_EXECUTION", 3));
    rec = applyOrThrow(rec, ev("EVENT_START_TESTING", 4));
    rec = applyOrThrow(rec, ev("EVENT_TESTING_PASSED", 5));
    rec = applyOrThrow(rec, ev("EVENT_START_REFUTATION", 6));
    rec = applyOrThrow(rec, ev("EVENT_REFUTATION_RESOLVED", 7));
    rec = applyOrThrow(rec, ev("EVENT_COMPLETE", 8));
    expect(rec.current_state).toBe("COMPLETED");
    const r = applyLifecycleEvent({
      record: rec,
      event: ev("EVENT_START_EXECUTION", 9),
    }) as TransitionFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SLC_TERMINAL_STATE");
  });
  it("N-2 · after REFUSED, further events refuse with SLC_TERMINAL_STATE", () => {
    let rec = initialRecord();
    rec = applyOrThrow(rec, ev("EVENT_REFUSE_MISSION", 1));
    expect(rec.current_state).toBe("REFUSED");
    const r = applyLifecycleEvent({
      record: rec,
      event: ev("EVENT_PREPARE", 2),
    }) as TransitionFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("SLC_TERMINAL_STATE");
  });
});

// ── §O · Auditability ──────────────────────────────────────────────────

describe("§36-E-7 · E7 · §O · auditability after failure", () => {
  it("O-1 · history is preserved when a transition fails", () => {
    let rec = initialRecord();
    rec = applyOrThrow(rec, ev("EVENT_PREPARE", 1));
    // Attempt an illegal transition
    applyLifecycleEvent({ record: rec, event: ev("EVENT_COMPLETE", 2) });
    // Original record still shows PREPARED with 1-entry history
    expect(rec.current_state).toBe("PREPARED");
    expect(rec.history.length).toBe(1);
  });
});

// ── §P · Grep marker ───────────────────────────────────────────────────

describe("§36-E-7 · E7 · §P · grep marker", () => {
  it("P-1 · success carries §36-E-7 marker", () => {
    const rec = initialRecord();
    const r = applyLifecycleEvent({ record: rec, event: ev("EVENT_PREPARE", 1) }) as TransitionSuccess;
    expect(r.grep_marker).toBe("§36-E-7 · WAVE-E7 · 2026-09-14 · session-lifecycle");
  });
  it("P-2 · failure carries §36-E-7 marker", () => {
    const rec = initialRecord();
    const r = applyLifecycleEvent({ record: rec, event: ev("EVENT_COMPLETE", 1) });
    expect(r.grep_marker).toBe("§36-E-7 · WAVE-E7 · 2026-09-14 · session-lifecycle");
  });
});
