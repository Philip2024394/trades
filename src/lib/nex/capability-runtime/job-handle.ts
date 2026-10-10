// src/lib/nex/capability-runtime/job-handle.ts
//
// NEX Background Job Handle · Stage 8 · Typed seam for HarvestJob + related evidence
// Founder-authorised build-lane addition · 2026-09-23.
//
// PURPOSE: package a single job with pointers to its authoritative related
// records. Stage 8 does NOT introduce a new queue, worker pool, scheduler,
// or database. The complete durable job system already exists at:
//   · nex.harvest_job  (queued/claimed/processing/completed/failed/dead_letter)
//   · nex.harvest_worker (lease + heartbeat)
//   · nex.harvest_yield  (evidence-of-real-work · FK job_id)
//   · src/lib/nex/harvest/queue.ts + reaper.ts (writer paths)
//
// This module ADDS a small handle that ties together:
//   · Stage 7 TaskLifecycleSnapshot (what the job is + its status)
//   · Stage 7 TaskRecoveryView (retriability + dead-letter classification)
//   · Stage 5 DurableProvenanceRef pointers to related durable records
//
// It reads nothing. It writes nothing. It IS a typed accessor bundle.
//
// HARD RULES:
//   _JOB_HANDLE_IS_A_HANDLE_NOT_A_QUEUE
//   _JOB_HANDLE_PROVENANCE_POINTERS_ONLY  (no fetch helpers exported)
//   _JOB_HANDLE_YIELD_LINK_IS_DB_PROVEN   (harvest_yield.job_id FK)
//   _JOB_HANDLE_WORKER_LINK_IS_LOOSE      (via lease_owner, only meaningful when set)

import type { HarvestJob } from "../harvest/types";
import type { DurableProvenanceRef } from "./logged-fact";
import type { TaskLifecycleSnapshot, TaskRecoveryView } from "./task-lifecycle";
import { fromHarvestJob, toRecoveryView } from "./task-lifecycle";

// ═══════════════════════════════════════════════════════════════════════
// TYPE
// ═══════════════════════════════════════════════════════════════════════

/**
 * A read-only handle to a single job and its authoritative related records.
 *
 * `yield_query` is DB-authoritative because `harvest_yield.job_id` is a
 * real FK column enforced by the DB.
 *
 * `worker_activity_query` is a LOOSE correlation via lease_owner — it is
 * `null` when the job has no lease owner (nothing to correlate to). When
 * present, the pointer describes where to look for aof_agent_event rows
 * whose payload references the worker; it does not claim strict FK
 * authority. Callers must treat it as best-effort observation.
 */
export interface JobHandle {
  readonly job_id: string;
  readonly snapshot: TaskLifecycleSnapshot;
  readonly recovery: TaskRecoveryView;
  readonly yield_query: DurableProvenanceRef;
  readonly worker_activity_query: DurableProvenanceRef | null;
}

// ═══════════════════════════════════════════════════════════════════════
// CONSTRUCTOR
// ═══════════════════════════════════════════════════════════════════════

/**
 * Build a JobHandle from an authoritative HarvestJob row.
 * Pure function · no I/O · no writes.
 */
export function jobHandleFromHarvestJob(row: HarvestJob): JobHandle {
  const snapshot = fromHarvestJob(row);
  const recovery = toRecoveryView(snapshot);
  const recorded_at = snapshot.updated_at;

  const yield_query: DurableProvenanceRef = {
    kind: "durable_query",
    store: "nex.harvest_yield",
    query_signature: `harvest_yield.job_id=${row.job_id}`,
    recorded_at,
  };

  const worker_activity_query: DurableProvenanceRef | null =
    row.lease_owner === null
      ? null
      : {
          kind: "durable_query",
          store: "nex.aof_agent_event",
          query_signature: `aof_agent_event.worker_id=${row.lease_owner}`,
          recorded_at,
        };

  return {
    job_id: row.job_id,
    snapshot,
    recovery,
    yield_query,
    worker_activity_query,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// DOCTRINE LOCKS (Stage 8)
// ═══════════════════════════════════════════════════════════════════════

export const _JOB_HANDLE_IS_A_HANDLE_NOT_A_QUEUE =
  "stage_8_adds_a_typed_accessor_bundle_never_a_second_queue_scheduler_or_worker_pool";

export const _JOB_HANDLE_PROVENANCE_POINTERS_ONLY =
  "handle_carries_query_signatures_only_no_fetch_helpers_no_hidden_reads";

export const _JOB_HANDLE_YIELD_LINK_IS_DB_PROVEN =
  "harvest_yield_job_id_is_a_real_FK_column_yield_query_points_at_authoritative_state";

export const _JOB_HANDLE_WORKER_LINK_IS_LOOSE =
  "worker_activity_query_is_null_when_no_lease_owner_never_fabricated_correlation";
