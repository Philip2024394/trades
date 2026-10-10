// scripts/nex-canonical/_apply-migration-190.mjs
//
// NEX Directory · Owner Claim · idempotent applier for migration 190
// (nex.business_claim_draft).
//
// CRITICAL IDENTITY GATE
//   SELECT current_database() MUST equal 'nex_dev' before any write.
//   The script refuses to touch any other database.
//
// IDEMPOTENCE
//   The migration uses CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT
//   EXISTS. Running twice finds the table already present and logs
//   "already present". Running once creates the table. Zero DML.
//
// USAGE
//   # dry-run · verify SQL + identity but do not apply
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-190.mjs
//
//   # apply · explicit flag required for the write
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-190.mjs --apply
//
// EXIT
//   0 · verify-only completed OR apply succeeded (or already present)
//   1 · identity check failed · aborted before any write
//   2 · migration failed · transaction rolled back
//   3 · migration file not found

import * as fs from "node:fs/promises";
import * as path from "node:path";
import pg from "pg";

const MIG_FILE = "deploy/postgres/init/190_nex_business_claim_draft.sql";
const EXPECTED_TABLE = "business_claim_draft";

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[apply-190] ${msg}`);
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

  // Pre-check: does nex.business_claim_draft already exist?
  const preCheck = await client.query(
    `SELECT to_regclass('nex.business_claim_draft') AS reg`,
  );
  const alreadyPresent = preCheck.rows[0].reg !== null;
  log(
    alreadyPresent
      ? "pre-apply · nex.business_claim_draft is already present"
      : "pre-apply · nex.business_claim_draft is NOT yet present",
  );

  if (!apply) {
    log("verify-only mode · pass --apply to execute the migration");
    log(
      alreadyPresent
        ? "SUMMARY · nothing to do · table exists"
        : "SUMMARY · would create nex.business_claim_draft on --apply",
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
       (SELECT to_regclass('nex.business_claim_draft'))                          AS tbl,
       (SELECT 1 FROM pg_indexes WHERE schemaname='nex' AND indexname='idx_bcd_status_expires')   AS idx1,
       (SELECT 1 FROM pg_indexes WHERE schemaname='nex' AND indexname='idx_bcd_canonical_status') AS idx2,
       (SELECT 1 FROM pg_constraint WHERE conname='uq_bcd_canonical_fingerprint')                 AS uq,
       (SELECT 1 FROM pg_constraint WHERE conname='fk_bcd_canonical_business')                    AS fk`,
  );
  const v = verify.rows[0];
  log(
    `post-apply · table=${v.tbl ? "present" : "MISSING"} ` +
      `idx1=${v.idx1 ? "present" : "MISSING"} ` +
      `idx2=${v.idx2 ? "present" : "MISSING"} ` +
      `uq=${v.uq ? "present" : "MISSING"} ` +
      `fk=${v.fk ? "present" : "MISSING"}`,
  );

  const anyMissing =
    !v.tbl || !v.idx1 || !v.idx2 || !v.uq || !v.fk;
  if (anyMissing) {
    log("FATAL · post-apply verification failed");
    await client.end();
    process.exit(2);
  }

  log(
    alreadyPresent
      ? `SUMMARY · migration 190 already present · no new objects`
      : `SUMMARY · migration 190 applied cleanly · nex.${EXPECTED_TABLE} created`,
  );

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[apply-190] UNEXPECTED · ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
