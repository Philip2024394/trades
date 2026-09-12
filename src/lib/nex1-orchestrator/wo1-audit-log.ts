// WO-WORKSTATION-01 · audit event stream
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Append-only chain-of-custody log for workstation state transitions.
//
// Contract:
//   - every material transition of a WorkflowTrace produces one AuditEvent
//   - events are append-only in GB storage collection `nex1_audit_events`
//   - each event references the previous event for the same trace via
//     `previous_event_id`, forming a hash chain
//   - `content_hash` is sha256 over a stable serialisation of the event
//     payload — tampering detectable via replay
//   - readers reconstruct project history by streaming events in order
//
// Not implemented in this WO-01 slice: cryptographic authorisation
// signature on the event (that's WO-02 · Ed25519 founder auth). For now
// the actor is a plain string; verification comes later.

import { createHash, randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import type { StageId } from "./types";

export type AuditEventActor =
  | "orchestrator"
  | "founder"
  | "specialist"
  | "validator"
  | "nex2"
  | "nex3"
  | "system"
  | "recovery";

export interface AuditEvent {
  readonly record_type: "NEX1_AUDIT_EVENT";
  readonly event_id: string;
  readonly trace_id: string;
  readonly event_type: string;             // e.g. "trace.created", "state.transitioned", "founder.authorised"
  readonly previous_state: StageId | null;
  readonly next_state: StageId | null;
  readonly actor: AuditEventActor;
  readonly at: string;                      // ISO timestamp
  readonly payload: Record<string, unknown>;
  readonly previous_event_id: string | null;
  readonly content_hash: string;
}

/**
 * Serialise the audit-relevant fields of an event in a stable order so
 * the same input always produces the same content_hash. Excludes
 * event_id and content_hash themselves — they don't seal themselves.
 */
function canonicalise(event: Omit<AuditEvent, "event_id" | "content_hash">): string {
  const ordered = {
    record_type: event.record_type,
    trace_id: event.trace_id,
    event_type: event.event_type,
    previous_state: event.previous_state,
    next_state: event.next_state,
    actor: event.actor,
    at: event.at,
    payload: event.payload,
    previous_event_id: event.previous_event_id,
  };
  return JSON.stringify(ordered);
}

/**
 * Compute the content_hash for an event's canonical payload.
 * Exported for verification (recomputing on read to detect tampering).
 */
export function computeContentHash(event: Omit<AuditEvent, "event_id" | "content_hash">): string {
  return createHash("sha256").update(canonicalise(event)).digest("hex");
}

/**
 * Append one event to the durable audit stream.
 * Callers must supply previous_event_id from the last event for this trace —
 * `getLastAuditEventId(trace_id)` returns it (null for first event).
 */
export async function appendAuditEvent(input: {
  readonly trace_id: string;
  readonly event_type: string;
  readonly previous_state: StageId | null;
  readonly next_state: StageId | null;
  readonly actor: AuditEventActor;
  readonly payload?: Record<string, unknown>;
  readonly previous_event_id: string | null;
  /** Optional override for tests · defaults to now(). */
  readonly at?: string;
}): Promise<AuditEvent> {
  const base: Omit<AuditEvent, "event_id" | "content_hash"> = {
    record_type: "NEX1_AUDIT_EVENT",
    trace_id: input.trace_id,
    event_type: input.event_type,
    previous_state: input.previous_state,
    next_state: input.next_state,
    actor: input.actor,
    at: input.at ?? new Date().toISOString(),
    payload: input.payload ?? {},
    previous_event_id: input.previous_event_id,
  };
  const event: AuditEvent = {
    ...base,
    event_id: `evt-${randomUUID()}`,
    content_hash: computeContentHash(base),
  };
  const store = getStorage();
  await store.save(COLLECTIONS.nex1_audit_events, event);
  return event;
}

/**
 * Read every audit event for a trace in chronological order.
 * Backends may return events in any order; caller sorts by `at`.
 */
export async function readAuditStream(trace_id: string): Promise<AuditEvent[]> {
  const store = getStorage();
  const rows = await store.query<AuditEvent>(COLLECTIONS.nex1_audit_events, {
    where: { trace_id },
    limit: 10000,
    order_by: "at",
    order_dir: "asc",
  });
  return rows;
}

/**
 * Return the event_id of the most recent event for a trace, or null if
 * this is the first event.
 */
export async function getLastAuditEventId(trace_id: string): Promise<string | null> {
  const events = await readAuditStream(trace_id);
  if (events.length === 0) return null;
  return events[events.length - 1].event_id;
}

/**
 * Verify the hash chain integrity of a trace's audit stream.
 * Returns `{ ok: true }` if:
 *   - every event's content_hash matches its canonical recompute
 *   - every event's previous_event_id references an event that exists
 *     earlier in the stream
 *   - the first event has previous_event_id === null
 * Otherwise returns `{ ok: false, reason }` with the specific defect.
 */
export function verifyAuditChain(events: readonly AuditEvent[]): { ok: true } | { ok: false; reason: string; event_id?: string } {
  const seen = new Map<string, AuditEvent>();
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    // Content-hash integrity
    const recomputed = computeContentHash({
      record_type: e.record_type,
      trace_id: e.trace_id,
      event_type: e.event_type,
      previous_state: e.previous_state,
      next_state: e.next_state,
      actor: e.actor,
      at: e.at,
      payload: e.payload,
      previous_event_id: e.previous_event_id,
    });
    if (recomputed !== e.content_hash) {
      return { ok: false, reason: "content_hash mismatch — event was tampered with or corrupted", event_id: e.event_id };
    }
    // Chain integrity
    if (i === 0) {
      if (e.previous_event_id !== null) {
        return { ok: false, reason: "first event must have previous_event_id === null", event_id: e.event_id };
      }
    } else {
      if (e.previous_event_id === null) {
        return { ok: false, reason: "non-first event has previous_event_id === null — chain broken", event_id: e.event_id };
      }
      if (!seen.has(e.previous_event_id)) {
        return { ok: false, reason: "previous_event_id references an event not present earlier in the stream", event_id: e.event_id };
      }
    }
    seen.set(e.event_id, e);
  }
  return { ok: true };
}
