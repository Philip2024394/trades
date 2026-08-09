// Wave 11 · Phase 6 · Companion Supervisor · sub-gate 6.a
//
// Pure classifier for stuck KnowledgeJob triage.
//
// Given pre-fetched worker + result evidence for a stuck KnowledgeJob,
// decides which recovery path applies:
//
//   Path A · attest-and-finalize — extractors completed AND produced
//                                  draft record IDs. Safe to close the
//                                  KJ without re-driving extraction.
//                                  Sub-gate 6.e will act on this.
//
//   Path B · review-queue routing — anything else. Recovery requires
//                                   human/operator judgement. Sub-gate
//                                   6.e/6.f will surface these to the
//                                   review queue rather than mutate.
//
// This file is intentionally pure:
//   · No I/O
//   · No BrainStore import (only types)
//   · No fs-store import
//   · No cron export
//   · No side effects
//
// The store-fetching orchestrator that turns a stuck kjid into a
// ClassifierInput comes in sub-gate 6.c. The dry-run sweep comes in
// 6.d. Live mutations come in 6.e. Cron wiring comes in 6.f.
//
// See:
//   docs/headquarters-production-readiness/
//     WORLD-CLASS-OPS-W-C-COMPANION-SUPERVISOR-DESIGN-V2.md §4.1

import type { WorkerJob, WorkerResult } from "@/lib/nex/brain/types";

export type SupervisorClassification =
  | {
      path: "A-attest";
      kjid: string;
      extractor_worker_ids: string[];
      result_ids: string[];
      draft_record_ids: string[];
    }
  | {
      path: "B-review";
      kjid: string;
      reason: "no-extractor" | "extractor-incomplete" | "no-drafts";
      extractor_worker_ids: string[];
    };

export interface ClassifierInput {
  /** The stuck KnowledgeJob's id. Included in the classification so
   *  the caller can route the result without extra bookkeeping. */
  kjid: string;
  /** ALL WorkerJobs for the KJ's inbox_item_id — the caller filters
   *  down to `worker_type === "knowledge-extractor"` internally.
   *  Passing the unfiltered set keeps the fetch shape simple: one
   *  `listWorkerJobsByInputRef([inbox_item_id])` call. */
  workers: WorkerJob[];
  /** WorkerResults for the extractor workers (fetched via
   *  `listWorkerResultsByIds(extractor.map(w => w.result_id))`). The
   *  caller may include additional results — they'll be ignored. */
  results: WorkerResult[];
}

/**
 * Classify a stuck KnowledgeJob into recovery Path A or Path B.
 *
 * Path A applies iff:
 *   1. At least one knowledge-extractor WorkerJob exists for the KJ
 *   2. Every extractor WorkerJob has status === "completed"
 *   3. At least one extractor's WorkerResult carries
 *      `output_kind === "record_draft"` AND a non-empty
 *      `output_payload.draft_record_ids: string[]`
 *
 * Any fall-through returns Path B with a specific reason so the review
 * queue entry can carry context.
 *
 * Pure · deterministic · no I/O.
 */
export function classifyStuckKJ(input: ClassifierInput): SupervisorClassification {
  const { kjid, workers, results } = input;

  const extractors = workers.filter((w) => w.worker_type === "knowledge-extractor");

  if (extractors.length === 0) {
    return {
      path: "B-review",
      kjid,
      reason: "no-extractor",
      extractor_worker_ids: [],
    };
  }

  const allCompleted = extractors.every((w) => w.status === "completed");
  if (!allCompleted) {
    return {
      path: "B-review",
      kjid,
      reason: "extractor-incomplete",
      extractor_worker_ids: extractors.map((w) => w.id),
    };
  }

  const resultIds = extractors
    .map((w) => w.result_id)
    .filter((id): id is string => Boolean(id));

  const relevantResults = results.filter((r) => resultIds.includes(r.id));

  const draftRecordIds: string[] = [];
  for (const r of relevantResults) {
    if (r.output_kind !== "record_draft") continue;
    const payload = r.output_payload as { draft_record_ids?: unknown } | null;
    const ids = payload?.draft_record_ids;
    if (Array.isArray(ids)) {
      for (const id of ids) {
        if (typeof id === "string" && id.length > 0) draftRecordIds.push(id);
      }
    }
  }

  if (draftRecordIds.length === 0) {
    return {
      path: "B-review",
      kjid,
      reason: "no-drafts",
      extractor_worker_ids: extractors.map((w) => w.id),
    };
  }

  return {
    path: "A-attest",
    kjid,
    extractor_worker_ids: extractors.map((w) => w.id),
    result_ids: resultIds,
    draft_record_ids: draftRecordIds,
  };
}
