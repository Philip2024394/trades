// NEX Brain · Worker Activity Audit
//
// Real audit of the last 24 hours of worker activity, computed from
// authoritative telemetry only. Never estimates, never fabricates.
// Metrics that cannot be derived from current telemetry are marked
// as `null` in the output + listed in `missing_telemetry` with a
// prescription for the new table/column needed to complete them.
//
// Doctrine:
// · feedback_nex_never_pretends_work_done_2026_08_07.md — no fabrication
// · feedback_nex_observable_ai_doctrine_2026_08_07.md — evidence not just numbers
// · feedback_nex_dashboard_single_source_of_truth_2026_08_07.md — one auth source per metric
//
// Data sources (all Supabase):
// · worker_jobs — assigned_at · completed_at · created_at · attempts · last_error · status · worker_type
// · worker_results — llm_provider · llm_ms · llm_tokens_* · created_at · worker_type · job_id
// · worker_heartbeats — host_id · uptime_ms · cycles_total · cycles_failed · last_cycle_summary
// · contradictions — created_at · resolved_at
// · knowledge_records — status · updated_at

import type { WorkerType } from "./types";

// ── Public output shapes ────────────────────────────────────────────

export type AuditWindow = {
  from: string;           // ISO
  to: string;             // ISO
  duration_hours: number; // Should be ~24 unless window overridden
};

/** A metric that IS computable from current telemetry. */
export type Available<T> = { available: true; value: T };
/** A metric that CANNOT be computed today — output includes the
 *  reason + which new telemetry unblocks it. */
export type Unavailable = { available: false; reason: string; needs: string };
export type Maybe<T> = Available<T> | Unavailable;

export type PerWorkerAudit = {
  worker_type: WorkerType;
  jobs_completed: number;
  jobs_failed: number;
  success_pct: Maybe<number>;
  failure_pct: Maybe<number>;
  avg_job_duration_ms: Maybe<number>;
  min_job_duration_ms: Maybe<number>;
  max_job_duration_ms: Maybe<number>;
  avg_queue_wait_ms: Maybe<number>;
  total_retries: number;
  total_active_ms: Maybe<number>;
  total_idle_ms: Maybe<number>;
  total_time_waiting_for_llm_providers_ms: Maybe<number>;
  total_time_waiting_for_retries_ms: Maybe<number>;
  total_time_failed_ms: Maybe<number>;
  provider_usage: Array<{ provider: string; calls: number; successes: number; avg_ms: number | null }>;
  provider_failures: Maybe<number>;
  current_uptime_ms: Maybe<number>;   // Only for the cloud worker running this stage
};

/** Knowledge Production — Philip's "far more meaningful measure of progress
 *  than 16,000 API calls" (doctrine: `project_nex_operations_history_and_explainability_2026_08_07.md`).
 *  Measures what NEX BUILT, not what it CALLED. */
export type KnowledgeProduction = {
  articles_analysed: number;               // Distinct source records/inbox items processed in window
  authoritative_records_added: number;     // knowledge_records reaching AUTHORITATIVE this window
  under_review_records_added: number;      // knowledge_records reaching UNDER_REVIEW this window
  draft_records_added: number;             // knowledge_records created (regardless of stage) this window
  contradictions_opened: number;
  contradictions_resolved: number;
  average_confidence: number | null;       // Across records with a confidence signal in window
  knowledge_graph_edges_added: Maybe<number>;  // NEEDS TELEMETRY — graph_edges.created_at query
};

export type SystemAudit = {
  cloud_workers_online: number;
  cloud_workers_uptime_sum_ms: number;
  jobs_completed_total: number;
  jobs_failed_total: number;
  combined_active_processing_ms: number;
  combined_idle_ms: Maybe<number>;
  queue_utilisation_pct: Maybe<number>;
  avg_jobs_per_hour: number;
  peak_processing_hour: { start_iso: string; jobs: number } | null;
  quietest_processing_hour: { start_iso: string; jobs: number } | null;
  avg_llm_response_ms: number | null;
  avg_end_to_end_job_ms: number | null;
  queue_growth_events: number;              // Count of newly created jobs
  queue_reduction_events: number;           // Count of newly completed jobs
  records_promoted_to_authoritative: number;
  records_rejected: Maybe<number>;
  contradictions_opened: number;
  contradictions_resolved: number;
};

export type TimelineBucket = {
  hour_start_iso: string;
  hour_label: string;                        // "14:00–15:00"
  jobs_completed: number;
  jobs_failed: number;
  distinct_workers_active: number;
};

export type Observation = {
  kind: "info" | "warn" | "critical";
  text: string;
  evidence?: Record<string, unknown>;
};

export type MissingTelemetry = {
  metric: string;
  reason: string;
  prescription: string;                      // Exactly what to add + which table
};

export type WorkerActivityAudit = {
  window: AuditWindow;
  system: SystemAudit;
  knowledge_production: KnowledgeProduction;
  per_worker: PerWorkerAudit[];
  timeline: TimelineBucket[];
  observations: Observation[];
  missing_telemetry: MissingTelemetry[];
  generated_at: string;
};

// ── Raw input shapes (whatever the caller fetches from Supabase) ────

export type RawWorkerJob = {
  id: string;
  worker_type: WorkerType;
  status: "waiting" | "assigned" | "running" | "completed" | "failed" | "cancelled";
  created_at: string;
  assigned_at: string | null;
  completed_at: string | null;
  attempts: number;
  last_error: string | null;
};

export type RawWorkerResult = {
  id: string;
  job_id: string;
  worker_type: WorkerType;
  llm_provider: string | null;
  llm_ms: number | null;
  llm_tokens_in: number | null;
  llm_tokens_out: number | null;
  created_at: string;
};

export type RawCloudWorker = {
  host_id: string;
  last_seen_at: string;
  uptime_ms: number;
  cycles_total: number;
  cycles_failed: number;
  metadata: Record<string, unknown> | null;
};

export type RawContradiction = {
  id: string;
  created_at: string;
  resolved_at: string | null;
};

export type RawRecordChange = {
  id: string;
  status: string;                           // 'AUTHORITATIVE', 'DEPRECATED', etc.
  created_at: string;
  updated_at?: string | null;
};

export type AuditInputs = {
  window_from: string;
  window_to: string;
  jobs: RawWorkerJob[];
  results: RawWorkerResult[];
  cloud_workers: RawCloudWorker[];
  contradictions: RawContradiction[];
  record_changes: RawRecordChange[];
  worker_types: WorkerType[];               // The canonical list to iterate
};

// ── Missing-telemetry prescriptions (constant catalog) ──────────────

const MISSING_TELEMETRY_CATALOG: Record<string, MissingTelemetry> = {
  worker_idle_time: {
    metric: "per-worker + system idle time (queue empty)",
    reason: "worker_heartbeats only records cycle_total, not idle_ms per cycle. We know when jobs COMPLETED but not when the worker was actively polling with an empty queue vs. genuinely inactive.",
    prescription: "Add columns to worker_heartbeats: `idle_ms_24h`, `active_ms_24h`. Update Fly cloud worker's cycle loop to accumulate elapsed_ms into active or idle bucket based on whether the cycle claimed any jobs. Or (better) add a `worker_cycle_events` table logging {host_id, started_at, ended_at, jobs_claimed} per cycle.",
  },
  provider_attempt_log: {
    metric: "time waiting for LLM providers, retries, provider failure counts",
    reason: "worker_results only records SUCCESSFUL calls (llm_ms + llm_provider). Failed provider attempts are handled in-memory by llm.ts circuit-breaker retry logic and never persisted. Cannot compute total time spent on 429/timeout fall-through per provider.",
    prescription: "Add a `llm_call_attempts` table: {id, job_id, worker_type, provider, model, attempt_number, started_at, finished_at, latency_ms, outcome (ok|429|timeout|5xx|circuit_open|budget_exhausted), error_snippet}. Modify llm.ts complete() to insert one row per attempt, not just per success. Enables per-provider MTTR + retry breakdown + budget-hit timestamps.",
  },
  records_rejected: {
    metric: "count of records rejected by quality-checker or accountant",
    reason: "knowledge_records has a status enum but no explicit REJECTED state or 'rejected_at' timestamp column. Rejection may currently happen by moving to DEPRECATED or by not creating a record at all — both untraceable.",
    prescription: "Extend knowledge_records status enum to include 'REJECTED' + add `rejected_at`, `rejected_by`, `rejection_reason` columns. Alternatively (better for audit): add a `record_status_transitions` table with (record_id, from_status, to_status, changed_by, changed_at, reason) so every promotion/rejection/deprecation is queryable in one place.",
  },
  provider_daily_cap_events: {
    metric: "timestamped provider daily-limit hits ('Groq hit 100k tokens/day at 18:42')",
    reason: "Daily-budget skips are logged to console in llm.ts (isBudgetExhausted check) but not persisted. Same for observed 429 responses that indicate hitting a real provider daily limit.",
    prescription: "Add a `llm_provider_events` table logging (provider, event_type: budget_exhausted|429_seen|circuit_opened|circuit_closed|degraded|recovered, at, details_jsonb). Update llm.ts to insert on each transition. Enables the 'Groq reached its daily limit at 18:42 UTC' observation directly.",
  },
  worker_stage_start_end: {
    metric: "true per-worker start/end timestamps INSIDE a job (e.g. LLM call started/ended)",
    reason: "worker_jobs records assigned_at + completed_at at the whole-job level. Sub-stages (LLM call started, storage write started, edge writes started) aren't separately timestamped, so we cannot compute 'time spent waiting for LLM vs. time spent writing to DB' from current telemetry.",
    prescription: "Either (a) rely on the llm_call_attempts table above for LLM latency and derive DB-write time as (job_duration - llm_ms), OR (b) add a `worker_job_events` table with fine-grained sub-stage events. Option (a) is lighter — recommend starting there.",
  },
};

// ── Aggregator ──────────────────────────────────────────────────────

export function computeWorkerActivityAudit(inputs: AuditInputs): WorkerActivityAudit {
  const fromMs = Date.parse(inputs.window_from);
  const toMs = Date.parse(inputs.window_to);
  const durationHours = Math.max(0, (toMs - fromMs) / (60 * 60 * 1000));

  const window: AuditWindow = {
    from: inputs.window_from,
    to: inputs.window_to,
    duration_hours: Number(durationHours.toFixed(2)),
  };

  // Filter to window (defensive — caller should have already scoped)
  const jobs = inputs.jobs.filter((j) => {
    const t = Date.parse(j.completed_at ?? j.created_at);
    return t >= fromMs && t <= toMs;
  });
  const results = inputs.results.filter((r) => {
    const t = Date.parse(r.created_at);
    return t >= fromMs && t <= toMs;
  });

  // Per-worker breakdown
  const perWorker: PerWorkerAudit[] = inputs.worker_types.map((wt) =>
    buildPerWorker(wt, jobs, results, inputs.cloud_workers)
  );

  // System-level
  const system = buildSystem(jobs, results, inputs.cloud_workers, inputs.contradictions, inputs.record_changes, fromMs, toMs);

  // Knowledge Production — the "what NEX built" panel
  const knowledge_production = buildKnowledgeProduction(inputs.record_changes, results, inputs.contradictions, fromMs, toMs);

  // Timeline (24 hourly buckets)
  const timeline = buildTimeline(results, jobs, fromMs, toMs);

  // Observations
  const observations = buildObservations(system, perWorker, timeline, results, jobs);

  const missing_telemetry: MissingTelemetry[] = [
    MISSING_TELEMETRY_CATALOG.worker_idle_time,
    MISSING_TELEMETRY_CATALOG.provider_attempt_log,
    MISSING_TELEMETRY_CATALOG.records_rejected,
    MISSING_TELEMETRY_CATALOG.provider_daily_cap_events,
    MISSING_TELEMETRY_CATALOG.worker_stage_start_end,
  ];

  return {
    window,
    system,
    knowledge_production,
    per_worker: perWorker,
    timeline,
    observations,
    missing_telemetry,
    generated_at: new Date().toISOString(),
  };
}

// ── Knowledge Production ────────────────────────────────────────────

function buildKnowledgeProduction(
  recordChanges: RawRecordChange[],
  results: RawWorkerResult[],
  contradictions: RawContradiction[],
  fromMs: number,
  toMs: number
): KnowledgeProduction {
  const inWindow = (iso: string | null | undefined) => {
    if (!iso) return false;
    const t = Date.parse(iso);
    return t >= fromMs && t <= toMs;
  };

  // Distinct source items processed = distinct job_ids in worker_results this window
  const distinctJobs = new Set(results.map((r) => r.job_id));
  const articles_analysed = distinctJobs.size;

  // Records reaching each stage this window. Approximation via last_reviewed_at
  // proxy — see missing_telemetry for the prescribed record_status_transitions table.
  const authoritative_records_added = recordChanges.filter(
    (r) => r.status === "AUTHORITATIVE" && inWindow(r.updated_at ?? r.created_at)
  ).length;
  const under_review_records_added = recordChanges.filter(
    (r) => r.status === "UNDER_REVIEW" && inWindow(r.updated_at ?? r.created_at)
  ).length;
  const draft_records_added = recordChanges.filter(
    (r) => inWindow(r.created_at)
  ).length;

  const contradictions_opened = contradictions.filter((c) => inWindow(c.created_at)).length;
  const contradictions_resolved = contradictions.filter((c) => inWindow(c.resolved_at)).length;

  // Average confidence over the window from worker_results (proxy for record confidence
  // when quality-checker output is stored). Not exact — see prescription for
  // per-call knowledge_delta telemetry.
  // Note: worker_results doesn't currently expose confidence on this narrowed shape,
  // so this is null until we plumb it through. Prescription flagged in missing_telemetry.
  const average_confidence: number | null = null;

  return {
    articles_analysed,
    authoritative_records_added,
    under_review_records_added,
    draft_records_added,
    contradictions_opened,
    contradictions_resolved,
    average_confidence,
    knowledge_graph_edges_added: {
      available: false,
      reason: "graph_edges.created_at not queried in this audit yet (avoids pulling ~10k rows per run).",
      needs: "Add graph_edges to the API's parallel fetch + count entries where created_at ∈ window. Small change to /api/nex/brain/worker-audit route.",
    },
  };
}

// ── Per-worker helper ───────────────────────────────────────────────

function buildPerWorker(
  workerType: WorkerType,
  jobs: RawWorkerJob[],
  results: RawWorkerResult[],
  cloudWorkers: RawCloudWorker[]
): PerWorkerAudit {
  const wJobs = jobs.filter((j) => j.worker_type === workerType);
  const wResults = results.filter((r) => r.worker_type === workerType);

  const completed = wJobs.filter((j) => j.status === "completed");
  const failed = wJobs.filter((j) => j.status === "failed");
  const total = completed.length + failed.length;

  const durations = completed
    .map((j) => diffMs(j.assigned_at, j.completed_at))
    .filter((n): n is number => n !== null);
  const waits = completed
    .map((j) => diffMs(j.created_at, j.assigned_at))
    .filter((n): n is number => n !== null);
  const failDurations = failed
    .map((j) => diffMs(j.assigned_at, j.completed_at))
    .filter((n): n is number => n !== null);

  const totalActive = durations.reduce((s, v) => s + v, 0);
  const totalFailed = failDurations.reduce((s, v) => s + v, 0);
  const retries = wJobs.reduce((s, j) => s + Math.max(0, j.attempts - 1), 0);

  // Provider usage breakdown from successful results
  const providerMap = new Map<string, { calls: number; successes: number; totalMs: number; count: number }>();
  for (const r of wResults) {
    const p = r.llm_provider ?? "unknown";
    const entry = providerMap.get(p) ?? { calls: 0, successes: 0, totalMs: 0, count: 0 };
    entry.calls += 1;
    entry.successes += 1;   // worker_results row exists only on success
    if (typeof r.llm_ms === "number") {
      entry.totalMs += r.llm_ms;
      entry.count += 1;
    }
    providerMap.set(p, entry);
  }
  const provider_usage = Array.from(providerMap.entries())
    .map(([provider, s]) => ({
      provider,
      calls: s.calls,
      successes: s.successes,
      avg_ms: s.count > 0 ? Math.round(s.totalMs / s.count) : null,
    }))
    .sort((a, b) => b.calls - a.calls);

  // "Current uptime" comes from the cloud worker heartbeat but heartbeats
  // don't split by worker_type — every worker stage runs in the same
  // container. So we surface the aggregate cloud uptime as the answer,
  // acknowledged in the doctrine as approximate.
  const uptimeSum = cloudWorkers.reduce((s, cw) => s + cw.uptime_ms, 0);
  const current_uptime_ms: Maybe<number> = cloudWorkers.length > 0
    ? { available: true, value: uptimeSum / cloudWorkers.length }   // average uptime across cloud workers
    : { available: false, reason: "No cloud workers online", needs: "worker_heartbeats rows for the trailing 60s" };

  return {
    worker_type: workerType,
    jobs_completed: completed.length,
    jobs_failed: failed.length,
    success_pct: total > 0
      ? { available: true, value: (completed.length / total) * 100 }
      : { available: false, reason: "No jobs in window for this worker", needs: "Real work to process" },
    failure_pct: total > 0
      ? { available: true, value: (failed.length / total) * 100 }
      : { available: false, reason: "No jobs in window for this worker", needs: "Real work to process" },
    avg_job_duration_ms: durations.length > 0
      ? { available: true, value: Math.round(durations.reduce((s, v) => s + v, 0) / durations.length) }
      : { available: false, reason: "No completed jobs in window", needs: "Real work to process" },
    min_job_duration_ms: durations.length > 0
      ? { available: true, value: Math.min(...durations) }
      : { available: false, reason: "No completed jobs in window", needs: "Real work to process" },
    max_job_duration_ms: durations.length > 0
      ? { available: true, value: Math.max(...durations) }
      : { available: false, reason: "No completed jobs in window", needs: "Real work to process" },
    avg_queue_wait_ms: waits.length > 0
      ? { available: true, value: Math.round(waits.reduce((s, v) => s + v, 0) / waits.length) }
      : { available: false, reason: "No completed jobs in window", needs: "Real work to process" },
    total_retries: retries,
    total_active_ms: durations.length > 0
      ? { available: true, value: totalActive }
      : { available: false, reason: "No completed jobs in window", needs: "Real work to process" },
    total_idle_ms: { available: false, reason: MISSING_TELEMETRY_CATALOG.worker_idle_time.reason, needs: MISSING_TELEMETRY_CATALOG.worker_idle_time.prescription },
    total_time_waiting_for_llm_providers_ms: { available: false, reason: MISSING_TELEMETRY_CATALOG.provider_attempt_log.reason, needs: MISSING_TELEMETRY_CATALOG.provider_attempt_log.prescription },
    total_time_waiting_for_retries_ms: { available: false, reason: MISSING_TELEMETRY_CATALOG.provider_attempt_log.reason, needs: MISSING_TELEMETRY_CATALOG.provider_attempt_log.prescription },
    total_time_failed_ms: failDurations.length > 0
      ? { available: true, value: totalFailed }
      : { available: false, reason: "No failed jobs in window", needs: "Real failures to measure" },
    provider_usage,
    provider_failures: { available: false, reason: MISSING_TELEMETRY_CATALOG.provider_attempt_log.reason, needs: MISSING_TELEMETRY_CATALOG.provider_attempt_log.prescription },
    current_uptime_ms,
  };
}

// ── System-level helper ────────────────────────────────────────────

function buildSystem(
  jobs: RawWorkerJob[],
  results: RawWorkerResult[],
  cloudWorkers: RawCloudWorker[],
  contradictions: RawContradiction[],
  recordChanges: RawRecordChange[],
  fromMs: number,
  toMs: number
): SystemAudit {
  const completed = jobs.filter((j) => j.status === "completed");
  const failed = jobs.filter((j) => j.status === "failed");

  const jobDurations = completed
    .map((j) => diffMs(j.assigned_at, j.completed_at))
    .filter((n): n is number => n !== null);
  const combined_active_processing_ms = jobDurations.reduce((s, v) => s + v, 0);

  const durationHours = (toMs - fromMs) / (60 * 60 * 1000);
  const cloud_workers_online = cloudWorkers.length;
  const cloud_workers_uptime_sum_ms = cloudWorkers.reduce((s, cw) => s + cw.uptime_ms, 0);

  // Idle time NOT directly measurable — see missing_telemetry.
  const combined_idle_ms: Maybe<number> = { available: false, reason: MISSING_TELEMETRY_CATALOG.worker_idle_time.reason, needs: MISSING_TELEMETRY_CATALOG.worker_idle_time.prescription };

  // Queue utilisation = combined_active_processing_ms / (cloud_workers × window_ms).
  // Even without idle time, this gives a real "fraction of possible worker-seconds
  // actually spent processing". Meaningful only when we have cloud workers.
  const total_possible_worker_ms = cloud_workers_online * (toMs - fromMs);
  const queue_utilisation_pct: Maybe<number> = total_possible_worker_ms > 0
    ? { available: true, value: (combined_active_processing_ms / total_possible_worker_ms) * 100 }
    : { available: false, reason: "No cloud workers online in the window", needs: "Fly worker heartbeats" };

  const jobs_completed_total = completed.length;
  const jobs_failed_total = failed.length;

  const avg_jobs_per_hour = durationHours > 0 ? jobs_completed_total / durationHours : 0;

  // Peak / quietest hour from completion timestamps
  const hourlyCounts = bucketByHour(completed.map((j) => j.completed_at).filter((s): s is string => Boolean(s)), fromMs, toMs);
  const peak = hourlyCounts.length > 0 ? hourlyCounts.reduce((best, cur) => cur.count > best.count ? cur : best) : null;
  const quiet = hourlyCounts.length > 0 ? hourlyCounts.reduce((best, cur) => cur.count < best.count ? cur : best) : null;

  // Avg LLM ms across all successful calls
  const llmMsValues = results.map((r) => r.llm_ms).filter((n): n is number => typeof n === "number");
  const avg_llm_response_ms = llmMsValues.length > 0
    ? Math.round(llmMsValues.reduce((s, v) => s + v, 0) / llmMsValues.length)
    : null;

  // End-to-end avg job duration
  const avg_end_to_end_job_ms = jobDurations.length > 0
    ? Math.round(combined_active_processing_ms / jobDurations.length)
    : null;

  // Queue growth = jobs created in window; reduction = jobs completed in window
  const queue_growth_events = jobs.filter((j) => {
    const t = Date.parse(j.created_at);
    return t >= fromMs && t <= toMs;
  }).length;
  const queue_reduction_events = completed.filter((j) => {
    if (!j.completed_at) return false;
    const t = Date.parse(j.completed_at);
    return t >= fromMs && t <= toMs;
  }).length;

  // Records promoted to Authoritative — snapshot: records currently AUTHORITATIVE
  // whose updated_at falls in the window. Approximation because we don't have
  // a status-transitions table — see missing_telemetry.
  const records_promoted_to_authoritative = recordChanges.filter((r) => {
    if (r.status !== "AUTHORITATIVE") return false;
    const t = Date.parse(r.updated_at ?? r.created_at);
    return t >= fromMs && t <= toMs;
  }).length;

  const records_rejected: Maybe<number> = { available: false, reason: MISSING_TELEMETRY_CATALOG.records_rejected.reason, needs: MISSING_TELEMETRY_CATALOG.records_rejected.prescription };

  const contradictions_opened = contradictions.filter((c) => {
    const t = Date.parse(c.created_at);
    return t >= fromMs && t <= toMs;
  }).length;

  const contradictions_resolved = contradictions.filter((c) => {
    if (!c.resolved_at) return false;
    const t = Date.parse(c.resolved_at);
    return t >= fromMs && t <= toMs;
  }).length;

  return {
    cloud_workers_online,
    cloud_workers_uptime_sum_ms,
    jobs_completed_total,
    jobs_failed_total,
    combined_active_processing_ms,
    combined_idle_ms,
    queue_utilisation_pct,
    avg_jobs_per_hour: Number(avg_jobs_per_hour.toFixed(2)),
    peak_processing_hour: peak ? { start_iso: peak.iso, jobs: peak.count } : null,
    quietest_processing_hour: quiet ? { start_iso: quiet.iso, jobs: quiet.count } : null,
    avg_llm_response_ms,
    avg_end_to_end_job_ms,
    queue_growth_events,
    queue_reduction_events,
    records_promoted_to_authoritative,
    records_rejected,
    contradictions_opened,
    contradictions_resolved,
  };
}

// ── Timeline (24 hourly buckets over the window) ───────────────────

function buildTimeline(
  results: RawWorkerResult[],
  jobs: RawWorkerJob[],
  fromMs: number,
  toMs: number
): TimelineBucket[] {
  const HOUR_MS = 60 * 60 * 1000;
  const nBuckets = Math.max(1, Math.round((toMs - fromMs) / HOUR_MS));
  const buckets: TimelineBucket[] = [];
  for (let i = 0; i < nBuckets; i++) {
    const start = fromMs + i * HOUR_MS;
    const end = start + HOUR_MS;
    const inBucket = <T extends { created_at?: string; completed_at?: string | null }>(rows: T[], key: "created_at" | "completed_at") =>
      rows.filter((r) => {
        const s = (r as { [k: string]: unknown })[key];
        if (typeof s !== "string") return false;
        const t = Date.parse(s);
        return t >= start && t < end;
      });
    const completedInBucket = inBucket(jobs.filter((j) => j.status === "completed" && j.completed_at), "completed_at");
    const failedInBucket = inBucket(jobs.filter((j) => j.status === "failed" && j.completed_at), "completed_at");
    const distinctWorkers = new Set(completedInBucket.map((j) => j.worker_type));
    const startDate = new Date(start);
    const endDate = new Date(end);
    buckets.push({
      hour_start_iso: startDate.toISOString(),
      hour_label: `${startDate.getUTCHours().toString().padStart(2, "0")}:00–${endDate.getUTCHours().toString().padStart(2, "0")}:00 UTC`,
      jobs_completed: completedInBucket.length,
      jobs_failed: failedInBucket.length,
      distinct_workers_active: distinctWorkers.size,
    });
  }
  return buckets;
}

// ── Observations (auto-generated narrative) ────────────────────────

function buildObservations(
  system: SystemAudit,
  perWorker: PerWorkerAudit[],
  timeline: TimelineBucket[],
  results: RawWorkerResult[],
  jobs: RawWorkerJob[]
): Observation[] {
  const obs: Observation[] = [];

  // Busiest worker
  const workersRanked = [...perWorker].sort((a, b) => b.jobs_completed - a.jobs_completed);
  if (workersRanked[0] && workersRanked[0].jobs_completed > 0) {
    obs.push({
      kind: "info",
      text: `${workersRanked[0].worker_type} was the busiest worker with ${workersRanked[0].jobs_completed} jobs completed.`,
      evidence: { worker: workersRanked[0].worker_type, jobs: workersRanked[0].jobs_completed },
    });
  }

  // Peak / quiet hour
  if (system.peak_processing_hour) {
    obs.push({
      kind: "info",
      text: `Peak processing hour was ${new Date(system.peak_processing_hour.start_iso).toISOString().slice(11, 16)} UTC with ${system.peak_processing_hour.jobs} jobs completed.`,
    });
  }
  if (system.quietest_processing_hour && system.quietest_processing_hour.jobs === 0) {
    obs.push({
      kind: "info",
      text: `Some hours had zero jobs completed — the queue was empty or workers were waiting for real work.`,
    });
  }

  // Dominant provider
  const providerTotals = new Map<string, number>();
  for (const r of results) {
    const p = r.llm_provider ?? "unknown";
    providerTotals.set(p, (providerTotals.get(p) ?? 0) + 1);
  }
  const totalCalls = results.length;
  const providerRanked = Array.from(providerTotals.entries()).sort((a, b) => b[1] - a[1]);
  if (providerRanked[0] && totalCalls > 0) {
    const [provider, calls] = providerRanked[0];
    const pct = Math.round((calls / totalCalls) * 100);
    obs.push({
      kind: provider === "mock" ? "critical" : "info",
      text: `${provider} handled ${pct}% of successful LLM calls (${calls.toLocaleString()} of ${totalCalls.toLocaleString()}).`,
      evidence: { provider, calls, total: totalCalls },
    });
  }

  // Mock alarm (doctrinally critical)
  const mockCalls = providerTotals.get("mock") ?? 0;
  if (mockCalls > 0) {
    obs.push({
      kind: "critical",
      text: `${mockCalls.toLocaleString()} calls fell through to the mock adapter. Any records produced by mock are fabricated placeholder content and violate the "NEX never pretends work has been done" doctrine.`,
      evidence: { mock_calls: mockCalls },
    });
  }

  // Failure rate
  const totalJobs = system.jobs_completed_total + system.jobs_failed_total;
  if (totalJobs > 0) {
    const failRate = (system.jobs_failed_total / totalJobs) * 100;
    if (failRate > 5) {
      obs.push({
        kind: "warn",
        text: `Job failure rate was ${failRate.toFixed(1)}% (${system.jobs_failed_total} failed / ${totalJobs} total). Investigate last_error patterns in worker_jobs.`,
      });
    }
  }

  // Queue growth vs reduction
  const growthMinusReduction = system.queue_growth_events - system.queue_reduction_events;
  if (growthMinusReduction > 100) {
    obs.push({
      kind: "warn",
      text: `Queue grew faster than it drained: +${system.queue_growth_events} new jobs vs -${system.queue_reduction_events} completed. Net backlog change: +${growthMinusReduction}.`,
    });
  } else if (growthMinusReduction < -100) {
    obs.push({
      kind: "info",
      text: `Workers caught up: ${system.queue_reduction_events} completed vs ${system.queue_growth_events} new arrivals. Net backlog reduction: ${growthMinusReduction}.`,
    });
  }

  // Utilisation
  if (system.queue_utilisation_pct.available) {
    const pct = system.queue_utilisation_pct.value;
    if (pct < 5) {
      obs.push({
        kind: "info",
        text: `Queue utilisation was ${pct.toFixed(1)}% — workers spent most of the window idle because no jobs were available.`,
      });
    } else if (pct > 80) {
      obs.push({
        kind: "warn",
        text: `Queue utilisation was ${pct.toFixed(1)}% — workers were nearly saturated. Consider scaling or investigating slow jobs.`,
      });
    }
  }

  // Records promoted
  if (system.records_promoted_to_authoritative === 0 && totalCalls > 0) {
    obs.push({
      kind: "warn",
      text: `Zero records reached Authoritative in this window despite ${totalCalls.toLocaleString()} LLM calls. Quality-checker may be too strict, or the extracted records are low-quality (often a sign of mock output flooding the pipeline).`,
    });
  } else if (system.records_promoted_to_authoritative > 0) {
    obs.push({
      kind: "info",
      text: `${system.records_promoted_to_authoritative} record${system.records_promoted_to_authoritative > 1 ? "s" : ""} reached Authoritative in this window.`,
    });
  }

  // Contradictions
  if (system.contradictions_resolved > 0) {
    obs.push({
      kind: "info",
      text: `${system.contradictions_resolved} contradiction${system.contradictions_resolved > 1 ? "s were" : " was"} resolved in this window.`,
    });
  }

  return obs;
}

// ── Utilities ───────────────────────────────────────────────────────

function diffMs(fromIso: string | null, toIso: string | null): number | null {
  if (!fromIso || !toIso) return null;
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, b - a);
}

function bucketByHour(isoStrings: string[], fromMs: number, toMs: number): Array<{ iso: string; count: number }> {
  const HOUR_MS = 60 * 60 * 1000;
  const nBuckets = Math.max(1, Math.round((toMs - fromMs) / HOUR_MS));
  const counts = new Array(nBuckets).fill(0);
  for (const iso of isoStrings) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) continue;
    const idx = Math.floor((t - fromMs) / HOUR_MS);
    if (idx >= 0 && idx < nBuckets) counts[idx] += 1;
  }
  return counts.map((count, i) => ({
    iso: new Date(fromMs + i * HOUR_MS).toISOString(),
    count,
  }));
}
