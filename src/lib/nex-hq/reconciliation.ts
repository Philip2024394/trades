// src/lib/nex-hq/reconciliation.ts · Philip 2026-08-29.
//
// Walker attribution reconciliation. Compares walker-reported production
// (SUM(records_new) over a window from nex.worker_cycle_run) against the
// actual growth of the directory tables over the same window.
//
// Bounds (Philip 2026-08-29): reported / actual should sit between 0.9×
// and 1.5×. The lower bound catches walkers that INSERT into directory
// tables without incrementing records_new; the upper bound catches
// records_new inflation from ON-CONFLICT-DO-NOTHING attempts or snapshot
// rows counted twice. Reconciliation is a signal, not a hard invariant.
//
// Purpose · Philip 2026-08-29:
//   Instrument-panel-only. This function is safe to invoke at any time
//   (READ ONLY · no mutations). Wire to a nightly cron once approved.
//
// Doctrine anchors:
//   · Investigation lock 2026-08-29 · "clean the instrument panel, leave
//     the engine running"

import type pg from "pg";

/** Tables whose row growth is attributed to walkers. */
export const DIRECTORY_TABLES = [
  "nex.food_business",
  "nex.accommodation_business",
  "nex.service_business",
  "nex.mp_seller",
] as const;

/** Default reconciliation window · matches the nightly cadence. */
export const DEFAULT_WINDOW_HOURS = 24;

/** Default bounds (Philip 2026-08-29 · loose). */
export const DEFAULT_LOWER_BOUND = 0.9;
export const DEFAULT_UPPER_BOUND = 1.5;

export interface ReconciliationResult {
  windowHours: number;
  reportedRecordsNew: number;     // SUM(records_new) from nex.worker_cycle_run
  actualDirectoryDelta: number;   // rows added to directory tables in the window
  ratio: number | null;           // reported / actual · null if actual === 0
  lowerBound: number;
  upperBound: number;
  pass: boolean;
  reason: string;
  perTable: Array<{ table: string; delta: number }>;
}

export interface ReconciliationOptions {
  windowHours?: number;
  lowerBound?: number;
  upperBound?: number;
}

/**
 * Reads-only reconciliation check. Uses `created_at` on each directory
 * table for actual growth (all four tables carry it via the standard
 * business-row schema). Returns a structured result that the caller can
 * log, page, or persist to a nightly report.
 */
export async function checkReconciliation(
  pool: pg.Pool,
  opts: ReconciliationOptions = {},
): Promise<ReconciliationResult> {
  const windowHours = opts.windowHours ?? DEFAULT_WINDOW_HOURS;
  const lowerBound  = opts.lowerBound  ?? DEFAULT_LOWER_BOUND;
  const upperBound  = opts.upperBound  ?? DEFAULT_UPPER_BOUND;

  // Reported side · sum records_new across all cycles that started in window.
  const reportedRes = await pool.query<{ reported: string | null }>(
    `SELECT COALESCE(SUM(records_new), 0)::text AS reported
       FROM nex.worker_cycle_run
      WHERE started_at > now() - ($1 || ' hours')::interval`,
    [String(windowHours)],
  );
  const reportedRecordsNew = Number(reportedRes.rows[0]?.reported ?? 0);

  // Actual side · sum row growth per directory table.
  const perTable: Array<{ table: string; delta: number }> = [];
  for (const table of DIRECTORY_TABLES) {
    const r = await pool.query<{ delta: string | null }>(
      `SELECT COUNT(*)::text AS delta FROM ${table}
        WHERE created_at > now() - ($1 || ' hours')::interval`,
      [String(windowHours)],
    );
    perTable.push({ table, delta: Number(r.rows[0]?.delta ?? 0) });
  }
  const actualDirectoryDelta = perTable.reduce((s, r) => s + r.delta, 0);

  return classifyReconciliation({
    reportedRecordsNew,
    actualDirectoryDelta,
    perTable,
    windowHours,
    lowerBound,
    upperBound,
  });
}

/**
 * Pure classifier · separated for unit tests that do not touch the DB.
 */
export function classifyReconciliation(input: {
  reportedRecordsNew: number;
  actualDirectoryDelta: number;
  perTable: Array<{ table: string; delta: number }>;
  windowHours: number;
  lowerBound: number;
  upperBound: number;
}): ReconciliationResult {
  const { reportedRecordsNew, actualDirectoryDelta, perTable, windowHours, lowerBound, upperBound } = input;

  // Guard · both zero is a healthy quiet window, not a failure.
  if (reportedRecordsNew === 0 && actualDirectoryDelta === 0) {
    return {
      windowHours, reportedRecordsNew, actualDirectoryDelta,
      ratio: null, lowerBound, upperBound,
      pass: true,
      reason: `quiet window · 0 reported / 0 actual over ${windowHours}h · no walkers cycled`,
      perTable,
    };
  }

  // If actual is 0 but reported > 0, walkers claim to have added rows that
  // aren't in the directory tables · flag as under-reconciliation.
  if (actualDirectoryDelta === 0) {
    return {
      windowHours, reportedRecordsNew, actualDirectoryDelta,
      ratio: null, lowerBound, upperBound,
      pass: false,
      reason: `${reportedRecordsNew} records reported but directory tables did not grow over ${windowHours}h`,
      perTable,
    };
  }

  const ratio = reportedRecordsNew / actualDirectoryDelta;
  const pass = ratio >= lowerBound && ratio <= upperBound;
  const reason = pass
    ? `ratio ${ratio.toFixed(2)} within [${lowerBound}, ${upperBound}] · reported ${reportedRecordsNew} vs actual ${actualDirectoryDelta} over ${windowHours}h`
    : ratio < lowerBound
      ? `under-reconciliation · ratio ${ratio.toFixed(2)} < ${lowerBound} · walkers may be inserting without incrementing records_new`
      : `over-reconciliation · ratio ${ratio.toFixed(2)} > ${upperBound} · records_new may be inflated (snapshot rows / conflict attempts counted as new)`;

  return {
    windowHours, reportedRecordsNew, actualDirectoryDelta,
    ratio, lowerBound, upperBound,
    pass, reason, perTable,
  };
}
