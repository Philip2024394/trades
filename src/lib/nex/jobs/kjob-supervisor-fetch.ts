// Wave 11 · Phase 6 · Companion Supervisor · sub-gate 6.c
//
// ⚠️  DEPRECATED · 2026-08-10 (Philip · Wave 2 · NEW-1 reconciliation Option C)
//
// The authorised Phase 6 orchestrator lives in `supervisor.ts` and combines
// classification (via the RETAINED pure classifier in `./kjob-supervisor.ts`),
// action (Path A attest / Path B review-queue), advisory-lock guarded cron,
// audit trail, and metrics — per the approved 972-line Phase 6 design.
//
// Kept in-tree pending Philip's explicit removal authorisation because:
//   1. The narrow reader interfaces (BrainStoreReader/FsStoreReader) are a
//      useful reference for future dry-run tooling; supervisor.ts's
//      SupervisorStore/SupervisorKjStore are less strict.
//   2. `classifyAllClaimedStuckKJs` returns a StuckSweepReport shape that a
//      future `--dry-run` operator flag on /api/nex/brain/supervisor-sweep
//      could reuse without re-implementation.
//   3. Grep for consumers before delete: currently zero import sites outside
//      this file's own comment.
//
// **DO NOT import from this file in new code.** Consume `supervisor.ts` and
// `./kjob-supervisor.ts` instead. If a capability here is genuinely required,
// extract it into supervisor.ts under the design's authorship rules rather
// than growing two parallel orchestrators again.
//
// See:
//   docs/headquarters-production-readiness/W-C-COMPANION-PHASE-6-DESIGN.md §22 NEW-1
//
// ── Original description ─────────────────────────────────────────────
// Store-fetching orchestrator for the KJ supervisor.
//
// Takes a stuck KnowledgeJob id and, via read-only calls to BrainStore
// and fs-store, resolves a ClassifierInput the pure classifier
// (kjob-supervisor.ts) can decide on. Every entrypoint here is
// read-only — no updateJob, no writeKnowledgeJobTransitionAudit, no
// cron. Live mutations are locked behind sub-gate 6.e.
//
// Layering:
//   sub-gate 6.a  pure classifier      → kjob-supervisor.ts
//   sub-gate 6.c  store-fetch resolver → THIS FILE (read-only)
//   sub-gate 6.d  dry-run sweep report → separate script
//   sub-gate 6.e  live attest sweep    → LOCKED (mutations)
//   sub-gate 6.f  cron wiring          → LOCKED
//   sub-gate 6.g  production activate  → LOCKED
//
// Dependency injection:
//   The functions take `brainStore` (implementing a narrow BrainStore
//   subset · `BrainStoreReader`) and `fsStore` (implementing a narrow
//   `FsStoreReader`). This keeps the orchestrator testable with pure
//   in-memory stubs · no real store touched by unit tests.
//
// See:
//   docs/headquarters-production-readiness/
//     WORLD-CLASS-OPS-W-C-COMPANION-SUPERVISOR-DESIGN-V2.md §4.1

import { classifyStuckKJ, type ClassifierInput, type SupervisorClassification } from "./kjob-supervisor";
import type { KnowledgeJob, JobStatus as KJStatus } from "./fs-store";
import type { WorkerJob, WorkerResult } from "@/lib/nex/brain/types";

/** Narrow BrainStore subset the orchestrator uses. Full BrainStore
 *  interface is much bigger · limiting to what we actually call keeps
 *  the test-side stub trivial and prevents accidental over-reach into
 *  mutation methods. */
export interface BrainStoreReader {
  listWorkerJobsByInputRef(
    input_refs: string[],
    opts?: { limit?: number },
  ): Promise<WorkerJob[]>;
  listWorkerResultsByIds(
    result_ids: string[],
    opts?: { limit?: number },
  ): Promise<WorkerResult[]>;
}

/** Narrow fs-store subset the orchestrator uses. Same reasoning as
 *  BrainStoreReader. Includes only the read paths. */
export interface FsStoreReader {
  getJob(job_id: string): Promise<KnowledgeJob | null>;
  listJobs(options?: {
    limit?: number;
    status?: KJStatus;
    since_ms?: number;
    include_all_states?: boolean;
  }): Promise<KnowledgeJob[]>;
}

/** Reason a resolveClassifierInput() call returned null. Distinguishes
 *  "KJ missing" from "KJ has no inbox_item_id linkage" so 6.d's report
 *  can attribute the skip precisely. */
export type ResolveSkip =
  | { kjid: string; skipped: "kj-not-found" }
  | { kjid: string; skipped: "no-inbox-item-id" };

/**
 * Resolve a single kjid to a ClassifierInput via 3 read-only fetches:
 *   1. fsStore.getJob(kjid)                                → the KJ
 *   2. brainStore.listWorkerJobsByInputRef([inbox_item_id]) → workers
 *   3. brainStore.listWorkerResultsByIds(extractor.result_ids) → results
 *
 * Returns the ClassifierInput on success, or a ResolveSkip explaining
 * why the KJ can't be classified. Never throws for expected absence —
 * lets the caller aggregate skips without try/catch noise.
 */
export async function resolveClassifierInput(
  kjid: string,
  brainStore: BrainStoreReader,
  fsStore: FsStoreReader,
): Promise<{ input: ClassifierInput } | { skip: ResolveSkip }> {
  const kj = await fsStore.getJob(kjid);
  if (!kj) return { skip: { kjid, skipped: "kj-not-found" } };
  if (!kj.inbox_item_id) return { skip: { kjid, skipped: "no-inbox-item-id" } };

  const workers = await brainStore.listWorkerJobsByInputRef([kj.inbox_item_id]);

  const resultIds = workers
    .filter((w) => w.worker_type === "knowledge-extractor")
    .map((w) => w.result_id)
    .filter((id): id is string => Boolean(id));

  const results = resultIds.length > 0
    ? await brainStore.listWorkerResultsByIds(resultIds)
    : [];

  return { input: { kjid, workers, results } };
}

/**
 * Convenience: resolve + classify a single kjid.
 * Returns the SupervisorClassification, or a ResolveSkip if the KJ
 * can't be resolved. Read-only.
 */
export async function classifyOneStuckKJ(
  kjid: string,
  brainStore: BrainStoreReader,
  fsStore: FsStoreReader,
): Promise<SupervisorClassification | ResolveSkip> {
  const r = await resolveClassifierInput(kjid, brainStore, fsStore);
  if ("skip" in r) return r.skip;
  return classifyStuckKJ(r.input);
}

/** Batch classification result — one entry per input kjid, preserving
 *  order. Callers can partition by `path` for review-queue routing. */
export type BatchClassifyResult =
  | { kjid: string; classified: SupervisorClassification }
  | { kjid: string; skipped: ResolveSkip["skipped"] };

/**
 * Classify a batch of kjids. Each kjid is resolved and classified
 * independently — one failure does not abort the batch. Order preserved.
 * Read-only.
 */
export async function classifyManyStuckKJs(
  kjids: string[],
  brainStore: BrainStoreReader,
  fsStore: FsStoreReader,
): Promise<BatchClassifyResult[]> {
  const out: BatchClassifyResult[] = [];
  for (const kjid of kjids) {
    const r = await classifyOneStuckKJ(kjid, brainStore, fsStore);
    if ("path" in r) {
      out.push({ kjid, classified: r });
    } else {
      out.push({ kjid, skipped: r.skipped });
    }
  }
  return out;
}

/** Options for the "all stuck claimed KJs" convenience. Defaults match
 *  the V2 design: status='claimed' AND updated_at older than 30 min. */
export interface ListClaimedStuckOptions {
  /** How long a KJ must have been in `claimed` status before it counts
   *  as stuck. Defaults to 30 minutes per V2 §4.1 trigger. */
  staleMinutes?: number;
  /** Upper bound on returned KJs — cheap guard against unexpectedly
   *  large sweeps. Defaults to 500 (matches fs-store listJobs max). */
  limit?: number;
  /** Now-clock override for deterministic tests. */
  now?: Date;
}

/**
 * Return every fs-store KJ with status='claimed' whose updated_at is
 * older than `staleMinutes` ago. Read-only. Used by the sweep sub-gates.
 */
export async function listClaimedStuckKJs(
  fsStore: FsStoreReader,
  opts: ListClaimedStuckOptions = {},
): Promise<KnowledgeJob[]> {
  const staleMinutes = opts.staleMinutes ?? 30;
  const limit = opts.limit ?? 500;
  const now = opts.now ?? new Date();
  const cutoffIso = new Date(now.getTime() - staleMinutes * 60 * 1000).toISOString();
  // Ask for a big window so we don't miss KJs whose updated_at is old
  // but still within the freshness window fs-store defaults enforce.
  const jobs = await fsStore.listJobs({
    status: "claimed",
    limit,
    include_all_states: true,
    // 30 days trailing window — well beyond the 30-minute stale cutoff.
    since_ms: 30 * 24 * 60 * 60 * 1000,
  });
  return jobs.filter((j) => j.updated_at <= cutoffIso);
}

/** Summary shape returned by classifyAllClaimedStuckKJs() — the
 *  "dry-run sweep report" input · sub-gate 6.d will render this into
 *  operator-facing text. */
export interface StuckSweepReport {
  /** Wall-clock generation timestamp (ISO). */
  generated_at: string;
  /** Stale-minutes threshold used to select KJs. */
  stale_minutes: number;
  /** Total stuck KJs discovered. */
  total_stuck: number;
  /** Per-classification counts. */
  counts: {
    "A-attest": number;
    "B-review": number;
    "kj-not-found": number;
    "no-inbox-item-id": number;
  };
  /** Per-KJ detail · preserved order of discovery. */
  entries: BatchClassifyResult[];
}

/**
 * Read-only sweep: list every stuck claimed KJ, classify each, and
 * return a StuckSweepReport. No mutation. Sub-gate 6.d turns this into
 * an operator-visible report. Sub-gate 6.e will read the same shape and
 * act on the Path-A subset.
 */
export async function classifyAllClaimedStuckKJs(
  brainStore: BrainStoreReader,
  fsStore: FsStoreReader,
  opts: ListClaimedStuckOptions = {},
): Promise<StuckSweepReport> {
  const now = opts.now ?? new Date();
  const staleMinutes = opts.staleMinutes ?? 30;
  const stuck = await listClaimedStuckKJs(fsStore, opts);
  const entries = await classifyManyStuckKJs(
    stuck.map((j) => j.job_id),
    brainStore,
    fsStore,
  );

  const counts: StuckSweepReport["counts"] = {
    "A-attest": 0,
    "B-review": 0,
    "kj-not-found": 0,
    "no-inbox-item-id": 0,
  };
  for (const e of entries) {
    if ("classified" in e) counts[e.classified.path]++;
    else counts[e.skipped]++;
  }

  return {
    generated_at: now.toISOString(),
    stale_minutes: staleMinutes,
    total_stuck: stuck.length,
    counts,
    entries,
  };
}
