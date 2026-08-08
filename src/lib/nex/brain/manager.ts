// NEX Brain · Manager
//
// The manager is the router. It does three things:
//   1. Pulls waiting inbox items from data/knowledge-inbox/index.json
//      and enqueues one 'extract' job per item into worker_jobs.
//   2. Drives one processing cycle: runs the Knowledge Extractor to
//      completion, then runs the Quality Checker over every draft
//      that was produced. Returns a coordinated report.
//   3. Reports pool health via storage().status().
//
// The manager itself does NOT call the LLM. Workers do that. The
// manager is pure orchestration — it decides WHAT to run and WHEN,
// and never modifies its own routing rules. That's the governance
// boundary agreed in the Master Engineer review round 3.

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { brainStore, nowIso } from "./storage";
import { runKnowledgeContext } from "./workers/knowledge-context";
import { runVoiceContext } from "./workers/voice-context";
import { runLearningContext } from "./workers/learning-context";
import { runKnowledgeExtractor } from "./workers/knowledge-extractor";
import { runImageAnalyst } from "./workers/image-analyst";
import { runQualityChecker } from "./workers/quality-checker";
import { drainLlmRetryQueue, type LlmRetryOutcome } from "./workers/llm-retry";
import { emitAuditEvents, type AuditEventType } from "./audit-log";
import { primeStandbyHeartbeats, writeHeartbeat } from "./heartbeat";
import type { BrainStatus, WorkerJob, WorkerType } from "./types";
import { claimJobIfQueued, findActiveJobByInboxItemId } from "@/lib/nex/jobs/fs-store";
// Phase 11.2 · the Phase 12.1 writeback also shadow-writes into
// nex.knowledge_inbox when NEX_INBOX_SHADOW_POSTGRES=1. Prepares
// 11.3 for a simple flip without ever leaving the filesystem
// state ahead of Postgres.
import { shadowUpdateInboxStatuses } from "@/lib/nex/knowledge-inbox/pg-shadow";

// ── Audit-instrumented wrapper ──────────────────────────────────────
// Wraps a stage-runner call to emit job_started + job_completed events
// when a job is claimed, or job_started + job_failed when the runner
// throws. Both events use the actual timings observed here so the
// Worker Journal shows accurate start/end times even though both events
// are inserted at the end of the runner call.
//
// This is the P3 unblock from
// `feedback_nex_admin_centre_living_organisation_golden_rule_2026_08_07.md`:
// every avatar movement in the future Living Workshop finally has a real
// event stream to react to.
async function withAuditEvents<T extends { job: WorkerJob | null }>(
  workerType: WorkerType,
  runner: () => Promise<T>
): Promise<T> {
  const startedIso = new Date().toISOString();
  const startedMs = Date.now();
  // Phase 12.3 · heartbeat "working" BEFORE the runner starts so the
  // UI can see mid-cycle activity when it polls between iterations.
  // Best-effort · writeHeartbeat swallows its own errors.
  await writeHeartbeat({
    worker_type: workerType,
    status: "working",
    current_stage: "runner_start",
  });
  let result: T;
  try {
    result = await runner();
  } catch (err) {
    // Runner threw — we didn't get a job reference, so emit a bare
    // job_failed with the worker_type + no job_id. Not ideal but honest.
    const finishedMs = Date.now();
    emitAuditEvents([{
      worker_type: workerType,
      event_type: "job_failed",
      actor: "nex",
      latency_ms: finishedMs - startedMs,
      error_snippet: err instanceof Error ? err.message : String(err),
      at: new Date(finishedMs).toISOString(),
    }]);
    // Phase 12.3 · heartbeat "failed" so the UI distinguishes a
    // dead worker from a merely-idle one. The next cycle's prime-sweep
    // resets to standby if the worker recovers.
    await writeHeartbeat({
      worker_type: workerType,
      status: "failed",
      current_stage: "runner_throw",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  const finishedMs = Date.now();
  const job = result.job;
  if (job) {
    // Batch both events so they land in one round-trip. Both carry the
    // real observed timestamps.
    const events = [
      {
        worker_type: workerType,
        event_type: "job_started" as AuditEventType,
        actor: "nex" as const,
        job_id: job.id,
        input_ref: job.input_ref,
        at: startedIso,
      },
      {
        worker_type: workerType,
        event_type: "job_completed" as AuditEventType,
        actor: "nex" as const,
        job_id: job.id,
        input_ref: job.input_ref,
        latency_ms: finishedMs - startedMs,
        at: new Date(finishedMs).toISOString(),
      },
    ];
    emitAuditEvents(events);
  }
  // Phase 12.3 · heartbeat "standby" AFTER a successful runner call
  // (whether it processed a job or hit an empty queue). If a job was
  // handled, its id + input_ref are captured so the UI can show
  // "last completed" per worker.
  await writeHeartbeat({
    worker_type: workerType,
    status: "standby",
    current_job_id: job?.id ?? null,
    input_ref: job?.input_ref ?? null,
    current_stage: job ? "runner_completed" : "queue_empty",
  });
  return result;
}

const INBOX_ROOT = path.join(process.cwd(), "data", "knowledge-inbox");
const INBOX_INDEX = path.join(INBOX_ROOT, "index.json");

// ── Shape of an inbox item as stored by the Knowledge Inbox page ─────
//
// Kept internal to this file — we only lift the fields the manager
// cares about into worker_jobs.input_payload.

type InboxItemLite = {
  id: string;
  title: string;
  kind: "text" | "file" | "url" | "voice" | "image";
  status: "waiting" | "processing" | "review" | "processed";
  source:
    | "chatgpt-approved"
    | "claude-generated"
    | "raw-research"
    | "internet-article"
    | "needs-verification"
    | "gov-standards"
    | "customer-qa"
    | "personal-ideas";
  hash?: string;
  mimeType?: string;
  filePath?: string;               // LEGACY · local fs path (per-machine)
  objectBucket?: string;           // Phase 3a · NEX Object Storage bucket
  objectKey?: string;              // Phase 3a · NEX Object Storage key
  contentPath?: string;
  url?: string;
  createdAt: number;
};

// ── Public API ───────────────────────────────────────────────────────

// 1 · Dispatch: pull every WAITING inbox item that isn't already
// enqueued in the brain, and enqueue one Knowledge Extractor job for
// each. Idempotent: safe to call every minute.
export async function dispatchNewInboxItems(): Promise<{
  scanned: number;
  enqueued: number;
  skipped_already_queued: number;
  skipped_not_text_yet: number;
  reconciled_inbox_status: number;   // Phase 12.1 · number of inbox rows flipped `waiting`→`processing`
}> {
  const store = brainStore();
  const inboxItems = await readInboxIndex();

  // Phase 11.0 · TRANSITIONAL · fixes the pre-11.0 dispatch drift bug.
  //
  // Old behaviour: `readFsJobsSnapshot()` read from `data/nex-brain/worker_jobs.json`
  // — a filesystem file that stopped being written when Brain moved to
  // Supabase. Result: alreadyQueuedIds was populated from a 2-day-stale
  // 40-row snapshot while the real worker_jobs table on Supabase had
  // 1000+ rows. Every dispatch cycle mistook already-processed inbox
  // items for "new" and re-enqueued them (12-16× duplicate WorkerJobs
  // per inbox item · silently no-op'd by Phase 10.2 idempotency but
  // burning LLM tokens the whole time).
  //
  // New behaviour: dedup source is the ACTIVE brain store · same place
  // enqueueJob writes to · impossible to drift. Removed when Phase 11.2
  // unifies inbox + worker_jobs on the same Postgres and dispatch can
  // do a single `NOT EXISTS` join.
  const alreadyQueuedIds = new Set(
    await store.listRecentPipelineInputRefs([
      "knowledge-context",
      "voice-context",
      "learning-context",
      "knowledge-extractor",
      "image-analyst",
    ]),
  );

  let enqueued = 0;
  let skipped_already_queued = 0;
  let skipped_not_text_yet = 0;

  // Phase 12.1 · Inbox truthfulness · accumulate status transitions
  // for a single bulk writeback at the end of the cycle. Two sources
  // of transitions:
  //   1. RECONCILIATION · any item whose input_ref is already in the
  //      pipeline (from a past cycle · pre-writeback drift) but whose
  //      inbox status still says "waiting" gets flipped to "processing".
  //      This heals the historical 102-eternal-waiting picture on the
  //      first dispatch after 12.1 lands.
  //   2. PROGRESSION · every item we successfully enqueue this cycle
  //      gets flipped to "processing" so the counter drops in real time.
  const statusUpdates = new Map<string, InboxItemLite["status"]>();

  for (const item of inboxItems) {
    // Skip anything that's already processed/reviewed/processing —
    // only WAITING items should feed the pipeline.
    if (item.status !== "waiting") continue;

    if (alreadyQueuedIds.has(item.id)) {
      skipped_already_queued += 1;
      // Reconciliation · in the pipeline but inbox still says waiting.
      statusUpdates.set(item.id, "processing");
      continue;
    }

    // Stage 5 (Philip 2026-08-06): text + url → knowledge-extractor,
    // image → image-analyst. Voice/file are the next specialist workers
    // to be built; skipped for now (unchanged behaviour).
    if (
      item.kind !== "text" &&
      item.kind !== "url" &&
      item.kind !== "image"
    ) {
      skipped_not_text_yet += 1;
      continue;
    }

    // Prefetch the text content (for text items) so downstream workers
    // don't need to know the inbox path structure. Image items carry
    // filePath + mimeType instead — the image-analyst loads the bytes
    // when it actually needs them.
    let contentSnippet: string | undefined;
    if (item.kind === "text" && item.contentPath) {
      try {
        const full = await fs.readFile(path.join(INBOX_ROOT, item.contentPath), "utf8");
        contentSnippet = full;
      } catch {
        /* worker will re-attempt */
      }
    } else if (item.kind === "url" && item.url) {
      contentSnippet = item.url;
    }

    // NEW FLOW: every inbox item enters as a knowledge-context job
    // first. The Context Worker retrieves related records from the
    // corpus, then chains to voice-context → learning-context, which
    // routes the final authoring stage based on kind:
    //   text/url → knowledge-extractor
    //   image    → image-analyst (Stage 5)
    // Phase 10.2 · Fix #2B · link the Knowledge Dump queue to the
    // worker pipeline. If this inbox item has a queued KnowledgeJob
    // (created by /api/nex/knowledge-inbox/dump), CAS-claim it now so
    // the visible state moves `queued → claimed` in lockstep with the
    // WorkerJob being enqueued. The extractor closes the loop with
    // `completed` / `failed` after processing.
    const linkedKJob = await findActiveJobByInboxItemId(item.id);
    let knowledge_job_id: string | null = null;
    if (linkedKJob && linkedKJob.status === "queued") {
      const claim = await claimJobIfQueued(linkedKJob.job_id);
      if (claim.claimed) knowledge_job_id = claim.claimed.job_id;
    } else if (linkedKJob) {
      // Already claimed/processing/completed · pass the id through so
      // the extractor can still update completion, but do not double-claim.
      knowledge_job_id = linkedKJob.job_id;
    }

    await store.enqueueJob({
      worker_type: "knowledge-context",
      priority: sourcePriority(item.source),
      input_kind: "inbox_item",
      input_ref: item.id,
      input_payload: {
        source: item.source,
        title: item.title,
        kind: item.kind,
        contentPath: item.contentPath ?? null,
        content: contentSnippet ?? null,
        url: item.url ?? null,
        filePath: item.filePath ?? null,          // LEGACY
        objectBucket: item.objectBucket ?? null,  // Phase 3a · authoritative
        objectKey:    item.objectKey    ?? null,  // Phase 3a · authoritative
        mimeType: item.mimeType ?? null,
        knowledge_job_id,
      },
    });
    enqueued += 1;

    // Phase 12.1 · Inbox truthfulness · progression writeback.
    // The item is now in the pipeline · flip the inbox counter so the
    // operator sees the correct number of truly-waiting items. Bulk
    // writeback happens once at the end of the cycle.
    statusUpdates.set(item.id, "processing");

    await store.insertAudit({
      entity_type: "worker_jobs",
      entity_id: item.id,
      action: "enqueue",
      actor: "manager",
      before_state: null,
      after_state: { worker_type: "knowledge-context", source: item.source, knowledge_job_id },
      notes: `Manager enqueued context job for inbox item ${item.id}${knowledge_job_id ? ` · linked KnowledgeJob ${knowledge_job_id}` : ""}`,
    });
  }

  // Phase 12.1 · bulk-flush inbox status transitions · one read + one
  // write per cycle regardless of item count. Best-effort · a writeback
  // failure must NOT roll back the WorkerJobs that already landed.
  let reconciled_inbox_status = 0;
  if (statusUpdates.size > 0) {
    try {
      reconciled_inbox_status = await updateInboxItemStatuses(statusUpdates);
    } catch (err) {
      console.warn("[manager] inbox bulk writeback failed:", err instanceof Error ? err.message : err);
    }
  }

  return {
    scanned: inboxItems.length,
    enqueued,
    skipped_already_queued,
    skipped_not_text_yet,
    reconciled_inbox_status,
  };
}

// Phase 12.1 · bulk in-place status update for many inbox items in one
// file rewrite. Read-modify-write · preserves every field · only
// touches `status`. Returns how many rows actually changed (so callers
// can report the reconciliation count). Wrapped in its own function so
// it's easy to swap for a Postgres UPDATE when Phase 11.2 lands.
async function updateInboxItemStatuses(updates: Map<string, InboxItemLite["status"]>): Promise<number> {
  if (updates.size === 0) return 0;
  let items: InboxItemLite[];
  try {
    const raw = await fs.readFile(INBOX_INDEX, "utf8");
    const parsed = JSON.parse(raw);
    items = Array.isArray(parsed) ? (parsed as InboxItemLite[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw err;
  }
  let changed = 0;
  for (const it of items) {
    const next = updates.get(it.id);
    if (next && it.status !== next) {
      it.status = next;
      changed += 1;
    }
  }
  if (changed === 0) return 0;
  await fs.writeFile(INBOX_INDEX, JSON.stringify(items, null, 2), "utf8");
  // Phase 11.2 · shadow-write the same bulk transition to Postgres so
  // nex.knowledge_inbox tracks filesystem in real time. Fire-and-
  // forget · best-effort · never blocks the primary path.
  void shadowUpdateInboxStatuses(updates);
  return changed;
}

// 2 · Run one cycle: drain up to N of each worker in order.
// Returns a report suitable for the /brain/run-once endpoint.
//
// Five-stage drain matches the doctrine:
//   knowledge-context   → gather memory from the corpus
//   voice-context       → gather brand + voice guidance
//   learning-context    → gather past feedback (edits/approvals/rejections)
//   knowledge-extractor → author new drafts using all three bundles
//   quality-checker     → gate against the Constitution
export async function runOneCycle(options: {
  context_batch?: number;
  voice_batch?: number;
  learning_batch?: number;
  extractor_batch?: number;
  checker_batch?: number;
  retry_batch?: number;
} = {}): Promise<CycleReport> {
  const contextBatch = options.context_batch ?? 3;
  const voiceBatch = options.voice_batch ?? 3;
  const learningBatch = options.learning_batch ?? 3;
  const extractorBatch = options.extractor_batch ?? 3;
  const checkerBatch = options.checker_batch ?? 6;

  const start = Date.now();
  // Phase 12.3 · prime every worker with a fresh "standby" heartbeat
  // BEFORE the drain starts. Workers that get exercised will overwrite
  // their own row via withAuditEvents; workers whose loop breaks on
  // iteration 0 (queue empty) keep the primed row. Without this sweep,
  // the operator can't tell "queue empty" (Standby) from "worker never
  // ran" (Offline) — they'd look identical.
  await primeStandbyHeartbeats();
  const contextsAssembled: Array<{ inbox_item_id: string; related_count: number }> = [];
  const voiceGuides: Array<{ inbox_item_id: string; brand_terms: string[]; audience: string; content_class: string }> = [];
  const learningBundles: Array<{ inbox_item_id: string; examples_count: number; overall_lesson: string }> = [];
  const extracted: string[] = [];
  const extractionErrors: string[] = [];
  const checkedRecords: Array<{ record_id: string; decision: string; confidence: number }> = [];

  // 1 · Knowledge context — enqueues voice-context jobs on success
  for (let i = 0; i < contextBatch; i += 1) {
    const outcome = await withAuditEvents("knowledge-context", runKnowledgeContext);
    if (!outcome.job) break;
    if (outcome.bundle) {
      contextsAssembled.push({
        inbox_item_id: outcome.bundle.inbox_item_id,
        related_count: outcome.bundle.records.length,
      });
    }
  }

  // 2 · Voice context — enqueues learning-context jobs on success
  for (let i = 0; i < voiceBatch; i += 1) {
    const outcome = await withAuditEvents("voice-context", runVoiceContext);
    if (!outcome.job) break;
    if (outcome.guide) {
      voiceGuides.push({
        inbox_item_id: outcome.guide.inbox_item_id,
        brand_terms: outcome.guide.applicable_brand_terms.map((t) => t.key),
        audience: outcome.guide.primary_audience,
        content_class: outcome.guide.content_class,
      });
    }
  }

  // 3 · Learning context — enqueues extractor jobs on success
  for (let i = 0; i < learningBatch; i += 1) {
    const outcome = await withAuditEvents("learning-context", runLearningContext);
    if (!outcome.job) break;
    if (outcome.bundle) {
      learningBundles.push({
        inbox_item_id: outcome.bundle.inbox_item_id,
        examples_count: outcome.bundle.examples.length,
        overall_lesson: outcome.bundle.overall_lesson,
      });
    }
  }

  // 4 · Extractor — reads ALL THREE bundles from job payload
  for (let i = 0; i < extractorBatch; i += 1) {
    const outcome = await withAuditEvents("knowledge-extractor", runKnowledgeExtractor);
    if (!outcome.job) break;
    if (outcome.draftRecordIds.length > 0) {
      extracted.push(...outcome.draftRecordIds);
      // Emit knowledge_extracted per draft record — Journal shows what NEX produced.
      emitAuditEvents(outcome.draftRecordIds.map((rid) => ({
        worker_type: "knowledge-extractor" as WorkerType,
        event_type: "knowledge_extracted" as AuditEventType,
        actor: "nex" as const,
        job_id: outcome.job!.id,
        input_ref: rid,
      })));
    } else if (outcome.job) {
      extractionErrors.push(outcome.job.id);
    }
  }

  // 4b · Image Analyst — sibling of Extractor for image inbox items.
  // Uses the same batch size as the extractor since it's the same
  // stage in the pipeline.
  for (let i = 0; i < extractorBatch; i += 1) {
    const outcome = await withAuditEvents("image-analyst", runImageAnalyst);
    if (!outcome.job) break;
    if (outcome.draftRecordIds.length > 0) {
      extracted.push(...outcome.draftRecordIds);
      emitAuditEvents(outcome.draftRecordIds.map((rid) => ({
        worker_type: "image-analyst" as WorkerType,
        event_type: "knowledge_extracted" as AuditEventType,
        actor: "nex" as const,
        job_id: outcome.job!.id,
        input_ref: rid,
      })));
    } else if (outcome.job) {
      extractionErrors.push(outcome.job.id);
    }
  }

  // 5 · Checker — additionally emits the promotion/rejection event per decision
  for (let i = 0; i < checkerBatch; i += 1) {
    const outcome = await withAuditEvents("quality-checker", runQualityChecker);
    if (!outcome.job) break;
    if (outcome.report) {
      checkedRecords.push({
        record_id: outcome.job.input_ref,
        decision: outcome.report.decision,
        confidence: outcome.report.overall_confidence,
      });
      // Decision-specific event — this is what the Recent Output panel + Journal use to show promotion/rejection story.
      const decisionEvent: AuditEventType =
        outcome.report.decision === "AUTHORITATIVE" ? "record_promoted_to_authoritative" :
        outcome.report.decision === "UNDER_REVIEW"  ? "record_promoted_to_review" :
                                                      "record_rejected";
      emitAuditEvents([{
        worker_type: "quality-checker" as WorkerType,
        event_type: decisionEvent,
        actor: "nex" as const,
        job_id: outcome.job.id,
        input_ref: outcome.job.input_ref,
        confidence: outcome.report.overall_confidence,
        outcome: outcome.report.decision.toLowerCase(),
      }]);
    }
  }

  // 6 · LLM retry queue drain (Stage 3). Reclaims work that failed
  // when every provider was down. Small batch — providers still need
  // room to recover.
  const llmRetries = await drainLlmRetryQueue(options.retry_batch ?? 3);

  return {
    started_at: new Date(start).toISOString(),
    duration_ms: Date.now() - start,
    contexts_assembled: contextsAssembled,
    voice_guides: voiceGuides,
    learning_bundles: learningBundles,
    extracted_record_ids: extracted,
    extraction_errors: extractionErrors,
    checked_records: checkedRecords,
    llm_retries: llmRetries,
  };
}

// 3 · Manager status snapshot — just the brain store's report but
// including whether the manager itself is ready.
export async function managerStatus(): Promise<BrainStatus & { manager: { ready: boolean; last_dispatch_at: string | null } }> {
  const status = await brainStore().status();
  return {
    ...status,
    manager: {
      ready: true,
      last_dispatch_at: nowIso(),
    },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

// Wave 6b · dispatch reads inbox through the abstraction · location-
// transparent when NEX_INBOX_READ_BACKEND=postgres. Prior implementation
// bypassed the read-flip by calling fs.readFile directly on the
// filesystem index · this locked dispatch to the machine that had the
// inbox file. Routing through readIndex() means any worker (Vercel,
// Fly rebuilt, local) can dispatch as long as it reaches NEX Postgres.
async function readInboxIndex(): Promise<InboxItemLite[]> {
  // Lazy require to avoid inflating manager.ts's cold-start surface;
  // inbox storage pulls in the pg-shadow which pulls in pg driver.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readIndex } = require("@/lib/nex/knowledge-inbox/storage") as typeof import("@/lib/nex/knowledge-inbox/storage");
  try {
    const items = await readIndex();
    // Map full InboxItem down to the manager's lightweight shape.
    // Every field we consume must be present · undefined pass-throughs
    // are safe because InboxItemLite marks them optional.
    return items.map((i) => ({
      id: i.id,
      title: i.title,
      kind: i.kind,
      status: i.status,
      source: i.source,
      hash: i.hash,
      mimeType: i.mimeType,
      filePath: i.filePath,
      objectBucket: i.objectBucket,
      objectKey: i.objectKey,
      contentPath: i.contentPath,
      url: i.url,
      createdAt: i.createdAt,
    }));
  } catch (err) {
    console.error("[manager] readInboxIndex failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

// Phase 11.0 · `readFsJobsSnapshot()` removed. It read the pre-Supabase
// filesystem snapshot at data/nex-brain/worker_jobs.json which stopped
// being written weeks ago when Brain moved to Supabase. Dedup now goes
// through `store.listRecentPipelineInputRefs()` which reads the ACTIVE
// backend. See dispatchNewInboxItems() for the rationale.

// Priority assignment per Knowledge Source doctrine. Lower number =
// higher priority — matches the SQL `ORDER BY priority ASC`.
function sourcePriority(source: InboxItemLite["source"]): number {
  switch (source) {
    case "gov-standards":       return 1; // authoritative, run first
    case "chatgpt-approved":    return 2; // trusted-curated, fast lane
    case "claude-generated":    return 2;
    case "customer-qa":         return 3; // FAQ-driven
    case "raw-research":        return 4; // slow lane
    case "internet-article":    return 5; // cautious
    case "personal-ideas":      return 6; // sandbox
    case "needs-verification":  return 7; // parked
    default:                    return 5;
  }
}

// ── Cycle report shape ──────────────────────────────────────────────

export type CycleReport = {
  started_at: string;
  duration_ms: number;
  contexts_assembled: Array<{ inbox_item_id: string; related_count: number }>;
  voice_guides: Array<{ inbox_item_id: string; brand_terms: string[]; audience: string; content_class: string }>;
  learning_bundles: Array<{ inbox_item_id: string; examples_count: number; overall_lesson: string }>;
  extracted_record_ids: string[];
  extraction_errors: string[];
  checked_records: Array<{ record_id: string; decision: string; confidence: number }>;
  llm_retries: LlmRetryOutcome[];
};
