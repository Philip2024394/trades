// scripts/nex-canonical/_apply-migration-198.mjs
//
// NEX Family Links · idempotent applier for migration 198
// (nex.family_link + nex.account_age_attestation).
//
// CRITICAL IDENTITY GATE
//   SELECT current_database() MUST equal 'nex_dev' before any write.
//   The script refuses to touch any other database.
//
// IDEMPOTENCE
//   CREATE TABLE IF NOT EXISTS · CREATE INDEX IF NOT EXISTS. The
//   self-FK constraint on nex.family_link is wrapped in a DO $$ … $$
//   guard that is also a no-op on re-run. Zero DML. Safe to re-run.
//
// USAGE
//   # dry-run · verify SQL + identity but do not apply
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-198.mjs
//
//   # apply · explicit flag required for the write
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-198.mjs --apply
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
  "deploy/postgres/init/198_nex_family_link.sql";

const NEW_TABLES = [
  "family_link",
  "account_age_attestation",
];

const NEW_INDEXES = [
  "family_link_primary_guardian_uq",
  "family_link_pair_active_uq",
  "family_link_child_state_idx",
  "family_link_guardian_state_idx",
  "account_age_attestation_account_time_idx",
  "account_age_attestation_active_uq",
];

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[apply-198] ${msg}`);
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
    "SELECT to_regnamespace('nex') AS n",
  );
  if (prereq.rows[0].n === null) {
    log(
      "FATAL · nex schema not present · apply 000_schema.sql first",
    );
    await client.end();
    process.exit(2);
  }
  log("prereq · nex schema present");

  const preCheck = await client.query(
    `SELECT
       (to_regclass('nex.family_link'))              AS family_link,
       (to_regclass('nex.account_age_attestation')) AS attestation`,
  );
  const familyLinkPresent = preCheck.rows[0].family_link !== null;
  const attestationPresent = preCheck.rows[0].attestation !== null;
  log(
    `pre-apply · family_link=${familyLinkPresent ? "yes" : "no"} ` +
      `account_age_attestation=${attestationPresent ? "yes" : "no"}`,
  );

  if (!apply) {
    log("verify-only mode · pass --apply to execute the migration");
    const bothPresent = familyLinkPresent && attestationPresent;
    log(
      bothPresent
        ? "SUMMARY · both tables already present · would be a no-op"
        : "SUMMARY · would create nex.family_link + nex.account_age_attestation + 6 indexes on --apply",
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

  const verifyTables = await client.query(
    `SELECT tablename FROM pg_tables
      WHERE schemaname='nex' AND tablename = ANY ($1::text[])`,
    [NEW_TABLES],
  );
  const tablesPresent = verifyTables.rowCount ?? 0;

  const verifyIdx = await client.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname='nex' AND indexname = ANY ($1::text[])`,
    [NEW_INDEXES],
  );
  const idxPresent = verifyIdx.rowCount ?? 0;

  log(
    `post-apply · tables=${tablesPresent}/${NEW_TABLES.length} ` +
      `indexes=${idxPresent}/${NEW_INDEXES.length}`,
  );

  if (tablesPresent !== NEW_TABLES.length || idxPresent !== NEW_INDEXES.length) {
    log("FATAL · post-apply verification failed");
    await client.end();
    process.exit(2);
  }

  log(
    familyLinkPresent && attestationPresent
      ? "SUMMARY · migration 198 already present · no schema change"
      : "SUMMARY · migration 198 applied cleanly · Family Links Phase 1 primitives live",
  );

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(
    `[apply-198] UNEXPECTED · ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
