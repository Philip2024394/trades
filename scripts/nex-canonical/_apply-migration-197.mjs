// scripts/nex-canonical/_apply-migration-197.mjs
//
// NEX Emergency Help · idempotent applier for migration 197
// (dedicated multi-channel fan-out audit log · nex.emergency_fanout_log).
//
// CRITICAL IDENTITY GATE
//   SELECT current_database() MUST equal 'nex_dev' before any write.
//   The script refuses to touch any other database.
//
// IDEMPOTENCE
//   CREATE TABLE IF NOT EXISTS · CREATE INDEX IF NOT EXISTS. Zero DML.
//   Safe to re-run.
//
// USAGE
//   # dry-run · verify SQL + identity but do not apply
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-197.mjs
//
//   # apply · explicit flag required for the write
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-197.mjs --apply
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
  "deploy/postgres/init/197_nex_emergency_fanout_audit.sql";
const NEW_INDEXES = [
  "emergency_fanout_log_idem_uq",
  "emergency_fanout_log_incident_time_idx",
  "emergency_fanout_log_outcome_time_idx",
];

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[apply-197] ${msg}`);
}

function parseArgs(argv) {
  return { apply: argv.includes("--apply") };
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

  const preCheck = await client.query(
    "SELECT to_regclass('nex.emergency_fanout_log') AS t",
  );
  const presentBefore = preCheck.rows[0].t !== null;
  log(`pre-apply · nex.emergency_fanout_log present=${presentBefore ? "yes" : "no"}`);

  if (!apply) {
    log("verify-only mode · pass --apply to execute the migration");
    log(
      presentBefore
        ? "SUMMARY · table already present · would be a no-op with CREATE TABLE IF NOT EXISTS"
        : "SUMMARY · would create nex.emergency_fanout_log + 3 indexes on --apply",
    );
    await client.end();
    process.exit(0);
  }

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

  const verifyTable = await client.query(
    "SELECT to_regclass('nex.emergency_fanout_log') AS t",
  );
  const tableOk = verifyTable.rows[0].t !== null;

  const verifyIdx = await client.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname='nex' AND tablename='emergency_fanout_log'
        AND indexname = ANY ($1::text[])`,
    [NEW_INDEXES],
  );
  const idxPresent = verifyIdx.rowCount ?? 0;

  log(
    `post-apply · table=${tableOk ? "yes" : "no"} ` +
      `indexes=${idxPresent}/${NEW_INDEXES.length}`,
  );

  if (!tableOk || idxPresent !== NEW_INDEXES.length) {
    log("FATAL · post-apply verification failed");
    await client.end();
    process.exit(2);
  }

  log(
    presentBefore
      ? "SUMMARY · migration 197 already present · no schema change"
      : "SUMMARY · migration 197 applied cleanly · fan-out audit log live",
  );

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(
    `[apply-197] UNEXPECTED · ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
