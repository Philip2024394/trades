// NEX Knowledge Jobs Queue · filesystem-backed store
//
// PURPOSE
// Doctrine (`feedback_nex_knowledge_ingestion_event_and_truth_surface_2026_08_07.md`)
// requires every knowledge dump to create a trackable job event · NOT rely on
// workers tailing the filesystem. This store gives us the job event layer
// without waiting for a full Supabase migration.
//
// SCHEMA (per Knowledge Ingestion Event Doctrine · locked)
//   job_id · source · owner · created_at · knowledge_type · target_brains
//   status · progress · completion_result
//
// STATES
//   received → queued → claimed → processing → completed
//                                            → failed
//
// STORAGE
// JSONL append-only at `data/nex-jobs/jobs.jsonl` — one line = one job snapshot.
// Latest snapshot per job_id wins on read. This gives us free audit trail
// (every state change is a new line) with a trivial "latest state" query.
//
// Doctrine cross-refs:
// · feedback_nex_knowledge_ingestion_event_and_truth_surface_2026_08_07.md
// · project_nex_backend_three_layers_event_bus_and_intelligence_centre_2026_08_07.md
// · project_nex_phase8_backend_build_starts_2026_08_07.md

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { emitEventSafe } from "../events/fs-store";
// Phase 11.2 · shadow-write to nex.knowledge_dump_jobs. Gated on
// NEX_INBOX_SHADOW_POSTGRES=1 · best-effort · never throws.
import { shadowUpsertJob } from "./pg-shadow";
// Wave 6b · Postgres read-flip capability · gated on
// NEX_INBOX_READ_BACKEND=postgres · falls back to filesystem on error.
import {
  isPostgresReadEnabled,
  listJobsFromPostgres,
  getJobFromPostgres,
  jobStatsFromPostgres,
} from "./pg-reads";

// ── Paths ──────────────────────────────────────────────────────────

const ROOT = path.join(process.cwd(), "data", "nex-jobs");
const JOBS_FILE = path.join(ROOT, "jobs.jsonl");

async function ensureDir(): Promise<void> {
  await fs.mkdir(ROOT, { recursive: true });
}

// ── Job type ──────────────────────────────────────────────────────

export type JobStatus = "received" | "queued" | "claimed" | "processing" | "completed" | "failed";

export type KnowledgeJob = {
  job_id: string;
  source: string;                  // "Knowledge Dump" · "Upload" · "Cron" · "Retry" · "Boss Q&A"
  owner: string;                   // admin username · "system"
  created_at: string;              // ISO
  knowledge_type: string | null;   // "hq-doctrine" · "trade-staircases" · null if unclassified
  target_brains: string[];         // derived from knowledge_type
  status: JobStatus;
  progress: number;                // 0-100
  completion_result: {
    memories_added?: number;
    brains_linked?: string[];
    error?: string;
  } | null;
  // Linkage back to source item (e.g. inbox item id)
  inbox_item_id: string | null;
  // Human-readable title for the timeline
  title: string | null;
  // Content size (bytes) for capacity planning
  content_length: number;
  // Latest update time — snapshot log means we compute this from timestamp
  updated_at: string;
};

export type CreateJobInput = {
  source: string;
  owner: string;
  knowledge_type?: string | null;
  target_brains?: string[];
  inbox_item_id?: string | null;
  title?: string | null;
  content_length?: number;
};

// ── Create · append snapshot with status "received" then "queued" ──

/**
 * Create a new job. Returns the job_id. Emits Intelligence Events for
 * the received → queued transition immediately so timeline reflects it.
 * Fire-and-forget failure semantics · never throws to callers using the safe wrapper.
 */
export async function createJob(input: CreateJobInput): Promise<KnowledgeJob> {
  const job_id = randomUUID();
  const now = new Date().toISOString();
  const job: KnowledgeJob = {
    job_id,
    source: input.source,
    owner: input.owner,
    created_at: now,
    knowledge_type: input.knowledge_type ?? null,
    target_brains: input.target_brains ?? [],
    status: "queued",              // immediately queued · workers can claim
    progress: 0,
    completion_result: null,
    inbox_item_id: input.inbox_item_id ?? null,
    title: input.title ?? null,
    content_length: input.content_length ?? 0,
    updated_at: now,
  };
  await ensureDir();
  await fs.appendFile(JOBS_FILE, JSON.stringify(job) + "\n", "utf8");
  // Phase 11.2 · shadow-write to Postgres.
  void shadowUpsertJob(job);

  // Emit corresponding Intelligence Events so timeline shows the flow.
  emitEventSafe({
    event_type: "knowledge_job_queued",
    source: "system",
    actor_id: input.owner,
    related_job: job_id,
    related_department: "operations",
    outcome: "pending",
    payload: {
      inbox_item_id: input.inbox_item_id,
      knowledge_type: input.knowledge_type,
      target_brains: input.target_brains,
      title: input.title,
      content_length: input.content_length,
    },
  });
  return job;
}

/** Safe wrapper · never throws · returns null on failure. */
export async function createJobSafe(input: CreateJobInput): Promise<KnowledgeJob | null> {
  try {
    return await createJob(input);
  } catch (err) {
    console.warn("[nex-jobs] createJob failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Update · append new snapshot with same job_id ─────────────────

export type UpdateJobInput = {
  status?: JobStatus;
  progress?: number;
  completion_result?: KnowledgeJob["completion_result"];
};

// ── Compare-and-swap claim · Phase 10.2 · Fix #2B ─────────────────
//
// The Knowledge Dump queue's `queued → claimed` transition is the only
// state change that must be exclusive: if two dispatchers see the same
// queued row, only ONE should claim it. Everything else (progress
// updates, completion) is single-writer by construction.
//
// Since the store is JSONL-append, a strict CAS needs a file lock. We
// approximate: read current state, only append if status==='queued',
// then re-read and confirm our snapshot is the latest for that job_id.
// Whoever's snapshot lands last "wins" the visible-state — the loser
// sees the winner's snapshot and returns null. Adequate for the
// single-cron-instance dispatcher model this queue runs under.

export type ClaimResult =
  | { claimed: KnowledgeJob }
  | { claimed: null; reason: "not_found" | "not_queued" | "raced"; observed_status?: JobStatus };

export async function claimJobIfQueued(job_id: string): Promise<ClaimResult> {
  const before = await getJob(job_id);
  if (!before) return { claimed: null, reason: "not_found" };
  if (before.status !== "queued") return { claimed: null, reason: "not_queued", observed_status: before.status };

  const my = await updateJob(job_id, { status: "claimed" });
  if (!my) return { claimed: null, reason: "not_found" };

  // Verify · re-read latest snapshot. If someone else appended after us,
  // their snapshot is now visible-state and we lost the race.
  const latest = await getJob(job_id);
  if (!latest || latest.updated_at !== my.updated_at || latest.status !== "claimed") {
    return { claimed: null, reason: "raced", observed_status: latest?.status };
  }
  return { claimed: my };
}

// Look up a queued/claimed/processing Knowledge Dump job by the inbox
// item it was created from. Used by dispatchNewInboxItems to link a
// WorkerJob back to the KnowledgeJob that spawned it.
export async function findActiveJobByInboxItemId(
  inbox_item_id: string,
): Promise<KnowledgeJob | null> {
  const jobs = await listJobs({ limit: 500, include_all_states: false });
  return jobs.find((j) => j.inbox_item_id === inbox_item_id) ?? null;
}

// Fetch any job (any status) by inbox_item_id — used by the extractor
// to close the loop after the WorkerJob completes / fails.
export async function findJobByInboxItemId(inbox_item_id: string): Promise<KnowledgeJob | null> {
  const jobs = await listJobs({ limit: 500, include_all_states: true });
  return jobs.find((j) => j.inbox_item_id === inbox_item_id) ?? null;
}

/** Append a state-change snapshot for an existing job. */
export async function updateJob(job_id: string, patch: UpdateJobInput): Promise<KnowledgeJob | null> {
  const current = await getJob(job_id);
  if (!current) return null;
  const now = new Date().toISOString();
  const next: KnowledgeJob = {
    ...current,
    status: patch.status ?? current.status,
    progress: patch.progress ?? current.progress,
    completion_result: patch.completion_result ?? current.completion_result,
    updated_at: now,
  };
  await ensureDir();
  await fs.appendFile(JOBS_FILE, JSON.stringify(next) + "\n", "utf8");
  // Phase 11.2 · shadow-write latest snapshot to Postgres.
  void shadowUpsertJob(next);

  // Emit corresponding lifecycle event
  const eventType =
    patch.status === "claimed"    ? "knowledge_job_claimed" :
    patch.status === "processing" ? "knowledge_job_processing" :
    patch.status === "completed"  ? "knowledge_job_completed" :
    patch.status === "failed"     ? "knowledge_job_failed" :
                                    "knowledge_job_updated";
  emitEventSafe({
    event_type: eventType,
    source: "worker",
    related_job: job_id,
    related_department: "operations",
    outcome: patch.status === "completed" ? "success" : patch.status === "failed" ? "failure" : "pending",
    payload: {
      status: next.status,
      progress: next.progress,
      completion_result: next.completion_result,
    },
  });
  return next;
}

// ── Read · latest snapshot per job_id wins ────────────────────────

export async function getJob(job_id: string): Promise<KnowledgeJob | null> {
  // Wave 6b · Postgres read path (gated). Falls back to filesystem on
  // any Postgres error so a DB outage never bricks the jobs UI.
  if (isPostgresReadEnabled()) {
    const pg = await getJobFromPostgres(job_id);
    if (pg && "found" in pg && pg.found === false) return null;     // definitive not-found
    if (pg && !("found" in pg)) return pg as KnowledgeJob;           // hit
    // pg === null means Postgres unreachable · fall through to filesystem
    console.warn("[jobs] Postgres getJob returned null · falling back to filesystem");
  }
  const jobs = await listJobs({ include_all_states: true, limit: 500 });
  return jobs.find((j) => j.job_id === job_id) ?? null;
}

export type ListJobsOptions = {
  limit?: number;                  // default 50 · max 500
  status?: JobStatus;              // filter to one state
  since_ms?: number;               // trailing window
  include_all_states?: boolean;    // default false: excludes completed+failed
};

export async function listJobs(options: ListJobsOptions = {}): Promise<KnowledgeJob[]> {
  const limit = Math.min(Math.max(1, options.limit ?? 50), 500);
  const sinceMs = options.since_ms ?? 7 * 24 * 60 * 60 * 1000;   // default 7 days
  const sinceIso = new Date(Date.now() - sinceMs).toISOString();

  // Wave 6b · Postgres read path (gated). Falls back to filesystem on
  // any Postgres error so a DB outage never bricks the jobs UI.
  if (isPostgresReadEnabled()) {
    const pgJobs = await listJobsFromPostgres({
      limit, status: options.status, since_ms: sinceMs,
      include_all_states: options.include_all_states,
    });
    if (pgJobs !== null) return pgJobs;
    console.warn("[jobs] Postgres listJobs returned null · falling back to filesystem");
  }

  let raw: string;
  try {
    raw = await fs.readFile(JOBS_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  // Map job_id → latest snapshot. Iterate in file order so latest wins.
  const latest = new Map<string, KnowledgeJob>();
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try {
      const j = JSON.parse(line) as KnowledgeJob;
      latest.set(j.job_id, j);
    } catch { /* skip malformed */ }
  }

  // Filter + sort
  const all = [...latest.values()]
    .filter((j) => j.updated_at >= sinceIso)
    .filter((j) => (options.status ? j.status === options.status : true))
    .filter((j) => options.include_all_states || (j.status !== "completed" && j.status !== "failed"))
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, limit);
  return all;
}

/** Counters for the Factory Header · reads whole file · use sparingly. */
export async function jobStats(): Promise<{ total: number; by_status: Record<JobStatus, number> }> {
  // Wave 6b · Postgres read path (gated). Falls back to filesystem on error.
  if (isPostgresReadEnabled()) {
    const pgStats = await jobStatsFromPostgres();
    if (pgStats !== null) return pgStats;
    console.warn("[jobs] Postgres jobStats returned null · falling back to filesystem");
  }
  let raw: string;
  try {
    raw = await fs.readFile(JOBS_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { total: 0, by_status: { received: 0, queued: 0, claimed: 0, processing: 0, completed: 0, failed: 0 } };
    }
    throw err;
  }
  const latest = new Map<string, KnowledgeJob>();
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try {
      const j = JSON.parse(line) as KnowledgeJob;
      latest.set(j.job_id, j);
    } catch { /* skip */ }
  }
  const by_status: Record<JobStatus, number> = { received: 0, queued: 0, claimed: 0, processing: 0, completed: 0, failed: 0 };
  for (const j of latest.values()) by_status[j.status]++;
  return { total: latest.size, by_status };
}
