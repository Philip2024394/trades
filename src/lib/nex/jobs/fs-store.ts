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
// Wave 11 remediation · F2 (P0) · atomic exactly-one-winner claim at
// the database boundary. Falls back to the JSONL CAS approximation
// only when Postgres is unavailable OR the shadow row is not yet in
// place. See pg-claim.ts for the safety invariant.
import { pgAtomicClaimIfQueued } from "./pg-claim";
// Wave 11 · GROUP B · closes F19 (JSONL parse trust). validateOrDrop
// replaces `try { JSON.parse(line) as KnowledgeJob } catch { skip }`
// with a shape-checked parser that COUNTS and SIGNALS malformed lines
// rather than silently dropping them.
import { validateOrDrop } from "@/lib/nex/observability/validate";

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

/** Safe wrapper · never throws · returns null on failure.
 *
 * Wave 11 · F8 remediation · failures now increment a counter AND emit
 * a `create-job-failed` signal so operators see the failure even when
 * the caller silently drops the null return. Preserves the backward-
 * compatible return shape so existing callers continue to work.
 */
export async function createJobSafe(input: CreateJobInput): Promise<KnowledgeJob | null> {
  try {
    return await createJob(input);
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { incr } = require("@/lib/nex/observability/counters") as typeof import("@/lib/nex/observability/counters");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { emitSignal } = require("@/lib/nex/observability/signals") as typeof import("@/lib/nex/observability/signals");
    incr("jobs.create_failed");
    const code = (err as { code?: string } | null)?.code;
    emitSignal({
      subsystem: "jobs",
      kind: "create-job-failed",
      code: code ?? "unknown",
      detail: `source=${input.source} title=${(input.title ?? "").slice(0, 60)}`,
    });
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
// state change that must be exclusive: if two dispatchers or workers
// see the same queued row, only ONE should claim it.
//
// Wave 11 remediation (2026-08-10): the atomic exactly-one-winner
// invariant is now enforced at the DATABASE BOUNDARY via pgAtomicClaimIfQueued
// (see pg-claim.ts). The Postgres UPDATE with `WHERE status='queued'`
// is a native CAS — the second concurrent UPDATE returns 0 rows.
//
// The legacy JSONL CAS approximation below remains as the fallback when
// Postgres is not configured OR when the shadow row has not yet
// arrived (createJob shadow-writes are fire-and-forget). The fallback
// path preserves the historical single-dispatcher assumption and is
// documented as such.
//
// Live evidence (test claim-race.test.mjs · CR4a): the legacy JSONL
// path permits TWO concurrent claims of the same job_id to both
// succeed. The Postgres atomic path does not. Test CR4b enforces the
// exactly-one-winner invariant against the atomic path.

export type ClaimResult =
  | { claimed: KnowledgeJob }
  | { claimed: null; reason: "not_found" | "not_queued" | "raced"; observed_status?: JobStatus };

export async function claimJobIfQueued(job_id: string): Promise<ClaimResult> {
  // ── Group C · atomic claim via Postgres ── Wave 11 F2 remediation ──
  //
  // When Postgres is available AND the shadow row is present, use the
  // database-boundary atomic UPDATE. This is the exactly-one-winner
  // primitive — the safety property is no longer topology-dependent.
  const pg = await pgAtomicClaimIfQueued(job_id);

  if (pg.kind === "claimed") {
    // We won the atomic UPDATE. Now write the "claimed" snapshot to the
    // JSONL so filesystem-based readers observe the transition. This
    // append is single-writer (only the winner reaches this branch), so
    // no race can happen here. If updateJob fails (disk full, etc.) the
    // Postgres row remains the source of truth for the claim decision.
    const jsonlSnapshot = await updateJob(job_id, { status: "claimed" });
    return { claimed: jsonlSnapshot ?? pg.job };
  }

  if (pg.kind === "lost-race") {
    return {
      claimed: null,
      reason: "not_queued",
      observed_status: pg.observed_status,
    };
  }

  // pg.kind === "not-found-in-shadow" OR "pg-unavailable":
  // Fall through to the legacy JSONL CAS approximation below.
  return legacyJsonlClaimIfQueued(job_id);
}

/**
 * Legacy JSONL CAS approximation. Used only when Postgres is
 * unavailable or the shadow row hasn't landed yet. Retains the
 * documented single-dispatcher assumption — provably racy under
 * concurrency (see claim-race.test.mjs::CR4a).
 */
async function legacyJsonlClaimIfQueued(job_id: string): Promise<ClaimResult> {
  const before = await getJob(job_id);
  if (!before) return { claimed: null, reason: "not_found" };
  if (before.status !== "queued") return { claimed: null, reason: "not_queued", observed_status: before.status };

  const my = await updateJob(job_id, { status: "claimed" });
  if (!my) return { claimed: null, reason: "not_found" };

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
    emitJobsPgFallback("getJob");
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
    emitJobsPgFallback("listJobs");
  }

  let raw: string;
  try {
    raw = await fs.readFile(JOBS_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  // Wave 11 F19 · parse + validate every line · malformed lines are
  // dropped, counted, and signalled to observability. Prior "try/catch
  // skip malformed" silently hid corruption from operators.
  const latest = parseJobsJsonl(raw);

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
    emitJobsPgFallback("jobStats");
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
  // Wave 11 F19 · shared shape-checked parser · see parseJobsJsonl below.
  const latest = parseJobsJsonl(raw);
  const by_status: Record<JobStatus, number> = { received: 0, queued: 0, claimed: 0, processing: 0, completed: 0, failed: 0 };
  for (const j of latest.values()) by_status[j.status]++;
  return { total: latest.size, by_status };
}

// ── Wave 11 · GROUP B · shared JSONL parser · closes F19 ─────────
//
// Parses raw JSONL into a Map<job_id, KnowledgeJob> after validating
// every row's shape. Malformed lines (bad JSON, missing fields, wrong
// enum) are dropped from the map AND counted + signalled via
// observability so operators see corruption instead of silent drops.

const VALID_JOB_STATUSES: readonly JobStatus[] = ["received", "queued", "claimed", "processing", "completed", "failed"];
const VALID_JOB_STATUS_SET = new Set<string>(VALID_JOB_STATUSES);

function parseJobsJsonl(raw: string): Map<string, KnowledgeJob> {
  // Stage 1 · attempt JSON.parse on every non-empty line. On failure,
  // preserve the failure as a distinct sentinel so validateOrDrop
  // records a per-line reason. On success, hand the parsed object
  // through validation.
  const lines = raw.split("\n").filter((l) => l.length > 0);
  const preparsed = lines.map((line) => {
    try { return { ok: true as const, parsed: JSON.parse(line) as unknown }; }
    catch { return { ok: false as const, reason: "json-parse-failed" }; }
  });
  const { valid } = validateOrDrop<KnowledgeJob>(
    preparsed,
    (row, _idx) => {
      if (!row || (row as { ok?: boolean }).ok === false) {
        return { ok: false, reason: (row as { reason?: string })?.reason ?? "json-parse-failed" };
      }
      const parsed = (row as { parsed: unknown }).parsed;
      if (parsed == null || typeof parsed !== "object") return { ok: false, reason: "not-object" };
      const p = parsed as Record<string, unknown>;
      if (typeof p.job_id !== "string" || p.job_id.length === 0) return { ok: false, reason: "job_id-missing" };
      if (typeof p.status !== "string" || !VALID_JOB_STATUS_SET.has(p.status)) return { ok: false, reason: "invalid-status" };
      return { ok: true, value: parsed as KnowledgeJob };
    },
    { subsystem: "jobs-jsonl", counter: "validate.line_dropped", signal_kind: "line-dropped" },
  );
  const latest = new Map<string, KnowledgeJob>();
  for (const j of valid) latest.set(j.job_id, j);
  return latest;
}

// Wave 11 · GROUP B · F10 · shared fallback signal for jobs pg reads.
// A successful filesystem fallback is FALLBACK, not SUCCESS · operators
// need to see the pg outage.
function emitJobsPgFallback(code: string): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { incr } = require("@/lib/nex/observability/counters") as typeof import("@/lib/nex/observability/counters");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { emitSignal } = require("@/lib/nex/observability/signals") as typeof import("@/lib/nex/observability/signals");
  incr("jobs.pg_read_fallback");
  emitSignal({
    subsystem: "jobs",
    kind: "pg-read-fallback",
    code,
    detail: "pg returned null · using filesystem",
  });
}
