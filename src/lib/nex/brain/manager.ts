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
import { runKnowledgeExtractor } from "./workers/knowledge-extractor";
import { runQualityChecker } from "./workers/quality-checker";
import type { BrainStatus, WorkerJob } from "./types";

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
  contentPath?: string;
  filePath?: string;
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
}> {
  const store = brainStore();
  const inboxItems = await readInboxIndex();

  // Which inbox_item_ids already have an extractor job? Cheap dedup.
  const existingJobs = await Promise.all(
    inboxItems.map(async (it) =>
      (await store.countJobs("knowledge-extractor", "waiting")) +
      (await store.countJobs("knowledge-extractor", "assigned")) +
      (await store.countJobs("knowledge-extractor", "running")) +
      (await store.countJobs("knowledge-extractor", "completed"))
    )
  );
  // The above is coarse — a proper implementation queries by input_ref.
  // For the fs backend we just walk the jobs table directly.
  const jobRows = await readFsJobsSnapshot();
  const alreadyQueuedIds = new Set(
    jobRows
      .filter((j) => j.worker_type === "knowledge-extractor")
      .map((j) => j.input_ref)
  );

  let enqueued = 0;
  let skipped_already_queued = 0;
  let skipped_not_text_yet = 0;

  for (const item of inboxItems) {
    // Skip anything that's already processed/reviewed/processing —
    // only WAITING items should feed the pipeline.
    if (item.status !== "waiting") continue;

    if (alreadyQueuedIds.has(item.id)) {
      skipped_already_queued += 1;
      continue;
    }

    // Only text + url are handled by the Knowledge Extractor in Phase 1.
    // Voice/image/file are queued for their specialist workers in
    // Phase 2. We simply skip them here without failing.
    if (item.kind !== "text" && item.kind !== "url") {
      skipped_not_text_yet += 1;
      continue;
    }

    // Prefetch the content so the extractor doesn't need to know the
    // inbox path structure — keeps the extractor decoupled from the
    // Knowledge Inbox storage details.
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

    await store.enqueueJob({
      worker_type: "knowledge-extractor",
      priority: sourcePriority(item.source),
      input_kind: "inbox_item",
      input_ref: item.id,
      input_payload: {
        source: item.source,
        title: item.title,
        contentPath: item.contentPath ?? null,
        content: contentSnippet ?? null,
        url: item.url ?? null,
      },
    });
    enqueued += 1;

    await store.insertAudit({
      entity_type: "worker_jobs",
      entity_id: item.id,
      action: "enqueue",
      actor: "manager",
      before_state: null,
      after_state: { worker_type: "knowledge-extractor", source: item.source },
      notes: `Manager enqueued extractor job for inbox item ${item.id}`,
    });
  }

  return {
    scanned: inboxItems.length,
    enqueued,
    skipped_already_queued,
    skipped_not_text_yet,
  };
}

// 2 · Run one cycle: drain up to N extractor jobs, then drain up to N
// checker jobs. Returns a report suitable for the /brain/run-once
// endpoint. This is what a cron trigger calls every minute.
export async function runOneCycle(options: {
  extractor_batch?: number;
  checker_batch?: number;
} = {}): Promise<CycleReport> {
  const extractorBatch = options.extractor_batch ?? 3;
  const checkerBatch = options.checker_batch ?? 6;

  const start = Date.now();
  const extracted: string[] = [];
  const extractionErrors: string[] = [];
  const checkedRecords: Array<{ record_id: string; decision: string; confidence: number }> = [];

  // Run extractor batch
  for (let i = 0; i < extractorBatch; i += 1) {
    const outcome = await runKnowledgeExtractor();
    if (!outcome.job) break; // queue drained
    if (outcome.draftRecordIds.length > 0) {
      extracted.push(...outcome.draftRecordIds);
    } else if (outcome.job) {
      extractionErrors.push(outcome.job.id);
    }
  }

  // Run checker batch
  for (let i = 0; i < checkerBatch; i += 1) {
    const outcome = await runQualityChecker();
    if (!outcome.job) break;
    if (outcome.report) {
      checkedRecords.push({
        record_id: outcome.job.input_ref,
        decision: outcome.report.decision,
        confidence: outcome.report.overall_confidence,
      });
    }
  }

  return {
    started_at: new Date(start).toISOString(),
    duration_ms: Date.now() - start,
    extracted_record_ids: extracted,
    extraction_errors: extractionErrors,
    checked_records: checkedRecords,
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

async function readInboxIndex(): Promise<InboxItemLite[]> {
  try {
    const raw = await fs.readFile(INBOX_INDEX, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as InboxItemLite[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

// The fs backend keeps jobs at data/nex-brain/worker_jobs.json. We
// need a direct snapshot for the "already queued" dedup check because
// the store interface doesn't expose "list all jobs" (yet).
async function readFsJobsSnapshot(): Promise<WorkerJob[]> {
  const p = path.join(process.cwd(), "data", "nex-brain", "worker_jobs.json");
  try {
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WorkerJob[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

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
  extracted_record_ids: string[];
  extraction_errors: string[];
  checked_records: Array<{ record_id: string; decision: string; confidence: number }>;
};
