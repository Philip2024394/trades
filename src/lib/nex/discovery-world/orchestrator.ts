// src/lib/nex/discovery-world/orchestrator.ts
//
// NEX World Email Intelligence · Part 7-9 · Continuous 5-minute orchestrator
// Founder-authorised programme · Session-3 · 2026-09-21.
//
// TWO-CLOCK DISCIPLINE (Founder rule):
//   1 · Orchestration clock (this module)  · 5-minute cadence · claims bounded work
//   2 · Source politeness clock (existing)  · per-domain · robots · rate-limits
//
// Idempotency: same tick fired twice within the same minute is a no-op
// (returns the existing row · never double-processes).
//
// Leader election: single writer per (programme, minute_bucket) via UNIQUE
// constraint on nex.discovery_orchestrator_leader. Second worker gets 0 rows
// and skips silently.
//
// Reaper: expired country claims + stalled cycles reset to safe state
// deterministically · no fake activity ever remains on the map.

import type { PoolClient } from "pg";
import { loadCountryStates } from "./country-state";
import { loadProgrammeBySlug, loadProgrammeCountries } from "./programme";

// ─── Reaper ─────────────────────────────────────────────────────────
export interface ReaperOutcome {
  readonly expired_claims_reset: number;
  readonly stalled_cycles_marked_failed: number;
}

/** Runs the reaper before any planning: dead workers' claims expire · stalled
 *  cycles marked 'failed'. Idempotent. */
export async function runReaper(client: PoolClient): Promise<ReaperOutcome> {
  const expClaims = await client.query(`
    UPDATE nex.discovery_country_state
       SET status = 'idle',
           current_cycle_id = NULL,
           claimed_at = NULL,
           claimed_by = NULL,
           activity_expires_at = NULL,
           updated_at = now()
     WHERE activity_expires_at IS NOT NULL
       AND activity_expires_at < now()
  `);
  const stalled = await client.query(`
    UPDATE nex.discovery_cycle
       SET outcome = 'failed',
           finished_at = COALESCE(finished_at, now()),
           note = COALESCE(note, 'reaped · stalled beyond 10 minutes')
     WHERE outcome = 'in_progress'
       AND started_at < now() - INTERVAL '10 minutes'
  `);
  return {
    expired_claims_reset: expClaims.rowCount ?? 0,
    stalled_cycles_marked_failed: stalled.rowCount ?? 0,
  };
}

// ─── Leader election (single-writer per tick window) ────────────────
export async function tryAcquireLeader(
  client: PoolClient,
  input: { programme_id: string; minute_bucket: Date; worker_id: string },
): Promise<{ acquired: boolean; incumbent: string | null }> {
  const res = await client.query(
    `INSERT INTO nex.discovery_orchestrator_leader (programme_id, minute_bucket, worker_id, acquired_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (programme_id, minute_bucket) DO NOTHING
     RETURNING worker_id`,
    [input.programme_id, input.minute_bucket.toISOString(), input.worker_id],
  );
  if (res.rowCount === 1) return { acquired: true, incumbent: input.worker_id };
  const incumbent = await client.query<{ worker_id: string }>(
    `SELECT worker_id FROM nex.discovery_orchestrator_leader
      WHERE programme_id = $1 AND minute_bucket = $2 LIMIT 1`,
    [input.programme_id, input.minute_bucket.toISOString()],
  );
  return { acquired: false, incumbent: incumbent.rows[0]?.worker_id ?? null };
}

export async function releaseLeader(
  client: PoolClient,
  input: { programme_id: string; minute_bucket: Date; worker_id: string },
): Promise<void> {
  await client.query(
    `UPDATE nex.discovery_orchestrator_leader
        SET released_at = now()
      WHERE programme_id = $1 AND minute_bucket = $2 AND worker_id = $3 AND released_at IS NULL`,
    [input.programme_id, input.minute_bucket.toISOString(), input.worker_id],
  );
}

// ─── Next tick_seq (monotonic) ──────────────────────────────────────
async function nextTickSeq(client: PoolClient): Promise<number> {
  const r = await client.query<{ n: number }>(
    `SELECT COALESCE(MAX(tick_seq), 0) + 1 AS n FROM nex.discovery_orchestrator_tick`,
  );
  return r.rows[0].n;
}

// ─── Public: run one orchestration tick ─────────────────────────────
export interface OrchestrationTickInput {
  readonly programme_slug: string;
  readonly worker_id: string;
  readonly max_countries_per_tick: number;                // bounded (§14 politeness)
  readonly now?: () => Date;
}

export interface OrchestrationTickReport {
  readonly tick_id: string;
  readonly tick_seq: number;
  readonly tick_at: string;
  readonly minute_bucket: string;
  readonly finished_at: string;
  readonly duration_ms: number;
  readonly leader: string;
  readonly worker_id: string;

  readonly cycles_planned: number;
  readonly cycles_started: number;
  readonly cycles_skipped: number;
  readonly countries_touched: ReadonlyArray<string>;
  readonly programmes_touched: ReadonlyArray<string>;

  readonly reaped_stalled_cycles: number;
  readonly reaped_expired_claims: number;

  readonly outcome: "in_progress" | "complete" | "partial" | "no_work" | "superseded";
  readonly note: string | null;
}

function minuteBucket(d: Date): Date {
  return new Date(Math.floor(d.getTime() / 60_000) * 60_000);
}

/** Plans and records one orchestration tick. Idempotent by (worker_id, minute).
 *  IMPORTANT: this function does NOT run the underlying discovery cycles.
 *  It plans them, claims leadership, and records the plan. Actual cycle work
 *  runs through the existing cron endpoint (`/api/cron/nex-discovery-tick`)
 *  which uses the cycle service. Separation preserves the two-clock rule and
 *  makes the orchestrator itself trivially fast + testable. */
export async function runOrchestrationTick(
  client: PoolClient,
  input: OrchestrationTickInput,
): Promise<OrchestrationTickReport> {
  const now_fn = input.now ?? (() => new Date());
  const t0 = now_fn();
  const bucket = minuteBucket(t0);

  // 1 · Idempotency check · if this (worker, minute) already recorded, return it
  const existing = await client.query(
    `SELECT * FROM nex.discovery_orchestrator_tick WHERE worker_id = $1 AND minute_bucket = $2`,
    [input.worker_id, bucket.toISOString()],
  );
  if (existing.rowCount === 1) {
    return rowToReport(existing.rows[0]);
  }

  // 2 · Resolve programme
  const programme = await loadProgrammeBySlug(client, input.programme_slug);
  if (!programme) throw new Error(`orchestrator · unknown programme slug '${input.programme_slug}'`);

  // 3 · Leader election · if lost, superseded
  const lock = await tryAcquireLeader(client, { programme_id: programme.programme_id, minute_bucket: bucket, worker_id: input.worker_id });
  if (!lock.acquired) {
    const tick_seq = await nextTickSeq(client);
    const rowRes = await client.query(
      `INSERT INTO nex.discovery_orchestrator_tick
         (tick_seq, tick_at, minute_bucket, finished_at, duration_ms, leader, worker_id, outcome, note)
       VALUES ($1, $2, $3, now(), 0, $4, $5, 'superseded', $6)
       RETURNING *`,
      [tick_seq, t0.toISOString(), bucket.toISOString(), lock.incumbent ?? "unknown", input.worker_id, `superseded by ${lock.incumbent ?? "unknown"} for programme ${programme.slug}`],
    );
    return rowToReport(rowRes.rows[0]);
  }

  // 4 · Reaper before planning
  const reaper = await runReaper(client);

  // 5 · Plan the tick: which countries need work?
  const countries = await loadProgrammeCountries(client, programme.programme_id);
  const states = await loadCountryStates(client, programme.programme_id);
  const stateByIso = new Map(states.map(s => [s.iso_alpha_2, s]));

  const planned: string[] = [];
  const skipped: string[] = [];
  for (const c of countries) {
    if (planned.length >= input.max_countries_per_tick) break;
    const s = stateByIso.get(c.iso);
    // Skip countries still actively crawling · they'll be picked up next tick
    if (s && (s.status === "crawling" || s.status === "processing")) { skipped.push(c.iso); continue; }
    // Skip if last completed recently (respect politeness at country level)
    if (s?.last_completed_at) {
      const since = t0.getTime() - Date.parse(s.last_completed_at);
      if (since < programme.cadence_seconds * 1000) { skipped.push(c.iso); continue; }
    }
    planned.push(c.iso);
  }

  const t1 = now_fn();
  const duration_ms = t1.getTime() - t0.getTime();
  const outcome: OrchestrationTickReport["outcome"] =
    planned.length === 0 ? "no_work"
    : planned.length === input.max_countries_per_tick ? "partial"
    : "complete";
  const tick_seq = await nextTickSeq(client);
  const rowRes = await client.query(
    `INSERT INTO nex.discovery_orchestrator_tick
       (tick_seq, tick_at, minute_bucket, finished_at, duration_ms, leader, worker_id,
        cycles_planned, cycles_started, cycles_skipped, countries_touched, programmes_touched,
        reaped_stalled_cycles, reaped_expired_claims, outcome, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      tick_seq, t0.toISOString(), bucket.toISOString(), t1.toISOString(), duration_ms,
      input.worker_id, input.worker_id,
      planned.length, skipped.length, planned, [programme.slug],
      reaper.stalled_cycles_marked_failed, reaper.expired_claims_reset,
      outcome, null,
    ],
  );

  await releaseLeader(client, { programme_id: programme.programme_id, minute_bucket: bucket, worker_id: input.worker_id });
  return rowToReport(rowRes.rows[0]);
}

// ─── Read: recent ticks (for Founder monitor) ───────────────────────
export async function loadRecentTicks(client: PoolClient, limit: number = 12): Promise<ReadonlyArray<OrchestrationTickReport>> {
  const res = await client.query(
    `SELECT * FROM nex.discovery_orchestrator_tick ORDER BY tick_seq DESC LIMIT $1`,
    [limit],
  );
  return res.rows.map(rowToReport);
}

// ─── Read: orchestration status (current tick + cadence) ────────────
export interface OrchestrationStatus {
  readonly programme_slug: string | null;
  readonly last_tick: OrchestrationTickReport | null;
  readonly next_expected_at: string | null;
  readonly cadence_seconds: number;
}

export async function loadOrchestrationStatus(client: PoolClient, programme_slug: string): Promise<OrchestrationStatus> {
  const programme = await loadProgrammeBySlug(client, programme_slug);
  const recent = await loadRecentTicks(client, 1);
  const last = recent[0] ?? null;
  let next: string | null = null;
  if (last?.tick_at) {
    next = new Date(Date.parse(last.tick_at) + (programme?.cadence_seconds ?? 300) * 1000).toISOString();
  }
  return {
    programme_slug: programme?.slug ?? null,
    last_tick: last,
    next_expected_at: next,
    cadence_seconds: programme?.cadence_seconds ?? 300,
  };
}

function rowToReport(r: any): OrchestrationTickReport {
  return {
    tick_id: r.tick_id, tick_seq: Number(r.tick_seq),
    tick_at: r.tick_at, minute_bucket: r.minute_bucket,
    finished_at: r.finished_at, duration_ms: Number(r.duration_ms ?? 0),
    leader: r.leader, worker_id: r.worker_id,
    cycles_planned: Number(r.cycles_planned ?? 0),
    cycles_started: Number(r.cycles_started ?? 0),
    cycles_skipped: Number(r.cycles_skipped ?? 0),
    countries_touched: r.countries_touched ?? [],
    programmes_touched: r.programmes_touched ?? [],
    reaped_stalled_cycles: Number(r.reaped_stalled_cycles ?? 0),
    reaped_expired_claims: Number(r.reaped_expired_claims ?? 0),
    outcome: r.outcome, note: r.note,
  };
}

export const _ORCHESTRATOR_TWO_CLOCK_DISCIPLINE = "orchestration_cadence_never_overrides_source_politeness";
export const _ORCHESTRATOR_LEADER_SINGLE_WRITER = "one_writer_per_programme_minute_bucket";
