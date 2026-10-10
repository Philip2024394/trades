// scripts/nex-canonical/_apply-migration-194.mjs
//
// NEX Emergency Help · idempotent applier for migration 194
// (live-location history: nex.emergency_location_update).
//
// CRITICAL IDENTITY GATE
//   SELECT current_database() MUST equal 'nex_dev' before any write.
//   The script refuses to touch any other database.
//
// IDEMPOTENCE
//   The migration uses CREATE TABLE IF NOT EXISTS + CREATE INDEX IF
//   NOT EXISTS. Zero DML. Safe to re-run.
//
// USAGE
//   # dry-run · verify SQL + identity but do not apply
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-194.mjs
//
//   # apply · explicit flag required for the write
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-194.mjs --apply
//
// EXIT
//   0 · verify-only completed OR apply succeeded (or already present)
//   1 · identity check failed · aborted before any write
//   2 · migration failed · transaction rolled back
//   3 · migration file not found

import * as fs from "node:fs/promises";
import * as path from "node:path";
import pg from "pg";

const MIG_FILE = "deploy/postgres/init/194_nex_emergency_location_history.sql";
const EXPECTED_TABLES = ["emergency_location_update"];

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[apply-194] ${msg}`);
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

  // Prereq: emergency_incident must exist (FK target from 193).
  const prereq = await client.query(
    "SELECT to_regclass('nex.emergency_incident') AS t",
  );
  if (prereq.rows[0].t === null) {
    log("FATAL · nex.emergency_incident not present · apply migration 193 first");
    await client.end();
    process.exit(2);
  }
  log("prereq · nex.emergency_incident present");

  // Pre-check: is 194's table already present?
  const preCheck = await client.query(
    `SELECT to_regclass('nex.emergency_location_update') AS t1`,
  );
  const pre = preCheck.rows[0];
  const presentBefore = pre.t1 !== null ? 1 : 0;
  log(`pre-apply · ${presentBefore}/${EXPECTED_TABLES.length} location tables present`);

  if (!apply) {
    log("verify-only mode · pass --apply to execute the migration");
    log(
      presentBefore === EXPECTED_TABLES.length
        ? "SUMMARY · nothing to do · emergency_location_update already present"
        : "SUMMARY · would create nex.emergency_location_update on --apply",
    );
    await client.end();
    process.exit(0);
  }

  // Apply the migration in a transaction. Additive · idempotent.
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    log("transaction committed");
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    log(`FATAL · migration failed · ${err instanceof Error ? err.message : String(err)}`);
    await client.end();
    process.exit(2);
  }

  // Post-apply verification.
  const verify = await client.query(
    `SELECT
       (SELECT to_regclass('nex.emergency_location_update'))                                       AS t1,
       (SELECT 1 FROM pg_indexes WHERE schemaname='nex' AND indexname='emergency_location_update_incident_time_idx') AS ix1,
       (SELECT 1 FROM pg_constraint WHERE conname='ck_elu_lat')                                    AS ck1,
       (SELECT 1 FROM pg_constraint WHERE conname='ck_elu_lng')                                    AS ck2,
       (SELECT 1 FROM pg_constraint WHERE conname='ck_elu_source')                                 AS ck3`,
  );
  const v = verify.rows[0];
  log(
    `post-apply · tables=${v.t1 !== null ? 1 : 0}/1 ` +
      `indexes=${v.ix1 ? 1 : 0}/1 ` +
      `check-constraints=${[v.ck1, v.ck2, v.ck3].filter(Boolean).length}/3`,
  );

  const anyMissing = !v.t1 || !v.ix1 || !v.ck1 || !v.ck2 || !v.ck3;
  if (anyMissing) {
    log("FATAL · post-apply verification failed");
    await client.end();
    process.exit(2);
  }

  log(
    presentBefore === EXPECTED_TABLES.length
      ? "SUMMARY · migration 194 already present · no new objects"
      : "SUMMARY · migration 194 applied cleanly · 1 new table created",
  );

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[apply-194] UNEXPECTED · ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
