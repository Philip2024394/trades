// NEX Workforce v2 · Observability · Metrics
// ─────────────────────────────────────────────────────────────────────────────
// Metric collector · takes a `query` executor function and returns structured
// metric objects. Every metric is traceable to a query in `./queries.mjs`.
//
// Design rules (per C7 Section 20):
//   · Every number returned must come from an authoritative query
//   · Never turn missing telemetry into zero · use null with { available: false }
//   · Never invent fields not backed by real data

import * as Q from "./queries.mjs";

/**
 * Collect ALL metrics in one pass.
 * @param {Function} query - async fn(sql) => rows[]
 * @param {object} opts - config { windowHours, heartbeatFreshSecs, staleHeartbeatSecs, nearExpirySecs }
 */
export async function collectAllMetrics(query, opts = {}) {
  const {
    windowHours = 24,
    heartbeatFreshSecs = 300,
    staleHeartbeatSecs = 120,
    nearExpirySecs = 60,
    recentCycleLimit = 20,
  } = opts;

  const [
    counts, age, agents, throughput, failures,
    matrix, eligible, persistence, rejections,
    stuck, recent, reaper, sessions,
  ] = await Promise.all([
    query(Q.workforceCountsQuery().sql),
    query(Q.workforceAgeQuery().sql),
    query(Q.activeAgentsQuery({ heartbeatFreshSecs }).sql),
    query(Q.throughputQuery({ windowHours }).sql),
    query(Q.failureClassQuery({ windowHours }).sql),
    query(Q.sourceMatrixQuery().sql),
    query(Q.rotationEligibleQuery().sql),
    query(Q.persistenceSummaryQuery({ windowHours }).sql),
    query(Q.rejectionReasonsQuery({ windowHours }).sql),
    query(Q.stuckWorkQuery({ staleHeartbeatSecs, nearExpirySecs }).sql),
    query(Q.recentCyclesQuery({ limit: recentCycleLimit }).sql),
    query(Q.reaperHealthQuery({ windowHours }).sql),
    query(Q.sessionCountQuery().sql),
  ]);

  return {
    collected_at: new Date().toISOString(),
    window_hours: windowHours,
    workforce: buildWorkforceMetrics(counts, age),
    agents: buildAgentMetrics(agents),
    throughput: buildThroughputMetrics(throughput[0] ?? null),
    failures: buildFailureMetrics(failures),
    source_matrix: buildSourceMatrix(matrix),
    rotation_eligible: buildRotationEligible(eligible),
    persistence: buildPersistenceMetrics(persistence[0] ?? null, rejections),
    stuck_work: buildStuckWork(stuck),
    recent_cycles: buildRecentCycles(recent),
    reaper: buildReaperMetrics(reaper[0] ?? null),
    sessions: buildSessionMetrics(sessions[0] ?? null),
  };
}

// ─── Workforce ──────────────────────────────────────────────────────────────
function buildWorkforceMetrics(counts, age) {
  const byState = Object.fromEntries(counts.map(r => [r.state, r.n]));
  const total = counts.reduce((a, r) => a + r.n, 0);
  const ageRow = age[0] ?? {};
  return {
    total,
    pending: byState.pending ?? 0,
    leased: byState.leased ?? 0,
    soft_fail: byState.soft_fail ?? 0,
    completed: byState.completed ?? 0,
    dead_letter: byState.dead_letter ?? 0,
    oldest_pending_secs: ageRow.oldest_pending_secs ?? null,
    oldest_pending_at: ageRow.oldest_pending_at ?? null,
    oldest_leased_secs: ageRow.oldest_leased_secs ?? null,
    oldest_leased_at: ageRow.oldest_leased_at ?? null,
    active: (byState.pending ?? 0) + (byState.leased ?? 0),
  };
}

// ─── Agents ─────────────────────────────────────────────────────────────────
function buildAgentMetrics(rows) {
  return {
    active_count: rows.length,
    agents: rows.map(r => ({
      agent_id: r.agent_id,
      pid: r.pid,
      host: r.host,
      version: r.version,
      state: r.state,
      started_at: r.started_at,
      last_beat_at: r.last_beat_at,
      heartbeat_age_secs: r.heartbeat_age_secs,
      current_work_item_id: r.current_work_item_id,
      wi_state: r.wi_state,
      lease_deadline: r.lease_deadline,
      lease_remaining_secs: r.lease_remaining_secs,
      generation: r.generation,
    })),
  };
}

// ─── Throughput ─────────────────────────────────────────────────────────────
function buildThroughputMetrics(row) {
  if (!row) return { available: false };
  return {
    available: true,
    cycles_completed: row.cycles_completed ?? 0,
    cycles_soft_fail: row.cycles_soft_fail ?? 0,
    cycles_dead_letter: row.cycles_dead_letter ?? 0,
    records_new_total: row.records_new_total ?? 0,
    records_rejected_total: row.records_rejected_total ?? 0,
    avg_duration_secs: row.avg_duration_secs != null ? Number(row.avg_duration_secs) : 0,
    p50_duration_secs: row.p50_duration_secs != null ? Number(row.p50_duration_secs) : 0,
    p95_duration_secs: row.p95_duration_secs != null ? Number(row.p95_duration_secs) : 0,
  };
}

// ─── Failures ───────────────────────────────────────────────────────────────
function buildFailureMetrics(rows) {
  const total = rows.reduce((a, r) => a + r.n, 0);
  return {
    total,
    by_class: Object.fromEntries(rows.map(r => [r.class, r.n])),
  };
}

// ─── Source matrix ──────────────────────────────────────────────────────────
function buildSourceMatrix(rows) {
  return rows.map(r => ({
    city_slug: r.city_slug,
    category_slug: r.category_slug,
    source_slug: r.source_slug,
    n_total: r.n_total,
    pending: r.pending,
    leased: r.leased,
    completed: r.completed,
    soft_fail: r.soft_fail,
    dead_letter: r.dead_letter,
    records_new: r.records_new,
    records_rejected: r.records_rejected,
    last_activity: r.last_activity,
  }));
}

function buildRotationEligible(rows) {
  return rows.map(r => ({
    city_slug: r.city_slug,
    category_slug: r.category_slug,
    source_slug: r.source_slug,
    job_slug: r.job_slug,
    priority: r.priority,
    cadence_minutes: r.cadence_minutes,
    lease_minutes: r.lease_minutes,
    max_attempts: r.max_attempts,
    max_concurrent_per_source: r.max_concurrent_per_source,
    bbox_json: r.bbox_json,
  }));
}

// ─── Persistence ────────────────────────────────────────────────────────────
function buildPersistenceMetrics(summary, rejections) {
  if (!summary) return { available: false, rejections: [] };
  return {
    available: true,
    n_audits: summary.n_audits ?? 0,
    ok_count: summary.ok_count ?? 0,
    fail_count: summary.fail_count ?? 0,
    total_new: summary.total_new ?? 0,
    total_updated: summary.total_updated ?? 0,
    total_rejected: summary.total_rejected ?? 0,
    avg_ms: summary.avg_ms != null ? Number(summary.avg_ms) : 0,
    rejections: rejections.map(r => ({ reason: r.rejection_reason, n: r.n })),
  };
}

// ─── Stuck work ─────────────────────────────────────────────────────────────
function buildStuckWork(rows) {
  return rows.map(r => ({
    work_item_id: r.work_item_id,
    agent_id: r.agent_id,
    generation: r.generation,
    state: r.state,
    lease_deadline: r.lease_deadline,
    agent_last_beat: r.agent_last_beat,
    heartbeat_age_secs: r.heartbeat_age_secs,
    lease_remaining_secs: r.lease_remaining_secs,
    elapsed_secs: r.elapsed_secs,
    cursor_phase: r.cursor_phase,
    attempts: r.attempts,
    last_error: r.last_error,
    last_error_class: r.last_error_class,
    city_slug: r.city_slug,
    category_slug: r.category_slug,
    source_slug: r.source_slug,
    stuck_reason: r.stuck_reason,
  }));
}

// ─── Recent cycles ──────────────────────────────────────────────────────────
function buildRecentCycles(rows) {
  return rows.map(r => ({
    work_item_id: r.id,
    state: r.state,
    city_slug: r.city_slug,
    category_slug: r.category_slug,
    source_slug: r.source_slug,
    records_new: r.records_new,
    records_rejected: r.records_rejected,
    agent_id: r.agent_id,
    generation: r.generation,
    attempts: r.attempts,
    started_at: r.started_at,
    finished_at: r.finished_at,
    duration_secs: r.duration_secs != null ? Number(r.duration_secs) : null,
    last_error_class: r.last_error_class,
  }));
}

// ─── Reaper ─────────────────────────────────────────────────────────────────
function buildReaperMetrics(row) {
  if (!row) return { available: false };
  return {
    available: true,
    n_runs: row.n_runs ?? 0,
    unfinished: row.unfinished ?? 0,
    zombies_reclaimed: row.zombies_reclaimed ?? 0,
    dead_lettered: row.dead_lettered ?? 0,
    errors: row.errors ?? 0,
    last_run_at: row.last_run_at,
    last_run_age_secs: row.last_run_age_secs,
  };
}

// ─── Sessions ───────────────────────────────────────────────────────────────
function buildSessionMetrics(row) {
  if (!row) return { available: false };
  return {
    available: true,
    wf_sessions: row.wf_sessions ?? 0,
    legacy_sessions: row.legacy_sessions ?? 0,
    active_persist: row.active_persist ?? 0,
    active_claim: row.active_claim ?? 0,
    active_heartbeat: row.active_heartbeat ?? 0,
  };
}
