// src/lib/nex-hq/workforce-data.ts
//
// NEX HQ · Workforce page data layer · Philip 2026-08-27.
//
// One SQL query per data need · pure read-only · never mutates rotation state.
// The page composes these into a per-job snapshot.

import { getFoodDbPool } from "@/lib/nex-food/db";
import { loadJobs, type JobEntry } from "./workforce-jobs";

// ── All-workers tally (Philip 2026-08-27 · "confirmation walkers are working") ─
//
// Reads every worker_type present in worker_cycle_run over the last 24h ·
// aggregates: currently running · completed in last 5min · failed in last 5min
// · stopped (no cycle in last 30min but ran within 24h · scheduler-should-be-
// firing signal). Presented as a headline banner + per-type breakdown.

export interface WorkerTypeStats {
  worker_type: string;
  running_now: number;              // status='running' right now
  completed_last_5min: number;      // status='completed' AND finished < 5min ago
  failed_last_5min: number;         // status='failed' AND finished < 5min ago
  cycles_last_24h: number;
  records_new_last_24h: number;
  latest_finish: Date | null;
  latest_status: string | null;
  minutes_since_last_finish: number | null;   // "how long stale"
  is_stopped: boolean;              // no cycle in last 30min but ran in last 24h
}

export interface WorkforceTally {
  totalWorkerTypes: number;
  runningNow: number;
  completedLast5min: number;
  failedLast5min: number;
  stoppedTypes: number;             // worker_types with is_stopped=true
  perType: WorkerTypeStats[];
  measuredAt: Date;
}

export async function loadWorkforceTally(): Promise<WorkforceTally> {
  const pool = getFoodDbPool();
  const r = await pool.query<{
    worker_type: string;
    running_now: number;
    completed_last_5min: number;
    failed_last_5min: number;
    cycles_last_24h: number;
    records_new_last_24h: number;
    latest_finish: Date | null;
    latest_status: string | null;
  }>(`
    SELECT
      worker_type,
      COUNT(*) FILTER (WHERE status = 'running')::int AS running_now,
      COUNT(*) FILTER (WHERE status = 'completed' AND finished_at > now() - interval '5 minutes')::int AS completed_last_5min,
      COUNT(*) FILTER (WHERE status = 'failed'    AND finished_at > now() - interval '5 minutes')::int AS failed_last_5min,
      COUNT(*) FILTER (WHERE started_at > now() - interval '24 hours')::int AS cycles_last_24h,
      COALESCE(SUM(records_new) FILTER (WHERE started_at > now() - interval '24 hours'), 0)::int AS records_new_last_24h,
      MAX(finished_at) AS latest_finish,
      (ARRAY_AGG(status ORDER BY finished_at DESC NULLS LAST))[1] AS latest_status
    FROM nex.worker_cycle_run
    WHERE started_at > now() - interval '24 hours' OR status = 'running'
    GROUP BY worker_type
    ORDER BY MAX(finished_at) DESC NULLS FIRST
  `);

  const now = Date.now();
  const perType: WorkerTypeStats[] = r.rows.map((row) => {
    const minutesStale = row.latest_finish
      ? (now - new Date(row.latest_finish).getTime()) / 60_000
      : null;
    const isStopped = row.cycles_last_24h > 0
      && row.running_now === 0
      && (minutesStale == null || minutesStale > 30);
    return {
      worker_type: row.worker_type,
      running_now: row.running_now,
      completed_last_5min: row.completed_last_5min,
      failed_last_5min: row.failed_last_5min,
      cycles_last_24h: row.cycles_last_24h,
      records_new_last_24h: row.records_new_last_24h,
      latest_finish: row.latest_finish,
      latest_status: row.latest_status,
      minutes_since_last_finish: minutesStale,
      is_stopped: isStopped,
    };
  });

  return {
    totalWorkerTypes: perType.length,
    runningNow: perType.reduce((a, t) => a + t.running_now, 0),
    completedLast5min: perType.reduce((a, t) => a + t.completed_last_5min, 0),
    failedLast5min: perType.reduce((a, t) => a + t.failed_last_5min, 0),
    stoppedTypes: perType.filter((t) => t.is_stopped).length,
    perType,
    measuredAt: new Date(),
  };
}


export type JobStatus =
  | "running"           // 🟢 · walker cycle currently in-flight for this category
  | "queued"            // 🔵 · at least one eligible surface but slot not free
  | "cooling"           // 🟡 · all eligible surfaces cooling (surface-level cooldown)
  | "needs-strategy"    // 🟠 · registered but no rotation-state row exists yet
  | "error"             // 🔴 · latest cycle status = 'failed'
  | "no-legitimate-work"; // ⚪ · all surfaces exhausted AND no cooldown pending

export interface JobSlot {
  job: JobEntry;
  status: JobStatus;
  currentCity: string | null;
  currentProvider: string | null;
  lastCycleFinishedAt: Date | null;
  lastCycleRecordsNew: number | null;
  lastCycleOutcome: string | null;
  recordsLastHour: number;
  recordsLast24h: number;
  cyclesLast24h: number;
  cityStatesForJob: Array<{ city: string; state: string; cooldownUntil: Date | null }>;
  nextEligibleCity: string | null;
  cooldownNext: Date | null;
}

interface RotationRow {
  city: string;
  category: string;
  surface: string;
  state: string;
  cooldown_until: Date | null;
}
interface RunningRow {
  worker_config: string;
  started_at: Date;
}
interface LatestCycleRow {
  worker_config: string;
  finished_at: Date;
  status: string;
  records_new: number | null;
  cycle_outcome: string | null;
}
interface HourlyAggRow {
  category_slug: string;
  records_last_hour: number;
  records_last_24h: number;
  cycles_last_24h: number;
}

async function loadRotationRowsForJobs(pool: ReturnType<typeof getFoodDbPool>, slugs: string[]): Promise<RotationRow[]> {
  if (slugs.length === 0) return [];
  const r = await pool.query<RotationRow>(
    `SELECT city, category, surface, state::text AS state, cooldown_until
       FROM nex.discovery_rotation_state
      WHERE category = ANY($1::text[])`,
    [slugs],
  );
  return r.rows;
}

async function loadRunningRowsForJobs(pool: ReturnType<typeof getFoodDbPool>, slugs: string[]): Promise<RunningRow[]> {
  if (slugs.length === 0) return [];
  // Worker_config format: `<slug>:<City>:<surface>`.
  const patterns = slugs.map((s) => `${s}:%`);
  const r = await pool.query<RunningRow>(
    `SELECT worker_config, started_at
       FROM nex.worker_cycle_run
      WHERE status = 'running'
        AND started_at > now() - interval '2 hours'
        AND worker_config LIKE ANY($1::text[])`,
    [patterns],
  );
  return r.rows;
}

async function loadLatestCycles(pool: ReturnType<typeof getFoodDbPool>, slugs: string[]): Promise<LatestCycleRow[]> {
  if (slugs.length === 0) return [];
  const patterns = slugs.map((s) => `${s}:%`);
  const r = await pool.query<LatestCycleRow>(
    `SELECT DISTINCT ON (worker_config)
            worker_config, finished_at, status, records_new,
            summary->>'cycle_outcome' AS cycle_outcome
       FROM nex.worker_cycle_run
      WHERE finished_at IS NOT NULL
        AND worker_config LIKE ANY($1::text[])
      ORDER BY worker_config, finished_at DESC`,
    [patterns],
  );
  return r.rows;
}

async function loadHourlyAggregates(pool: ReturnType<typeof getFoodDbPool>, slugs: string[]): Promise<HourlyAggRow[]> {
  if (slugs.length === 0) return [];
  const patterns = slugs.map((s) => `${s}:%`);
  const r = await pool.query<HourlyAggRow>(
    `SELECT split_part(worker_config, ':', 1) AS category_slug,
            COALESCE(SUM(records_new) FILTER (WHERE finished_at > now() - interval '1 hour'), 0)::int AS records_last_hour,
            COALESCE(SUM(records_new) FILTER (WHERE finished_at > now() - interval '24 hours'), 0)::int AS records_last_24h,
            COUNT(*) FILTER (WHERE finished_at > now() - interval '24 hours')::int AS cycles_last_24h
       FROM nex.worker_cycle_run
      WHERE finished_at IS NOT NULL
        AND worker_config LIKE ANY($1::text[])
      GROUP BY split_part(worker_config, ':', 1)`,
    [patterns],
  );
  return r.rows;
}

/** Parse `<slug>:<City>:<surface>` into its parts. */
function parseWorkerConfig(cfg: string): { slug: string; city: string; surface: string } | null {
  const parts = cfg.split(":");
  if (parts.length < 3) return null;
  return { slug: parts[0], city: parts[1], surface: parts.slice(2).join(":") };
}

/**
 * Compose per-job slots · one row per JOB, aggregating cities. Preserves
 * Philip's rule: "SURFACE cooldown ≠ WORKFORCE cooldown." A job with even one
 * eligible city is "queued" (or "running" if picked). Only when ALL cities are
 * cooling does the job show "cooling" · only when the registry has no rotation
 * rows at all does it show "needs-strategy".
 */
export async function loadWorkforceSnapshot(): Promise<JobSlot[]> {
  const jobs = loadJobs();
  const slugs = jobs.map((j) => j.category_slug);
  const pool = getFoodDbPool();

  const [rotation, running, latest, hourly] = await Promise.all([
    loadRotationRowsForJobs(pool, slugs),
    loadRunningRowsForJobs(pool, slugs),
    loadLatestCycles(pool, slugs),
    loadHourlyAggregates(pool, slugs),
  ]);

  const rotationBySlug = new Map<string, RotationRow[]>();
  for (const r of rotation) {
    if (!rotationBySlug.has(r.category)) rotationBySlug.set(r.category, []);
    rotationBySlug.get(r.category)!.push(r);
  }

  const runningBySlug = new Map<string, RunningRow>();
  for (const r of running) {
    const p = parseWorkerConfig(r.worker_config);
    if (p && !runningBySlug.has(p.slug)) runningBySlug.set(p.slug, r);
  }

  const latestBySlug = new Map<string, LatestCycleRow>();
  for (const r of latest) {
    const p = parseWorkerConfig(r.worker_config);
    if (!p) continue;
    // DISTINCT ON gives one per worker_config · pick the freshest across cities.
    const existing = latestBySlug.get(p.slug);
    if (!existing || existing.finished_at < r.finished_at) latestBySlug.set(p.slug, r);
  }

  const hourlyBySlug = new Map<string, HourlyAggRow>();
  for (const r of hourly) hourlyBySlug.set(r.category_slug, r);

  const now = Date.now();
  const slots: JobSlot[] = jobs.map((job) => {
    const rows = rotationBySlug.get(job.category_slug) ?? [];
    const currentRun = runningBySlug.get(job.category_slug);
    const currentLatest = latestBySlug.get(job.category_slug);
    const agg = hourlyBySlug.get(job.category_slug);
    const cityStates = rows.map((r) => ({
      city: r.city,
      state: r.state,
      cooldownUntil: r.cooldown_until,
    }));

    // Eligibility rules:
    //   - eligible = state in ('build', 'reactivate') (immediate work)
    //   - cooling = state='saturated' AND cooldown_until in future
    //   - waiting for cooldown expiry = cooling until earliest cooldown_until
    const eligibleCities = rows.filter((r) => r.state === "build" || r.state === "reactivate");
    const coolingCities  = rows.filter((r) => r.state === "saturated" && r.cooldown_until && new Date(r.cooldown_until).getTime() > now);
    const earliestCooldown = coolingCities.length > 0
      ? coolingCities.reduce((a, b) => (new Date(a.cooldown_until!).getTime() < new Date(b.cooldown_until!).getTime() ? a : b))
      : null;

    let status: JobStatus;
    let currentCity: string | null = null;
    let currentProvider: string | null = null;

    if (currentRun) {
      status = "running";
      const p = parseWorkerConfig(currentRun.worker_config);
      currentCity = p?.city ?? null;
      currentProvider = p?.surface ?? null;
    } else if (rows.length === 0) {
      status = "needs-strategy";
    } else if (currentLatest?.status === "failed") {
      status = "error";
    } else if (eligibleCities.length > 0) {
      status = "queued";
      currentCity = eligibleCities[0].city;
      currentProvider = eligibleCities[0].surface;
    } else if (coolingCities.length > 0) {
      status = "cooling";
      currentCity = earliestCooldown?.city ?? null;
      currentProvider = earliestCooldown?.surface ?? null;
    } else {
      status = "no-legitimate-work";
    }

    return {
      job,
      status,
      currentCity,
      currentProvider,
      lastCycleFinishedAt: currentLatest?.finished_at ?? null,
      lastCycleRecordsNew: currentLatest?.records_new ?? null,
      lastCycleOutcome: currentLatest?.cycle_outcome ?? null,
      recordsLastHour: agg?.records_last_hour ?? 0,
      recordsLast24h: agg?.records_last_24h ?? 0,
      cyclesLast24h: agg?.cycles_last_24h ?? 0,
      cityStatesForJob: cityStates,
      nextEligibleCity: eligibleCities[0]?.city ?? null,
      cooldownNext: earliestCooldown?.cooldown_until ?? null,
    };
  });

  return slots;
}
