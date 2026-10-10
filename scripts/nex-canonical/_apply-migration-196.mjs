// scripts/nex-canonical/_apply-migration-196.mjs
//
// NEX Emergency Help · idempotent applier for migration 196
// (multi-channel extension to nex.trusted_contact: email + phone + a
// surrogate PK so email-only / phone-only identities become legal).
//
// CRITICAL IDENTITY GATE
//   SELECT current_database() MUST equal 'nex_dev' before any write.
//   The script refuses to touch any other database.
//
// IDEMPOTENCE
//   The migration uses DROP CONSTRAINT IF EXISTS · ADD CONSTRAINT ·
//   ADD COLUMN IF NOT EXISTS · CREATE UNIQUE INDEX IF NOT EXISTS.
//   Zero DML. Safe to re-run.
//
// USAGE
//   # dry-run · verify SQL + identity but do not apply
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-196.mjs
//
//   # apply · explicit flag required for the write
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-196.mjs --apply
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
  "deploy/postgres/init/196_nex_emergency_trusted_contact_channels.sql";
const NEW_COLUMNS = ["contact_email", "contact_phone", "trusted_contact_id"];
const NEW_INDEXES = [
  "trusted_contact_owner_account_uq",
  "trusted_contact_owner_email_uq",
  "trusted_contact_owner_phone_uq",
];

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[apply-196] ${msg}`);
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
    "SELECT to_regclass('nex.trusted_contact') AS t",
  );
  if (prereq.rows[0].t === null) {
    log(
      "FATAL · nex.trusted_contact not present · apply migration 193 first",
    );
    await client.end();
    process.exit(2);
  }
  log("prereq · nex.trusted_contact present");

  const preCols = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='nex' AND table_name='trusted_contact'
        AND column_name = ANY ($1::text[])`,
    [NEW_COLUMNS],
  );
  const presentBefore = preCols.rowCount ?? 0;
  log(
    `pre-apply · ${presentBefore}/${NEW_COLUMNS.length} new columns already present`,
  );

  if (!apply) {
    log("verify-only mode · pass --apply to execute the migration");
    log(
      presentBefore === NEW_COLUMNS.length
        ? "SUMMARY · columns already present · would be a no-op with IF NOT EXISTS guards"
        : "SUMMARY · would add 3 columns (contact_email · contact_phone · trusted_contact_id) + 3 partial unique indexes + 2 CHECKs on --apply",
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

  // Post-apply verification.
  const verifyCols = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='nex' AND table_name='trusted_contact'
        AND column_name = ANY ($1::text[])`,
    [NEW_COLUMNS],
  );
  const colsPresent = verifyCols.rowCount ?? 0;

  const verifyIdx = await client.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname='nex' AND tablename='trusted_contact'
        AND indexname = ANY ($1::text[])`,
    [NEW_INDEXES],
  );
  const idxPresent = verifyIdx.rowCount ?? 0;

  const checkRows = await client.query(
    `SELECT conname
       FROM pg_constraint
      WHERE conname IN (
        'trusted_contact_at_least_one_identifier',
        'trusted_contact_email_shape',
        'trusted_contact_phone_shape'
      )`,
  );
  const checksPresent = checkRows.rowCount ?? 0;

  // Verify contact_account_id is now nullable.
  const nullRes = await client.query(
    `SELECT is_nullable FROM information_schema.columns
      WHERE table_schema='nex' AND table_name='trusted_contact'
        AND column_name='contact_account_id'`,
  );
  const nullable = String(nullRes.rows[0]?.is_nullable ?? "NO") === "YES";

  log(
    `post-apply · columns=${colsPresent}/${NEW_COLUMNS.length} ` +
      `indexes=${idxPresent}/${NEW_INDEXES.length} ` +
      `checks=${checksPresent}/3 ` +
      `contact_account_id_nullable=${nullable ? "yes" : "no"}`,
  );

  if (
    colsPresent !== NEW_COLUMNS.length
    || idxPresent !== NEW_INDEXES.length
    || checksPresent !== 3
    || !nullable
  ) {
    log("FATAL · post-apply verification failed");
    await client.end();
    process.exit(2);
  }

  const existingRows = await client.query(
    `SELECT count(*)::int AS n FROM nex.trusted_contact`,
  );
  log(`existing-data · trusted_contact rows=${existingRows.rows[0].n}`);

  log(
    presentBefore === NEW_COLUMNS.length
      ? "SUMMARY · migration 196 already present · no schema change"
      : "SUMMARY · migration 196 applied cleanly · trusted_contact now supports email/phone identities",
  );

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(
    `[apply-196] UNEXPECTED · ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
