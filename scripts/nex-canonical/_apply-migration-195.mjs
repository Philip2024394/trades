// scripts/nex-canonical/_apply-migration-195.mjs
//
// NEX Emergency Help · idempotent applier for migration 195
// (pending-confirmation + revoked-within-window states on
// nex.emergency_incident).
//
// CRITICAL IDENTITY GATE
//   SELECT current_database() MUST equal 'nex_dev' before any write.
//   The script refuses to touch any other database.
//
// IDEMPOTENCE
//   The migration uses DROP CONSTRAINT IF EXISTS · ADD CONSTRAINT ·
//   ADD COLUMN IF NOT EXISTS. Zero DML. Safe to re-run.
//
// USAGE
//   # dry-run · verify SQL + identity but do not apply
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-195.mjs
//
//   # apply · explicit flag required for the write
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-195.mjs --apply
//
// EXIT
//   0 · verify-only completed OR apply succeeded (or already present)
//   1 · identity check failed · aborted before any write
//   2 · migration failed · transaction rolled back
//   3 · migration file not found

import * as fs from "node:fs/promises";
import * as path from "node:path";
import pg from "pg";

const MIG_FILE =
  "deploy/postgres/init/195_nex_emergency_pending_confirmation_states.sql";
const NEW_STATES = ["pending_confirmation", "revoked_within_window"];
const NEW_COLUMNS = ["pending_confirmed_at", "revoked_within_window_at"];

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[apply-195] ${msg}`);
}

function parseArgs(argv) {
  const apply = argv.includes("--apply");
  return { apply };
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) {
    log("FATAL · NEX_POSTGRES_URL is not set");
    process.exit(1);
  }

  const repo = process.cwd();
  const abs = path.resolve(repo, MIG_FILE);
  let sql;
  try {
    sql = await fs.readFile(abs, "utf8");
  } catch {
    log(`FATAL · migration file not found at ${MIG_FILE}`);
    process.exit(3);
  }
  log(`loaded ${MIG_FILE} · ${sql.length} chars`);

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  // Session identity gate · MUST equal 'nex_dev' before any write.
  const idRes = await client.query(
    "SELECT current_database() AS db, current_user AS usr",
  );
  const db = idRes.rows[0].db;
  const usr = idRes.rows[0].usr;
  log(`session identity · db=${db} · user=${usr}`);
  if (db !== "nex_dev") {
    log(`FATAL · expected db='nex_dev' got='${db}' · refusing to write`);
    await client.end();
    process.exit(1);
  }

  // Prereq: emergency_incident must exist (added by migration 193).
  const prereq = await client.query(
    "SELECT to_regclass('nex.emergency_incident') AS t",
  );
  if (prereq.rows[0].t === null) {
    log(
      "FATAL · nex.emergency_incident not present · apply migration 193 first",
    );
    await client.end();
    process.exit(2);
  }
  log("prereq · nex.emergency_incident present");

  // Pre-check: are the new columns already present?
  const preCheck = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='nex'
        AND table_name='emergency_incident'
        AND column_name = ANY ($1::text[])`,
    [NEW_COLUMNS],
  );
  const presentBefore = preCheck.rowCount ?? 0;
  log(
    `pre-apply · ${presentBefore}/${NEW_COLUMNS.length} new timestamp columns already present`,
  );

  if (!apply) {
    log("verify-only mode · pass --apply to execute the migration");
    log(
      presentBefore === NEW_COLUMNS.length
        ? "SUMMARY · columns already present · would be a no-op with ADD COLUMN IF NOT EXISTS"
        : "SUMMARY · would widen state CHECK and add 2 timestamp columns on --apply",
    );
    await client.end();
    process.exit(0);
  }

  // Apply the migration (migration file manages its own transaction).
  try {
    await client.query(sql);
    log("migration applied");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* noop */
    }
    log(
      `FATAL · migration failed · ${err instanceof Error ? err.message : String(err)}`,
    );
    await client.end();
    process.exit(2);
  }

  // Post-apply verification.
  const verifyCols = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='nex'
        AND table_name='emergency_incident'
        AND column_name = ANY ($1::text[])`,
    [NEW_COLUMNS],
  );
  const colsPresent = verifyCols.rowCount ?? 0;

  // Verify the CHECK constraint carries each new state.
  const checkRows = await client.query(
    `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conname = 'emergency_incident_state_check'`,
  );
  const checkDef = String(checkRows.rows[0]?.def ?? "");
  const checkOk =
    NEW_STATES.every((s) => checkDef.includes(`'${s}'`)) &&
    checkDef.includes("'draft'") &&
    checkDef.includes("'active'") &&
    checkDef.includes("'expired'");

  log(
    `post-apply · columns=${colsPresent}/${NEW_COLUMNS.length} ` +
      `check_includes_new_states=${checkOk ? "yes" : "no"}`,
  );

  if (colsPresent !== NEW_COLUMNS.length || !checkOk) {
    log("FATAL · post-apply verification failed");
    await client.end();
    process.exit(2);
  }

  // Verify ALTER succeeded against existing data (no rows should now
  // violate the new CHECK; the sealed states include every prior one,
  // so this is a sanity read not a repair).
  const existingStates = await client.query(
    `SELECT state, count(*)::int AS n
       FROM nex.emergency_incident
      GROUP BY state ORDER BY state`,
  );
  const existingSummary =
    existingStates.rows.length === 0
      ? "no existing rows"
      : existingStates.rows.map((r) => `${r.state}=${r.n}`).join(", ");
  log(`existing-data · ${existingSummary}`);

  log(
    presentBefore === NEW_COLUMNS.length
      ? "SUMMARY · migration 195 already present · no schema change"
      : "SUMMARY · migration 195 applied cleanly · widened state CHECK + 2 new timestamps",
  );

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(
    `[apply-195] UNEXPECTED · ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
