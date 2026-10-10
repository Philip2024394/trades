// scripts/nex-canonical/_apply-migration-191.mjs
//
// NEX Directory · Cross-DB Reconciler · idempotent applier for
// migration 191 (nex.cross_db_reconcile_log audit table).
//
// CRITICAL IDENTITY GATE
//   SELECT current_database() MUST equal 'nex_dev' before any write.
//   The script refuses to touch any other database.
//
// IDEMPOTENCE
//   The migration uses CREATE TABLE IF NOT EXISTS + CREATE INDEX IF
//   NOT EXISTS. Running twice finds the table already present and
//   logs "already present". Running once creates the table. Zero DML.
//
// USAGE
//   # dry-run · verify SQL + identity but do not apply
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-191.mjs
//
//   # apply · explicit flag required for the write
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-191.mjs --apply
//
// EXIT
//   0 · verify-only completed OR apply succeeded (or already present)
//   1 · identity check failed · aborted before any write
//   2 · migration failed · transaction rolled back
//   3 · migration file not found

import * as fs from "node:fs/promises";
import * as path from "node:path";
import pg from "pg";

const MIG_FILE = "deploy/postgres/init/191_nex_cross_db_reconcile_log.sql";
const EXPECTED_TABLE = "cross_db_reconcile_log";

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[apply-191] ${msg}`);
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

  // Pre-check: does nex.cross_db_reconcile_log already exist?
  const preCheck = await client.query(
    `SELECT to_regclass('nex.cross_db_reconcile_log') AS reg`,
  );
  const alreadyPresent = preCheck.rows[0].reg !== null;
  log(
    alreadyPresent
      ? "pre-apply · nex.cross_db_reconcile_log is already present"
      : "pre-apply · nex.cross_db_reconcile_log is NOT yet present",
  );

  if (!apply) {
    log("verify-only mode · pass --apply to execute the migration");
    log(
      alreadyPresent
        ? "SUMMARY · nothing to do · table exists"
        : "SUMMARY · would create nex.cross_db_reconcile_log on --apply",
    );
    await client.end();
    process.exit(0);
  }

  // Apply the migration in a transaction. The migration is additive
  // and idempotent · a second run finds the table already present and
  // all CREATE statements become no-ops.
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

  // Verify the table + indexes + constraints exist post-apply.
  const verify = await client.query(
    `SELECT
       (SELECT to_regclass('nex.cross_db_reconcile_log'))                              AS tbl,
       (SELECT 1 FROM pg_indexes WHERE schemaname='nex' AND indexname='cross_db_reconcile_log_idem_uq')   AS idx1,
       (SELECT 1 FROM pg_indexes WHERE schemaname='nex' AND indexname='cross_db_reconcile_log_claim_idx') AS idx2,
       (SELECT 1 FROM pg_indexes WHERE schemaname='nex' AND indexname='cross_db_reconcile_log_recent_idx') AS idx3,
       (SELECT 1 FROM pg_constraint WHERE conname='fk_cdrl_claim')                     AS fk_claim,
       (SELECT 1 FROM pg_constraint WHERE conname='fk_cdrl_canonical_business')        AS fk_canonical,
       (SELECT 1 FROM pg_constraint WHERE conname='ck_cdrl_event_type')                AS ck_evt`,
  );
  const v = verify.rows[0];
  log(
    `post-apply · table=${v.tbl ? "present" : "MISSING"} ` +
      `idem_uq=${v.idx1 ? "present" : "MISSING"} ` +
      `claim_idx=${v.idx2 ? "present" : "MISSING"} ` +
      `recent_idx=${v.idx3 ? "present" : "MISSING"} ` +
      `fk_claim=${v.fk_claim ? "present" : "MISSING"} ` +
      `fk_canonical=${v.fk_canonical ? "present" : "MISSING"} ` +
      `ck_event_type=${v.ck_evt ? "present" : "MISSING"}`,
  );

  const anyMissing =
    !v.tbl || !v.idx1 || !v.idx2 || !v.idx3 || !v.fk_claim || !v.fk_canonical || !v.ck_evt;
  if (anyMissing) {
    log("FATAL · post-apply verification failed");
    await client.end();
    process.exit(2);
  }

  log(
    alreadyPresent
      ? `SUMMARY · migration 191 already present · no new objects`
      : `SUMMARY · migration 191 applied cleanly · nex.${EXPECTED_TABLE} created`,
  );

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[apply-191] UNEXPECTED · ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
