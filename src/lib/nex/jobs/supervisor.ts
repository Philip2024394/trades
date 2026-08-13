// src/lib/nex/jobs/supervisor.ts
//
// Wave 2 · Phase 6 · W-C-COMPANION supervisor.
// Governed by: docs/headquarters-production-readiness/W-C-COMPANION-PHASE-6-DESIGN.md
//
// Ships Path A (attest sweep) + Path B (review queue). Path C already lives in
// `applyTerminalKnowledgeJobTransition` and fires from the extractor — this module
// does NOT re-implement it.
//
// Dependency-injected so contract tests can swap fakes. Route handler wires the
// real singletons.
//
// Absolute non-goals (per design §0):
//   · No modifications to F35, terminal-transition helper, fs-store schema.
//   · No modification to any of the 10 preserved real stuck KJs (only burner fixtures).
//   · No LLM re-drive · attest works from existing extractor evidence only.

import { getJob, updateJob, listJobs, type KnowledgeJob } from "./fs-store";
import { applyTerminalKnowledgeJobTransition } from "./terminal-transition";
import { detectStuck, readStuckDetectorConfig } from "./supervisor-stuck-detector";
// NEW-1 reconciliation (Philip 2026-08-10 · Option C · Wave 2): reuse the
// pre-existing pure classifier from sub-gate 6.a rather than re-implementing
// inline. The classifier's discriminated union output (A-attest | B-review) is
// stricter than the ad-hoc tuple this file originally returned, and it is
// already covered by 17 vitest assertions in kjob-supervisor.test.ts.
import { classifyStuckKJ } from "./kjob-supervisor";
import type { BrainStore } from "@/lib/nex/brain/storage";
import type { WorkerJob, WorkerResult, AuditEntry } from "@/lib/nex/brain/types";
import { incr } from "@/lib/nex/observability/counters";
import { emitSignal } from "@/lib/nex/observability/signals";
import { logger } from "@/lib/nex/observability/logger";
import { randomUUID } from "node:crypto";

const log = logger("supervisor");

// The brain-store surface the supervisor requires. Keeping it narrow lets tests
// pass a partial fake without impersonating the entire 35-method BrainStore.
export type SupervisorStore = Pick<BrainStore,
  | "listWorkerJobsByInputRef"
  | "listWorkerResultsByIds"
  | "writeKnowledgeJobTransitionAudit"
  | "insertAudit"
  | "listAudit"
>;

// The fs-store surface the supervisor requires. Injectable so tests can point at
// a burner-only store without touching the real jobs.jsonl.
export type SupervisorKjStore = {
  getJob: typeof getJob;
  updateJob: typeof updateJob;
  listJobs: typeof listJobs;
};

export type SupervisorRunOptions = {
  batch_id?: string;                     // for logging correlation across a sweep
  now?: Date;                            // pinnable for tests
  applyTerminalTransition?: typeof applyTerminalKnowledgeJobTransition;

  // Phase 6 safety boundary (2026-08-10 · post-incident hardening).
  // See PHASE-6-PRESERVATION-INCIDENT-RESOLUTION.md and INCIDENT-FORENSIC-REPORT.md.
  //
  // probe_mode = true:
  //   · only_kjids MUST be defined AND non-empty. Otherwise the sweep throws
  //     synchronously BEFORE any DB access. This is the technical safety
  //     boundary — it makes it impossible for a burner verification run to
  //     touch arbitrary discovered KJs.
  //   · Discovered stuck KJs are intersected with only_kjids before ANY
  //     classifier / attest / review-queue call. KJs outside the allow-list
  //     are dropped as if they didn't exist.
  //
  // probe_mode unset/false:
  //   · only_kjids provided → filter still applied (operator-scoped run).
  //   · only_kjids undefined → full production sweep (backward-compat).
  probe_mode?: boolean;
  only_kjids?: string[];
};

export type PathAOutcome = {
  attested: string[];
  fell_through_to_path_b: string[];
  errors: Array<{ kjid: string; message: string }>;
  reviewed_via_path_b: string[];
};

export type SupervisorSweepResult = {
  batch_id: string;
  candidates_scanned: number;
  attested: string[];
  reviewed_via_path_b: string[];
  errors: Array<{ kjid: string; message: string }>;
  duration_ms: number;
};

// ── Path A · attest sweep ─────────────────────────────────────────────

async function tryAttestOne(
  store: SupervisorStore,
  kjStore: SupervisorKjStore,
  kj: KnowledgeJob,
  batch_id: string,
  applyFn: typeof applyTerminalKnowledgeJobTransition,
): Promise<{ result: "attested" | "fall_through"; reason?: string; extractor_result_ids?: string[]; extractor_worker_job_ids?: string[]; correlation_id?: string }> {
  const inbox_item_id = kj.inbox_item_id;
  if (!inbox_item_id) return { result: "fall_through", reason: "no-inbox-item-id" };

  const workers: WorkerJob[] = await store.listWorkerJobsByInputRef([inbox_item_id]);
  // Extractor result_ids known up-front so we can fetch results in one call
  // before delegating to the pure classifier.
  const extractorResultIds = workers
    .filter((w) => w.worker_type === "knowledge-extractor")
    .map((w) => w.result_id)
    .filter((r): r is string => Boolean(r));
  const results: WorkerResult[] = extractorResultIds.length > 0
    ? await store.listWorkerResultsByIds(extractorResultIds)
    : [];

  // NEW-1 reconciliation · route the decision through the authoritative
  // pure classifier. The classifier's three fall-through reasons
  // (no-extractor · extractor-incomplete · no-drafts) are the exact set
  // the review-queue heuristics distinguish on.
  const classification = classifyStuckKJ({ kjid: kj.job_id, workers, results });
  if (classification.path === "B-review") {
    return { result: "fall_through", reason: classification.reason };
  }

  // Path A. Extract CID off any of the extractor payloads (they all share the same chain).
  const extractors = workers.filter((w) => w.worker_type === "knowledge-extractor");
  const correlation_id = extractors
    .map((w) => (w.input_payload as { correlation_id?: unknown } | null | undefined)?.correlation_id)
    .filter((c): c is string => typeof c === "string")[0];

  await applyFn(store, {
    kjid: kj.job_id,
    patch: {
      status: "completed",
      progress: 100,
      completion_result: {
        reason: "supervisor-attested-completion",
        extractor_worker_ids: classification.extractor_worker_ids,
        result_ids: classification.result_ids,
        draft_record_ids: classification.draft_record_ids,
        attested_at: new Date().toISOString(),
      },
    },
    actor: "supervisor:companion",
    reason: "attested-from-worker-results",
    worker_job_id: classification.extractor_worker_ids[0],
    correlation_id,
    metadata: {
      extractor_result_ids: classification.result_ids,
      draft_record_ids: classification.draft_record_ids,
      batch_id,
    },
  });

  return {
    result: "attested",
    extractor_result_ids: classification.result_ids,
    extractor_worker_job_ids: classification.extractor_worker_ids,
    correlation_id,
  };
}

// ── Path B · review queue ─────────────────────────────────────────────

// Reason codes match the classifier's Path-B taxonomy (kjob-supervisor.ts)
// with two orchestrator-specific fall-throughs (no-inbox-item-id, unknown).
type PathBReasonCode =
  | "no-inbox-item-id"
  | "no-extractor"
  | "extractor-incomplete"
  | "no-drafts"
  | "unknown";

function recommendedActionFor(reason: string, workers: WorkerJob[]): { action: "requeue" | "mark_failed" | "manual_investigate"; code: PathBReasonCode } {
  // Design §4.6 heuristics.
  // Zero WorkerJobs (or KJ has no inbox_item_id) · nothing spent · requeue safe.
  if (workers.length === 0) {
    const code: PathBReasonCode = reason === "no-inbox-item-id" ? "no-inbox-item-id" : "no-extractor";
    return { action: "requeue", code };
  }
  // Extractor completed but produced no drafts · terminal · re-drive wastes LLM.
  if (reason === "no-drafts") return { action: "mark_failed", code: "no-drafts" };

  // Workers exist. If NONE has completed, something is mid-flight or crashed;
  // re-driving risks duplicating half-done work → manual_investigate.
  const anyCompleted = workers.some((w) => w.status === "completed");
  if (!anyCompleted) return { action: "manual_investigate", code: "extractor-incomplete" };

  // Some workers completed (LLM already spent on them) but the extractor never
  // ran (no-extractor path). Re-drive would re-spend the completed workers'
  // LLM cost. Design §4.6 says manual_investigate for "any other combination".
  if (reason === "no-extractor")         return { action: "manual_investigate", code: "no-extractor" };
  if (reason === "extractor-incomplete") return { action: "manual_investigate", code: "extractor-incomplete" };
  return { action: "manual_investigate", code: "unknown" };
}

async function queueReviewOne(
  store: SupervisorStore,
  kj: KnowledgeJob,
  fallthroughReason: string,
  now: Date,
): Promise<{ result: "queued" | "already_queued" | "escalation_fired"; audit_row_id?: string }> {
  const kjid = kj.job_id;
  // Dedup: skip if a review row already exists in the last 24 h.
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const priorRows: AuditEntry[] = await store.listAudit({ limit: 50, since, entity_id: kjid });
  const alreadyQueued = priorRows.some((r) => r.action === "supervisor-review-required");

  // Escalation: if the KJ is stuck > 72 h, emit escalation signal every tick.
  const stuck_hours = (now.getTime() - new Date(kj.updated_at).getTime()) / (60 * 60 * 1000);
  if (stuck_hours > 72) {
    emitSignal({
      subsystem: "supervisor",
      kind: "escalation-required",
      code: "72h",
      detail: `kjid=${kjid.slice(0, 8)} hours_open=${Math.round(stuck_hours)}`,
    });
  }

  if (alreadyQueued) return { result: "already_queued" };

  const inbox_item_id = kj.inbox_item_id ?? null;
  const workers = inbox_item_id ? await store.listWorkerJobsByInputRef([inbox_item_id]) : [];
  const recommended = recommendedActionFor(fallthroughReason, workers);

  const chain_counts: Record<string, Record<string, number>> = {};
  for (const w of workers) {
    chain_counts[w.worker_type] ??= {};
    chain_counts[w.worker_type][w.status] = (chain_counts[w.worker_type][w.status] ?? 0) + 1;
  }
  const last_completed_at = workers
    .filter((w) => w.status === "completed" && w.updated_at)
    .map((w) => w.updated_at as string)
    .sort()
    .reverse()[0] ?? null;

  const row = await store.insertAudit({
    entity_type: "knowledge_jobs",
    entity_id: kjid,
    action: "supervisor-review-required",
    actor: "supervisor:companion",
    before_state: null,
    after_state: {
      recommended_action: recommended.action,
      reason_code: recommended.code,
      fallthrough_reason: fallthroughReason,
      worker_chain_snapshot: {
        counts_by_worker_type_status: chain_counts,
        last_completed_at,
        reached_extractor: workers.some((w) => w.worker_type === "knowledge-extractor"),
        extractor_produced_drafts: false, // by definition — Path A already declined
      },
      stuck_duration_hours: Math.round(stuck_hours * 10) / 10,
      inbox_item_id,
    },
    notes: `Supervisor review required · ${recommended.action} · ${recommended.code}`,
  });

  emitSignal({
    subsystem: "supervisor",
    kind: "review-queued",
    code: `recommended:${recommended.action}`,
    detail: `kjid=${kjid.slice(0, 8)} reason=${recommended.code}`,
  });

  return { result: stuck_hours > 72 ? "escalation_fired" : "queued", audit_row_id: row.id };
}

// ── Orchestration · runSupervisorSweep ────────────────────────────────

export async function runSupervisorSweep(
  store: SupervisorStore,
  kjStore: SupervisorKjStore,
  opts: SupervisorRunOptions = {},
): Promise<SupervisorSweepResult> {
  // ── Phase 6 safety boundary · probe_mode allow-list enforcement ──
  // Fail synchronously BEFORE any DB access if probe_mode is on and the
  // allow-list is missing or empty. This is the technical guard that
  // prevents a burner probe from ever touching arbitrary discovered KJs.
  if (opts.probe_mode === true) {
    if (opts.only_kjids === undefined) {
      throw new Error("[supervisor] probe_mode=true requires opts.only_kjids to be defined · refusing sweep · see PHASE-6-PRESERVATION-INCIDENT-RESOLUTION.md");
    }
    if (!Array.isArray(opts.only_kjids)) {
      throw new Error("[supervisor] probe_mode=true requires opts.only_kjids to be an array · got " + typeof opts.only_kjids);
    }
    if (opts.only_kjids.length === 0) {
      throw new Error("[supervisor] probe_mode=true requires opts.only_kjids to be non-empty · refusing sweep");
    }
  }

  const batch_id = opts.batch_id ?? randomUUID();
  const now = opts.now ?? new Date();
  const applyFn = opts.applyTerminalTransition ?? applyTerminalKnowledgeJobTransition;
  const cfg = readStuckDetectorConfig();
  const started = Date.now();

  incr("supervisor.sweep_started");
  log.info("sweep_started", {
    batch_id,
    max_per_tick: cfg.max_per_tick,
    stuck_after_min: cfg.stuck_after_minutes,
    probe_mode: opts.probe_mode === true,
    only_kjids: opts.only_kjids ?? null,
  });

  // Read candidates — up to 500 claimed rows in a 30-day window, then detect stuck.
  const allClaimed = await kjStore.listJobs({
    status: "claimed",
    include_all_states: true,
    limit: 500,
    since_ms: 30 * 24 * 60 * 60 * 1000,
  });
  const stuckAll = detectStuck(allClaimed, cfg, now);

  // Phase 6 safety boundary · allow-list intersection AT the discovery boundary.
  // Any KJ outside the allow-list is dropped here · classifier + action never see it.
  const stuck = opts.only_kjids
    ? stuckAll.filter((kj) => opts.only_kjids!.includes(kj.job_id))
    : stuckAll;
  if (opts.only_kjids && stuckAll.length !== stuck.length) {
    log.info("allow_list_filtered", {
      batch_id,
      discovered: stuckAll.length,
      after_allow_list: stuck.length,
      rejected: stuckAll.length - stuck.length,
    });
  }

  const attested: string[] = [];
  const reviewed_via_path_b: string[] = [];
  const errors: Array<{ kjid: string; message: string }> = [];

  for (const kj of stuck) {
    const kjid = kj.job_id;
    try {
      // Re-fetch fresh in case a concurrent extractor cascade already finalised.
      const fresh = await kjStore.getJob(kjid);
      if (!fresh || fresh.status !== "claimed") {
        // Not stuck anymore — race-won by Path C cascade.
        continue;
      }
      const outcome = await tryAttestOne(store, kjStore, fresh, batch_id, applyFn);
      if (outcome.result === "attested") {
        attested.push(kjid);
        incr("supervisor.kj_attested");
        log.info("kj_attested", { kjid, extractor_result_ids: outcome.extractor_result_ids });
      } else {
        incr("supervisor.path_a_fallthrough");
        const review = await queueReviewOne(store, fresh, outcome.reason ?? "unknown", now);
        if (review.result === "queued" || review.result === "escalation_fired") {
          reviewed_via_path_b.push(kjid);
          incr("supervisor.kj_review_queued");
          log.info("kj_review_queued", { kjid, reason: outcome.reason });
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message.slice(0, 500) : String(e).slice(0, 500);
      errors.push({ kjid, message });
      incr("supervisor.error");
      emitSignal({ subsystem: "supervisor", kind: "error", code: "sweep-per-kj", detail: `kjid=${kjid.slice(0, 8)} err=${message.slice(0, 80)}` });
      log.warn("sweep_error", { kjid, error: message });
    }
  }

  const duration_ms = Date.now() - started;
  incr("supervisor.sweep_completed");
  emitSignal({
    subsystem: "supervisor",
    kind: "sweep-completed",
    code: "path-a",
    detail: `attested=${attested.length} reviewed=${reviewed_via_path_b.length} errors=${errors.length} duration_ms=${duration_ms}`,
  });
  log.info("sweep_completed", { batch_id, attested: attested.length, reviewed: reviewed_via_path_b.length, errors: errors.length, duration_ms });

  return {
    batch_id,
    candidates_scanned: stuck.length,
    attested,
    reviewed_via_path_b,
    errors,
    duration_ms,
  };
}
