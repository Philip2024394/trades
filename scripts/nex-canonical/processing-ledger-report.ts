// scripts/nex-canonical/processing-ledger-report.ts
//
// NEX Directory · Emit a per-vertical × per-state × per-next-action
// matrix from `nex.directory_processing_ledger` as JSON for machine
// consumption.
//
// WHAT THIS SCRIPT DOES
//   Opens one read-only session to NEX_POSTGRES_URL, calls the
//   service module's `getStateReport()` (which issues a single
//   GROUP BY query), and prints a shaped JSON report to stdout:
//
//     {
//       "generated_at": "...",
//       "ledger_table": "nex.directory_processing_ledger",
//       "totals": {
//         "all_rows": N,
//         "by_processing_state": { PENDING: N, RESOLVED: N, ... },
//         "by_next_action":      { INGEST: N, RESOLVE: N,  ... },
//         "by_source_table":     { "nex.food_business": N, ... }
//       },
//       "matrix": [
//         {
//           "source_table": "nex.food_business",
//           "processing_state": "PENDING",
//           "next_action": "INGEST",
//           "count": 12345
//         },
//         ...
//       ]
//     }
//
//   Every (source_table, processing_state, next_action) cell with a
//   count > 0 appears in `matrix`. Cells with 0 rows are omitted ·
//   downstream consumers can fill them with 0 if required.
//
// WHAT THIS SCRIPT DOES NOT DO
//   · Does NOT write to any table. Pure SELECT.
//   · Does NOT run the ingestion pipeline.
//   · Does NOT reconcile against the legacy vertical row counts (that
//     is a separate audit tool).
//
// SAFETY
//   · One SELECT statement.
//   · Prints JSON only · no human-readable prose (machine consumption).
//
// PRECONDITIONS
//   · Migration 189 must be applied. The ledger table must exist.
//   · NEX_POSTGRES_URL must point at the NEX Canonical database.

import { Client } from "pg";
import {
  LEDGER_TABLE,
  NEXT_ACTIONS,
  PROCESSING_STATES,
  SOURCE_TABLES,
  getStateReport,
  type LedgerSession,
  type NextAction,
  type ProcessingState,
  type SourceTable,
  type StateReportRow,
} from "../../src/lib/nex-canonical/directory-processing-ledger";

// ═════════════════════════════════════════════════════════════════════
// §1 · Session adapter for the pg Client
// ═════════════════════════════════════════════════════════════════════

function sessionFromClient(client: Client): LedgerSession {
  return {
    async query<T = Record<string, unknown>>(
      sql: string,
      params: readonly unknown[],
    ): Promise<{ readonly rows: readonly T[]; readonly rowCount: number }> {
      const r = await client.query<T>(sql, [...params]);
      return { rows: r.rows, rowCount: r.rowCount ?? 0 };
    },
  };
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Report shape
// ═════════════════════════════════════════════════════════════════════

export interface ProcessingLedgerReport {
  readonly generated_at: string;
  readonly ledger_table: string;
  readonly totals: {
    readonly all_rows: number;
    readonly by_processing_state: Readonly<Record<ProcessingState, number>>;
    readonly by_next_action: Readonly<Record<NextAction, number>>;
    readonly by_source_table: Readonly<Record<SourceTable, number>>;
  };
  readonly matrix: readonly StateReportRow[];
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Report builder (pure · exported for testing + reuse)
// ═════════════════════════════════════════════════════════════════════

/** Build the shaped report from a flat matrix. Pure function · no
 *  session, no clock other than `now`. */
export function buildReport(
  matrix: readonly StateReportRow[],
  now: Date,
): ProcessingLedgerReport {
  const byState: Record<ProcessingState, number> = Object.fromEntries(
    PROCESSING_STATES.map((s) => [s, 0]),
  ) as Record<ProcessingState, number>;
  const byAction: Record<NextAction, number> = Object.fromEntries(
    NEXT_ACTIONS.map((a) => [a, 0]),
  ) as Record<NextAction, number>;
  const bySource: Record<SourceTable, number> = Object.fromEntries(
    SOURCE_TABLES.map((t) => [t, 0]),
  ) as Record<SourceTable, number>;

  let total = 0;
  for (const row of matrix) {
    byState[row.processing_state] += row.count;
    byAction[row.next_action] += row.count;
    bySource[row.source_table] += row.count;
    total += row.count;
  }

  return {
    generated_at: now.toISOString(),
    ledger_table: LEDGER_TABLE,
    totals: {
      all_rows: total,
      by_processing_state: byState,
      by_next_action: byAction,
      by_source_table: bySource,
    },
    matrix,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Preflight · confirm migration 189 is applied
// ═════════════════════════════════════════════════════════════════════

async function assertLedgerExists(client: Client): Promise<void> {
  const r = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'nex' AND table_name = 'directory_processing_ledger'
     ) AS exists`,
    [],
  );
  if (!r.rows[0]?.exists) {
    throw new Error(
      "nex.directory_processing_ledger does not exist. Apply migration 189 (deploy/postgres/init/189_nex_directory_processing_ledger.sql) first.",
    );
  }
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Main
// ═════════════════════════════════════════════════════════════════════

async function main(): Promise<number> {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) {
    console.error("processing-ledger-report · NEX_POSTGRES_URL is not set.");
    return 2;
  }
  const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
  const client = new Client({
    connectionString: url,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    await assertLedgerExists(client);
    const matrix = await getStateReport(sessionFromClient(client));
    const report = buildReport(matrix, new Date());
    // JSON-only output · the whole point is machine consumption.
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return 0;
  } finally {
    await client.end();
  }
}

// ─── Entrypoint (only when invoked directly) ────────────────────────
const isDirect = (() => {
  try {
    const argv1 = process.argv[1] ?? "";
    return argv1.endsWith("processing-ledger-report.ts") ||
           argv1.endsWith("processing-ledger-report.mjs");
  } catch { return false; }
})();

if (isDirect) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error("processing-ledger-report · unexpected error:", (e as Error).message);
    process.exit(99);
  });
}

export { main };
