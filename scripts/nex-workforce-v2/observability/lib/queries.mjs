// NEX Workforce v2 · Observability · SQL query builders
// ─────────────────────────────────────────────────────────────────────────────
// Pure SQL. No side effects. No mutations. Every query is SELECT-only.
// Each exported function returns a { sql, params?, description } object.
//
// Design rules (per C7 Section 13):
//   · No UPDATE, INSERT, DELETE, TRUNCATE
//   · No function calls that mutate (fail_soft, complete, claim, reap, etc.)
//   · Bounded time windows on all history-scanning queries
//   · Uses existing indexes documented in discovery report

// ─── Workforce counts (Section 5 · WORKFORCE) ───────────────────────────────
export const workforceCountsQuery = () => ({
  description: "Work-item counts by state · uses work_item_claim index",
  sql: `SELECT state, count(*)::int AS n FROM nex_workforce.work_item GROUP BY state ORDER BY state`,
});

export const workforceAgeQuery = () => ({
  description: "Oldest pending + leased age · bounded",
  sql: `SELECT
    (SELECT EXTRACT(EPOCH FROM (now() - MIN(enqueued_at)))::int
       FROM nex_workforce.work_item
      WHERE state = 'pending' AND next_eligible_at <= now()) AS oldest_pending_secs,
    (SELECT MIN(enqueued_at)
       FROM nex_workforce.work_item
      WHERE state = 'pending' AND next_eligible_at <= now()) AS oldest_pending_at,
    (SELECT EXTRACT(EPOCH FROM (now() - MIN(started_at)))::int
       FROM nex_workforce.work_item
      WHERE state = 'leased') AS oldest_leased_secs,
    (SELECT MIN(started_at)
       FROM nex_workforce.work_item
      WHERE state = 'leased') AS oldest_leased_at`,
});

// ─── Agents (Section 5 · AGENTS) ────────────────────────────────────────────
export const activeAgentsQuery = ({ heartbeatFreshSecs = 300 } = {}) => ({
  description: `Active agents · heartbeat within last ${heartbeatFreshSecs}s`,
  sql: `SELECT
    hb.agent_id,
    hb.pid,
    hb.host,
    hb.version,
    hb.state,
    hb.started_at,
    hb.last_beat_at,
    EXTRACT(EPOCH FROM (now() - hb.last_beat_at))::int AS heartbeat_age_secs,
    hb.current_work_item_id,
    wi.state AS wi_state,
    wi.lease_deadline,
    EXTRACT(EPOCH FROM (wi.lease_deadline - now()))::int AS lease_remaining_secs,
    wi.generation
  FROM nex_workforce.agent_heartbeat hb
  LEFT JOIN nex_workforce.work_item wi ON wi.id = hb.current_work_item_id
  WHERE hb.last_beat_at >= now() - make_interval(secs => ${Number(heartbeatFreshSecs)})
  ORDER BY hb.last_beat_at DESC`,
});

// ─── Throughput (Section 5 · THROUGHPUT) ────────────────────────────────────
export const throughputQuery = ({ windowHours = 24 } = {}) => ({
  description: `Throughput over last ${windowHours}h · counts + records + avg/p50/p95 duration (percentiles use subquery · ordered-set aggregates don't accept FILTER)`,
  sql: `SELECT
    count(*) FILTER (WHERE state='completed')::int    AS cycles_completed,
    count(*) FILTER (WHERE state='soft_fail')::int    AS cycles_soft_fail,
    count(*) FILTER (WHERE state='dead_letter')::int  AS cycles_dead_letter,
    COALESCE(sum(records_new)      FILTER (WHERE state='completed'), 0)::int AS records_new_total,
    COALESCE(sum(records_rejected) FILTER (WHERE state='completed'), 0)::int AS records_rejected_total,
    COALESCE(EXTRACT(EPOCH FROM avg(finished_at - started_at)
               FILTER (WHERE state='completed' AND finished_at IS NOT NULL AND started_at IS NOT NULL)), 0)::numeric(10,2) AS avg_duration_secs,
    -- percentiles use subqueries (percentile_cont is an ordered-set aggregate · no FILTER clause allowed)
    COALESCE((SELECT EXTRACT(EPOCH FROM percentile_cont(0.5) WITHIN GROUP (ORDER BY (finished_at - started_at)))
                FROM nex_workforce.work_item
               WHERE state='completed' AND finished_at IS NOT NULL AND started_at IS NOT NULL
                 AND finished_at >= now() - make_interval(hours => ${Number(windowHours)})), 0)::numeric(10,2) AS p50_duration_secs,
    COALESCE((SELECT EXTRACT(EPOCH FROM percentile_cont(0.95) WITHIN GROUP (ORDER BY (finished_at - started_at)))
                FROM nex_workforce.work_item
               WHERE state='completed' AND finished_at IS NOT NULL AND started_at IS NOT NULL
                 AND finished_at >= now() - make_interval(hours => ${Number(windowHours)})), 0)::numeric(10,2) AS p95_duration_secs
  FROM nex_workforce.work_item
  WHERE finished_at >= now() - make_interval(hours => ${Number(windowHours)})
     OR (state IN ('leased','pending','soft_fail') AND updated_at >= now() - make_interval(hours => ${Number(windowHours)}))`,
});

// ─── Failure classes (Section 5 · FAILURES) ─────────────────────────────────
export const failureClassQuery = ({ windowHours = 24 } = {}) => ({
  description: `Failure class distribution over last ${windowHours}h · from work_item + work_item_dead_letter`,
  sql: `SELECT last_error_class AS class, count(*)::int AS n
   FROM (
     SELECT last_error_class FROM nex_workforce.work_item
      WHERE state IN ('soft_fail','dead_letter')
        AND last_error_class IS NOT NULL
        AND updated_at >= now() - make_interval(hours => ${Number(windowHours)})
     UNION ALL
     SELECT last_error_class FROM nex_workforce.work_item_dead_letter
      WHERE last_error_class IS NOT NULL
        AND moved_at >= now() - make_interval(hours => ${Number(windowHours)})
   ) x
   GROUP BY last_error_class
   ORDER BY n DESC`,
});

// ─── Source / City / Category matrix (Section 5, 10) ────────────────────────
export const sourceMatrixQuery = () => ({
  description: "City × Category × Source matrix · all work_item history",
  sql: `SELECT city_slug, category_slug, source_slug,
    count(*)::int AS n_total,
    count(*) FILTER (WHERE state='pending')::int     AS pending,
    count(*) FILTER (WHERE state='leased')::int      AS leased,
    count(*) FILTER (WHERE state='completed')::int   AS completed,
    count(*) FILTER (WHERE state='soft_fail')::int   AS soft_fail,
    count(*) FILTER (WHERE state='dead_letter')::int AS dead_letter,
    COALESCE(sum(records_new)      FILTER (WHERE state='completed'), 0)::int AS records_new,
    COALESCE(sum(records_rejected) FILTER (WHERE state='completed'), 0)::int AS records_rejected,
    MAX(finished_at) AS last_activity
  FROM nex_workforce.work_item
  GROUP BY city_slug, category_slug, source_slug
  ORDER BY last_activity DESC NULLS LAST`,
});

export const rotationEligibleQuery = () => ({
  description: "Currently eligible (city × job) tuples from rotation_eligible view",
  sql: `SELECT * FROM nex_workforce.rotation_eligible ORDER BY priority DESC`,
});

// ─── Persistence (Section 5 · PERSISTENCE) ──────────────────────────────────
export const persistenceSummaryQuery = ({ windowHours = 24 } = {}) => ({
  description: `Persistence summary over last ${windowHours}h`,
  sql: `SELECT
    count(*)::int                              AS n_audits,
    count(*) FILTER (WHERE ok = true)::int     AS ok_count,
    count(*) FILTER (WHERE ok = false)::int    AS fail_count,
    COALESCE(sum(new_rows), 0)::int            AS total_new,
    COALESCE(sum(updated_rows), 0)::int        AS total_updated,
    COALESCE(sum(rejected_rows), 0)::int       AS total_rejected,
    COALESCE(avg(duration_ms), 0)::numeric(10,2) AS avg_ms
  FROM nex_workforce.persist_audit
  WHERE at >= now() - make_interval(hours => ${Number(windowHours)})`,
});

export const rejectionReasonsQuery = ({ windowHours = 24, limit = 20 } = {}) => ({
  description: `Rejection reasons over last ${windowHours}h · top ${limit}`,
  sql: `SELECT rejection_reason, count(*)::int AS n
   FROM nex_workforce.candidate_staging
   WHERE rejected = true
     AND rejected_at >= now() - make_interval(hours => ${Number(windowHours)})
   GROUP BY rejection_reason
   ORDER BY n DESC
   LIMIT ${Number(limit)}`,
});

// ─── Stuck-work detection (Section 7) · READ-ONLY report ────────────────────
export const stuckWorkQuery = ({ staleHeartbeatSecs = 120, nearExpirySecs = 60 } = {}) => ({
  description: `Stuck work · leased items with stale heartbeat (>${staleHeartbeatSecs}s), missing heartbeat, near-expiry lease (<${nearExpirySecs}s remaining), or already-expired lease`,
  sql: `SELECT
    wi.id::text AS work_item_id,
    wi.agent_id,
    wi.generation,
    wi.state,
    wi.lease_deadline,
    hb.last_beat_at AS agent_last_beat,
    EXTRACT(EPOCH FROM (now() - hb.last_beat_at))::int AS heartbeat_age_secs,
    EXTRACT(EPOCH FROM (wi.lease_deadline - now()))::int AS lease_remaining_secs,
    EXTRACT(EPOCH FROM (now() - wi.started_at))::int AS elapsed_secs,
    wi.cursor_json->>'phase' AS cursor_phase,
    wi.attempts,
    wi.last_error,
    wi.last_error_class,
    wi.city_slug,
    wi.category_slug,
    wi.source_slug,
    CASE
      WHEN wi.lease_deadline < now() THEN 'lease_expired'
      WHEN hb.last_beat_at IS NULL THEN 'no_heartbeat_record'
      WHEN hb.last_beat_at < now() - make_interval(secs => ${Number(staleHeartbeatSecs)}) THEN 'stale_heartbeat'
      WHEN wi.lease_deadline - now() < make_interval(secs => ${Number(nearExpirySecs)}) THEN 'near_expiry'
      ELSE 'other'
    END AS stuck_reason
  FROM nex_workforce.work_item wi
  LEFT JOIN nex_workforce.agent_heartbeat hb ON hb.agent_id = wi.agent_id
  WHERE wi.state = 'leased'
    AND (
      wi.lease_deadline < now()
      OR hb.last_beat_at IS NULL
      OR hb.last_beat_at < now() - make_interval(secs => ${Number(staleHeartbeatSecs)})
      OR wi.lease_deadline - now() < make_interval(secs => ${Number(nearExpirySecs)})
    )
  ORDER BY wi.started_at ASC`,
});

// ─── Recent cycles (Section 11 dashboard priority #4) ───────────────────────
export const recentCyclesQuery = ({ limit = 20 } = {}) => ({
  description: `Most recent ${limit} completed/failed cycles · limit bounded`,
  sql: `SELECT id::text, state, city_slug, category_slug, source_slug,
      records_new, records_rejected, agent_id, generation, attempts,
      started_at, finished_at,
      EXTRACT(EPOCH FROM (finished_at - started_at))::numeric(10,2) AS duration_secs,
      last_error_class
   FROM nex_workforce.work_item
   WHERE state IN ('completed','soft_fail','dead_letter')
   ORDER BY COALESCE(finished_at, updated_at) DESC
   LIMIT ${Number(limit)}`,
});

// ─── Reaper health (Section 5 · beyond spec but useful) ─────────────────────
export const reaperHealthQuery = ({ windowHours = 24 } = {}) => ({
  description: `Reaper activity over last ${windowHours}h · used to detect reaper crash`,
  sql: `SELECT
    count(*)::int AS n_runs,
    count(*) FILTER (WHERE finished_at IS NULL)::int AS unfinished,
    COALESCE(sum(zombies_reclaimed), 0)::int AS zombies_reclaimed,
    COALESCE(sum(dead_lettered), 0)::int AS dead_lettered,
    COALESCE(sum(errors), 0)::int AS errors,
    MAX(started_at) AS last_run_at,
    EXTRACT(EPOCH FROM (now() - MAX(started_at)))::int AS last_run_age_secs
   FROM nex_workforce.reaper_run
   WHERE started_at >= now() - make_interval(hours => ${Number(windowHours)})`,
});

// ─── Session activity (workforce processes actually running against DB) ─────
export const sessionCountQuery = () => ({
  description: "Live workforce DB sessions (pg_stat_activity)",
  sql: `SELECT
    count(*) FILTER (WHERE application_name ILIKE '%nex_workforce%')::int AS wf_sessions,
    count(*) FILTER (WHERE application_name ILIKE '%acquisition%')::int   AS legacy_sessions,
    count(*) FILTER (WHERE state='active' AND query ILIKE '%persist_batch%')::int AS active_persist,
    count(*) FILTER (WHERE state='active' AND query ILIKE '%claim%')::int  AS active_claim,
    count(*) FILTER (WHERE state='active' AND query ILIKE '%heartbeat%')::int AS active_heartbeat
   FROM pg_stat_activity`,
});
