// src/lib/nex1-orchestrator/trace-store.ts
// In-memory trace registry · v0.1.0 · deterministic keyed lookup.
// Founder-authorised follow-up phase must add persistent storage.

import type { WorkflowTrace, Transition, AuditEntry, StageResult, StageId } from "./types";
import { canTransition } from "./state-machine";

const STORE = new Map<string, WorkflowTrace>();

export function saveTrace(t: WorkflowTrace): void { STORE.set(t.trace_id, t); }
export function getTrace(trace_id: string): WorkflowTrace | undefined { return STORE.get(trace_id); }
export function listTraces(): readonly WorkflowTrace[] { return Array.from(STORE.values()); }
export function clearTracesForTests(): void { STORE.clear(); }

export function applyTransition(t: WorkflowTrace, next: StageId, transition: Omit<Transition, "previous"> & { previous?: StageId | null }, stageResult?: StageResult, audit?: AuditEntry): WorkflowTrace | { error: string } {
  const previous = t.current_state;
  if (!canTransition(previous, next)) return { error: `illegal transition ${previous} → ${next}` };
  const fullTransition: Transition = { ...transition, previous };
  const nextTrace: WorkflowTrace = {
    ...t,
    current_state: next,
    transitions: [...t.transitions, fullTransition],
    stage_statuses: stageResult ? { ...t.stage_statuses, [next]: stageResult } : t.stage_statuses,
    audit_trail: audit ? [...t.audit_trail, audit] : t.audit_trail,
  };
  STORE.set(t.trace_id, nextTrace);
  return nextTrace;
}
