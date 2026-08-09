// src/lib/nex/jobs/terminal-transition.ts
//
// Wave 11 · Phase 5 · W-C-COMPANION storage-contract extension.
// Idempotent terminal-transition helper for KnowledgeJob writes.
//
// Purpose
// -------
// Every KnowledgeJob transition to a terminal status (completed · failed ·
// released) SHOULD leave an audit_log row via
// BrainStore.writeKnowledgeJobTransitionAudit so future forensics never
// needs to reverse-join through worker_jobs. See:
//
//   docs/headquarters-production-readiness/
//     WORLD-CLASS-OPS-W-C-STORAGE-CONTRACT-EXTENSION-DESIGN.md §3.5
//     WORLD-CLASS-OPS-W-C-COMPANION-SUPERVISOR-DESIGN-V2.md §4.3
//
// Idempotency contract
// --------------------
// If the current KnowledgeJob status is already `patch.status`, this
// helper is a NO-OP · no updateJob call · no audit row written · returns
// { changed: false, snapshot: current }. That is why repeated calls do
// not create uncontrolled duplicate audit rows.
//
// If the current status differs, the helper writes the fs-store snapshot
// FIRST · then attempts the audit row. Audit-row failure is logged and
// swallowed · the KJ state is authoritative and the audit is a
// belts-and-braces observability record. This matches the extractor's
// existing "non-fatal · never roll back extraction work" pattern.
//
// The helper does NOT modify F35 (see WORLD-CLASS-OPS-W-C-TIMEOUT-BUDGETS
// -DESIGN.md §5.2) · it lives in the KnowledgeJob layer above F35's
// WorkerJob-side critical section.

import { getJob, updateJob, type KnowledgeJob, type JobStatus, type UpdateJobInput } from "./fs-store";
import type { BrainStore } from "@/lib/nex/brain/storage";
import type { KnowledgeJobStatus } from "@/lib/nex/brain/types";

// Constrain to the terminal targets the audit-writer accepts.
type TerminalTargetStatus = Extract<JobStatus, "completed" | "failed">;

export interface TerminalTransitionInput {
  kjid: string;
  patch: UpdateJobInput & { status: TerminalTargetStatus };
  actor: string;
  reason?: string;
  worker_job_id?: string;
  correlation_id?: string;
  metadata?: Record<string, unknown>;
}

export interface TerminalTransitionResult {
  changed: boolean;
  snapshot: KnowledgeJob | null;
}

/**
 * Applies a terminal KnowledgeJob transition idempotently and emits a
 * paired transition audit row via the BrainStore.
 *
 * Callers pass the same BrainStore singleton they'd get from `brainStore()`
 * — dependency-injected to keep this helper testable without importing
 * the singleton accessor here (avoids a circular between fs-store and
 * brain/storage during test setup).
 */
export async function applyTerminalKnowledgeJobTransition(
  store: Pick<BrainStore, "writeKnowledgeJobTransitionAudit">,
  input: TerminalTransitionInput,
): Promise<TerminalTransitionResult> {
  const { kjid, patch, actor, reason, worker_job_id, correlation_id, metadata } = input;
  const current = await getJob(kjid);
  if (!current) {
    return { changed: false, snapshot: null };
  }
  const from_status = current.status as KnowledgeJobStatus;
  const to_status   = patch.status as KnowledgeJobStatus;
  // Idempotency: if already at the target terminal state, do nothing.
  if (from_status === to_status) {
    return { changed: false, snapshot: current };
  }
  const next = await updateJob(kjid, patch);
  if (!next) {
    return { changed: false, snapshot: null };
  }
  try {
    await store.writeKnowledgeJobTransitionAudit({
      knowledge_job_id: kjid,
      from_status,
      to_status,
      actor,
      reason,
      worker_job_id,
      correlation_id,
      metadata,
    });
  } catch (e) {
    // Non-fatal · KJ state is authoritative · audit is belts-and-braces.
    // Matches the extractor's own "non-fatal KJ sync warning" pattern.
    console.warn(
      "[terminal-transition] KJ transition audit failed:",
      e instanceof Error ? e.message : e,
    );
  }
  return { changed: true, snapshot: next };
}
