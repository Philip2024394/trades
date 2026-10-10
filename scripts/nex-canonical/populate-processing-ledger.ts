// scripts/nex-canonical/populate-processing-ledger.ts
//
// NEX Directory · Populate the per-source-row processing ledger from
// the 5 sealed legacy vertical tables.
//
// WHAT THIS SCRIPT DOES
//   For every row currently in each of the 5 sealed legacy vertical
//   tables:
//     nex.food_business          (internal_id uuid)
//     nex.accommodation_business (internal_id uuid)
//     nex.service_business       (internal_id uuid)
//     nex.mp_seller              (seller_id   uuid)
//     nex.bike_rental_listing    (rental_id   uuid)
//   insert a corresponding row into `nex.directory_processing_ledger`
//   with processing_state = 'PENDING' and next_action = 'INGEST'.
//   The INSERT is idempotent via
//     `ON CONFLICT (source_table, source_internal_id) DO NOTHING`
//   so this script may be re-run safely as new legacy rows accrue.
//
// WHAT THIS SCRIPT DOES NOT DO
//   · Does NOT run the directory ingestion pipeline. It only seeds
//     the ledger · the runner is a separate module.
//   · Does NOT write to `nex.business_canonical`, `nex.business_
//     evidence`, or `nex.business_canonical_lifecycle_log`.
//   · Does NOT advance any ledger row beyond PENDING / INGEST.
//   · Does NOT read environment variables other than NEX_POSTGRES_URL.
//
// SAFETY
//   · Pure read-then-insert · never DELETEs or UPDATEs ledger rows.
//   · Executes in page-sized batches to bound memory + statement time.
//   · Prints a per-vertical summary + exits non-zero on any failure.
//
// PRECONDITIONS
//   · Migration 189 must be applied. The ledger table must exist.
//   · The 5 legacy vertical tables must exist (migrations 054, 078,
//     110, 096, 132).
//   · NEX_POSTGRES_URL must point at the NEX Canonical database.
//
// NOT APPLIED
//   Migration 189 is NOT YET APPLIED (sealed · founder authorisation
//   required). This script will refuse to proceed if the ledger table
//   does not exist · operator must apply the migration first.

import { Client } from "pg";
import {
  LEDGER_TABLE,
  SOURCE_TABLES,
  type SourceTable,
} from "../../src/lib/nex-canonical/directory-processing-ledger";

// ═════════════════════════════════════════════════════════════════════
// §1 · Config · one entry per sealed vertical
// ═════════════════════════════════════════════════════════════════════

interface VerticalConfig {
  readonly source_table: SourceTable;
  /** The column name of the legacy row PK · passed as text to the
   *  ledger (which stores source_internal_id as text). */
  readonly pk_column: string;
}

const VERTICALS: readonly VerticalConfig[] = Object.freeze([
  { source_table: "nex.food_business",          pk_column: "internal_id" },
  { source_table: "nex.accommodation_business", pk_column: "internal_id" },
  { source_table: "nex.service_business",       pk_column: "internal_id" },
  { source_table: "nex.mp_seller",              pk_column: "seller_id"  },
  { source_table: "nex.bike_rental_listing",    pk_column: "rental_id"  },
]);

/** Page size for the SELECT · bounded so a single transaction never
 *  grabs more than this many legacy rows at once. */
const PAGE_SIZE = 1000;

// ═════════════════════════════════════════════════════════════════════
// §2 · Preflight · confirm migration 189 is applied
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

async function assertVerticalExists(
  client: Client,
  config: VerticalConfig,
): Promise<boolean> {
  const [schema, table] = config.source_table.split(".");
  const r = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
     ) AS exists`,
    [schema, table],
  );
  return r.rows[0]?.exists === true;
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Populate one vertical
// ═════════════════════════════════════════════════════════════════════

interface VerticalPopulateReport {
  readonly source_table: SourceTable;
  readonly table_present: boolean;
  readonly legacy_rows_scanned: number;
  readonly ledger_rows_inserted: number;
}

async function populateVertical(
  client: Client,
  config: VerticalConfig,
): Promise<VerticalPopulateReport> {
  const present = await assertVerticalExists(client, config);
  if (!present) {
    return {
      source_table: config.source_table,
      table_present: false,
      legacy_rows_scanned: 0,
      ledger_rows_inserted: 0,
    };
  }

  let offset = 0;
  let scanned = 0;
  let inserted = 0;

  // Paginated INSERT ... SELECT. One statement per page · each is
  // idempotent via ON CONFLICT DO NOTHING. We use a CTE so the exact
  // number of inserted rows is returned without a separate COUNT.
  for (;;) {
    const sql = `
      WITH src AS (
        SELECT ${config.pk_column}::text AS id
          FROM ${config.source_table}
         ORDER BY ${config.pk_column}
         LIMIT $1 OFFSET $2
      ),
      ins AS (
        INSERT INTO ${LEDGER_TABLE} (source_table, source_internal_id, processing_state, next_action)
        SELECT $3, id, 'PENDING', 'INGEST' FROM src
        ON CONFLICT (source_table, source_internal_id) DO NOTHING
        RETURNING 1
      )
      SELECT
        (SELECT COUNT(*) FROM src) AS src_count,
        (SELECT COUNT(*) FROM ins) AS ins_count
    `;
    const page = await client.query<{ src_count: string; ins_count: string }>(sql, [
      PAGE_SIZE,
      offset,
      config.source_table,
    ]);
    const srcCount = Number(page.rows[0]?.src_count ?? "0");
    const insCount = Number(page.rows[0]?.ins_count ?? "0");
    scanned += srcCount;
    inserted += insCount;
    if (srcCount < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return {
    source_table: config.source_table,
    table_present: true,
    legacy_rows_scanned: scanned,
    ledger_rows_inserted: inserted,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Main
// ═════════════════════════════════════════════════════════════════════

interface PopulateReport {
  readonly generated_at: string;
  readonly ledger_table: string;
  readonly verticals: readonly VerticalPopulateReport[];
  readonly totals: {
    readonly tables_present: number;
    readonly tables_missing: number;
    readonly legacy_rows_scanned: number;
    readonly ledger_rows_inserted: number;
  };
}

async function main(): Promise<number> {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) {
    console.error("populate-processing-ledger · NEX_POSTGRES_URL is not set.");
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
    const reports: VerticalPopulateReport[] = [];
    for (const v of VERTICALS) {
      // Loud per-vertical banner so operator sees progress on a 59k+
      // row run.
      console.log(`populate-processing-ledger · scanning ${v.source_table} …`);
      const r = await populateVertical(client, v);
      reports.push(r);
      console.log(
        `  → table_present=${r.table_present} scanned=${r.legacy_rows_scanned} inserted=${r.ledger_rows_inserted}`,
      );
    }

    const totals = reports.reduce(
      (acc, r) => ({
        tables_present: acc.tables_present + (r.table_present ? 1 : 0),
        tables_missing: acc.tables_missing + (r.table_present ? 0 : 1),
        legacy_rows_scanned: acc.legacy_rows_scanned + r.legacy_rows_scanned,
        ledger_rows_inserted: acc.ledger_rows_inserted + r.ledger_rows_inserted,
      }),
      { tables_present: 0, tables_missing: 0, legacy_rows_scanned: 0, ledger_rows_inserted: 0 },
    );

    const report: PopulateReport = {
      generated_at: new Date().toISOString(),
      ledger_table: LEDGER_TABLE,
      verticals: reports,
      totals,
    };

    console.log("=== populate-processing-ledger report ===");
    console.log(JSON.stringify(report, null, 2));

    // Sanity invariant · the total inserted MUST NOT exceed the total
    // scanned (idempotency check). Fail loudly if the counter drifts.
    if (totals.ledger_rows_inserted > totals.legacy_rows_scanned) {
      console.error(
        `populate-processing-ledger · internal invariant violated: ` +
          `inserted (${totals.ledger_rows_inserted}) > scanned (${totals.legacy_rows_scanned})`,
      );
      return 4;
    }

    return 0;
  } finally {
    await client.end();
  }
}

// ─── Entrypoint (only when invoked directly) ────────────────────────
const isDirect = (() => {
  try {
    const argv1 = process.argv[1] ?? "";
    return argv1.endsWith("populate-processing-ledger.ts") ||
           argv1.endsWith("populate-processing-ledger.mjs");
  } catch { return false; }
})();

if (isDirect) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error("populate-processing-ledger · unexpected error:", (e as Error).message);
    process.exit(99);
  });
}

export { main, populateVertical, VERTICALS, PAGE_SIZE };
export type { PopulateReport, VerticalPopulateReport, VerticalConfig };
