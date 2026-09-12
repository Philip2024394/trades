// WO-WORKSTATION-01 · durable trace store
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Foundation for durable project/workspace state. Replaces the in-memory
// Map in trace-store.ts with GB-storage-backed persistence.
//
// Contract:
//   - the canonical project entity is `WorkflowTrace` (existing type)
//   - each save appends a snapshot to collection `nex1_workflow_traces`
//     keyed by trace_id
//   - `loadTrace` reads the LATEST snapshot for a given trace_id, so
//     append-only history is preserved but the read API returns "current"
//   - `applyTransitionDurable` computes the next state, saves the snapshot,
//     AND emits an AuditEvent with a hash chain link to the previous event
//   - `resolveTraceId` looks up an existing project by idempotency key,
//     or returns null if this is a genuinely new request
//   - `recoverActiveTraces` reconstructs "what projects are active" from
//     GB storage on process/workstation restart
//
// This module is additive · it does not modify or delete the existing
// in-memory `trace-store.ts`. Existing callers keep working; new callers
// (workstation UI, WO-02+ implementations) can migrate to the durable
// version incrementally.

import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import type { WorkflowTrace, Transition, AuditEntry, StageResult, StageId } from "./types";
import { canTransition } from "./state-machine";
import { computeIdempotencyKey, deriveTraceIdFromIdempotencyKey } from "./wo1-idempotency";
import { appendAuditEvent, getLastAuditEventId, type AuditEvent } from "./wo1-audit-log";

/** Idempotency-key → trace_id lookup collection.
 * We store a tiny record `{ idempotency_key, trace_id, created_at }` so a
 * repeat submission with the same key finds the existing project.
 * The trace itself lives in nex1_workflow_traces. */
const IDEMPOTENCY_LOOKUP_COLLECTION = "nex1_idempotency_lookup";

interface IdempotencyRow {
  readonly record_type: "NEX1_IDEMPOTENCY_LOOKUP";
  readonly idempotency_key: string;
  readonly trace_id: string;
  readonly created_at: string;
}

// ── Persistence primitives ────────────────────────────────────────────────

/**
 * Append a snapshot of the trace's current state to GB storage.
 * Every call adds a new row; readers use latestPerKey to find the current.
 */
export async function saveTraceDurable(trace: WorkflowTrace): Promise<void> {
  const store = getStorage();
  await store.save(COLLECTIONS.nex1_workflow_traces, trace);
}

/**
 * Load the LATEST snapshot of a trace by trace_id. Returns null if not found.
 */
export async function loadTraceDurable(trace_id: string): Promise<WorkflowTrace | null> {
  const store = getStorage();
  const rows = await store.latestPerKey<WorkflowTrace>(
    COLLECTIONS.nex1_workflow_traces,
    "trace_id",
    { where: { trace_id }, limit: 1 },
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * List every trace snapshot for a trace_id in chronological order.
 * For audit / recovery / debugging.
 */
export async function listTraceHistoryDurable(trace_id: string): Promise<WorkflowTrace[]> {
  const store = getStorage();
  return store.query<WorkflowTrace>(COLLECTIONS.nex1_workflow_traces, {
    where: { trace_id },
    limit: 10000,
    order_by: "created_at",
    order_dir: "asc",
  });
}

/**
 * Latest snapshot for every distinct trace_id. Used by the workstation
 * UI to show "your projects" after a restart.
 */
export async function listActiveTracesDurable(): Promise<WorkflowTrace[]> {
  const store = getStorage();
  return store.latestPerKey<WorkflowTrace>(COLLECTIONS.nex1_workflow_traces, "trace_id");
}

// ── Idempotency lookup ────────────────────────────────────────────────────

/**
 * Resolve a founder request to an existing trace_id if one already exists
 * (idempotency), or return null if this is a genuinely new request.
 *
 * Callers pass the same computeIdempotencyKey() input on both submission
 * and retry — the lookup guarantees the same trace_id comes back both times.
 */
export async function resolveTraceId(input: {
  readonly raw_request: string;
  readonly seed?: string;
  readonly idempotency_key?: string;
}): Promise<string | null> {
  const key = computeIdempotencyKey(input);
  const store = getStorage();
  const rows = await store.latestPerKey<IdempotencyRow>(
    IDEMPOTENCY_LOOKUP_COLLECTION,
    "idempotency_key",
    { where: { idempotency_key: key }, limit: 1 },
  );
  return rows.length > 0 ? rows[0].trace_id : null;
}

/**
 * Reserve a trace_id for a new request. Idempotent: repeated calls with
 * the same input return the same trace_id and only write the lookup row
 * once. Callers use the returned trace_id when constructing the initial
 * WorkflowTrace snapshot.
 */
export async function reserveTraceId(input: {
  readonly raw_request: string;
  readonly seed?: string;
  readonly idempotency_key?: string;
}): Promise<{ trace_id: string; new_project: boolean }> {
  const existing = await resolveTraceId(input);
  if (existing) return { trace_id: existing, new_project: false };
  const key = computeIdempotencyKey(input);
  const trace_id = deriveTraceIdFromIdempotencyKey(key);
  const row: IdempotencyRow = {
    record_type: "NEX1_IDEMPOTENCY_LOOKUP",
    idempotency_key: key,
    trace_id,
    created_at: new Date().toISOString(),
  };
  const store = getStorage();
  await store.save(IDEMPOTENCY_LOOKUP_COLLECTION, row);
  return { trace_id, new_project: true };
}

// ── State transitions with audit chain ────────────────────────────────────

/**
 * Apply a state transition to a trace, save the new snapshot to GB storage,
 * AND emit an AuditEvent linked to the previous audit event for this trace.
 *
 * Returns the updated trace and the audit event that recorded the transition.
 * Returns an error result if the transition is illegal per the state machine.
 *
 * This is the durable equivalent of `applyTransition` in trace-store.ts.
 */
export async function applyTransitionDurable(input: {
  readonly trace: WorkflowTrace;
  readonly next: StageId;
  readonly transition: Omit<Transition, "previous"> & { previous?: StageId | null };
  readonly stageResult?: StageResult;
  readonly audit?: AuditEntry;
}): Promise<
  | { ok: true; trace: WorkflowTrace; event: AuditEvent }
  | { ok: false; error: string }
> {
  const previous = input.trace.current_state;
  if (!canTransition(previous, input.next)) {
    return { ok: false, error: `illegal transition ${previous} → ${input.next}` };
  }
  const fullTransition: Transition = { ...input.transition, previous };
  const nextTrace: WorkflowTrace = {
    ...input.trace,
    current_state: input.next,
    transitions: [...input.trace.transitions, fullTransition],
    stage_statuses: input.stageResult
      ? { ...input.trace.stage_statuses, [input.next]: input.stageResult }
      : input.trace.stage_statuses,
    audit_trail: input.audit ? [...input.trace.audit_trail, input.audit] : input.trace.audit_trail,
  };
  await saveTraceDurable(nextTrace);
  const previous_event_id = await getLastAuditEventId(nextTrace.trace_id);
  const event = await appendAuditEvent({
    trace_id: nextTrace.trace_id,
    event_type: "state.transitioned",
    previous_state: previous,
    next_state: input.next,
    actor: fullTransition.actor === "founder" ? "founder"
         : fullTransition.actor === "specialist" ? "specialist"
         : fullTransition.actor === "validator" ? "validator"
         : fullTransition.actor === "nex2" ? "nex2"
         : fullTransition.actor === "nex3" ? "nex3"
         : "orchestrator",
    payload: {
      reason: fullTransition.reason,
      authorisation_state: fullTransition.authorisation_state,
      evidence_refs: fullTransition.evidence_refs ?? [],
      stage_status: input.stageResult?.status ?? null,
    },
    previous_event_id,
  });
  return { ok: true, trace: nextTrace, event };
}

// ── Recovery ──────────────────────────────────────────────────────────────

/**
 * On process/workstation restart, this returns every trace that is not in
 * a terminal state, so the caller can decide what to do (resume, verify,
 * escalate to founder, etc.).
 *
 * Terminal states: ORCHESTRATION_COMPLETED, DELIVERABLE_COMPLETED,
 * BLOCKED, REJECTED. Everything else is considered "active".
 */
export async function recoverActiveTraces(): Promise<WorkflowTrace[]> {
  const all = await listActiveTracesDurable();
  const TERMINAL: ReadonlySet<StageId> = new Set([
    "ORCHESTRATION_COMPLETED",
    "DELIVERABLE_COMPLETED",
    "BLOCKED",
    "REJECTED",
  ]);
  return all.filter((t) => !TERMINAL.has(t.current_state));
}

/**
 * Emit an AuditEvent that records a system-initiated recovery pass.
 * Recovery does NOT mutate trace state — it just records that the process
 * came back up and observed which traces were active.
 */
export async function recordRecoveryPass(input: {
  readonly recovered_trace_ids: readonly string[];
  readonly reason: string;
}): Promise<AuditEvent[]> {
  const events: AuditEvent[] = [];
  for (const trace_id of input.recovered_trace_ids) {
    const previous_event_id = await getLastAuditEventId(trace_id);
    const e = await appendAuditEvent({
      trace_id,
      event_type: "recovery.observed_active",
      previous_state: null,
      next_state: null,
      actor: "recovery",
      payload: { reason: input.reason },
      previous_event_id,
    });
    events.push(e);
  }
  return events;
}

// ── Test-only ─────────────────────────────────────────────────────────────

/**
 * Test helper: purge every WO-01 record from the active backend.
 * DANGEROUS — never call outside tests.
 * The default jsonl backend supports this via truncating the underlying
 * files; other backends must implement their own reset. In this v0.1
 * we simply leave the collections and rely on `_resetStorageForTests` +
 * disposable jsonl file paths in vitest.
 */
export function _wo1_isTestHelperInPlace(): true {
  return true;
}
