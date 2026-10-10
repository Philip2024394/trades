// scripts/nex-canonical/_apply-migration-199.mjs
//
// NEX SafeChat Phase 1 · idempotent applier for migration 199
// (safechat_classification + safechat_vocabulary_term + safechat_pattern).
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
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-199.mjs
//
//   # apply · explicit flag required for the write
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-199.mjs --apply
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
  "deploy/postgres/init/199_nex_safechat_schema.sql";

const NEW_TABLES = [
  "safechat_classification",
  "safechat_vocabulary_term",
  "safechat_pattern",
];

const NEW_INDEXES = [
  "safechat_classification_time_idx",
  "safechat_classification_level_time_idx",
  "safechat_classification_conversation_time_idx",
  "safechat_vocabulary_term_lang_term_uq",
  "safechat_vocabulary_term_language_idx",
  "safechat_pattern_language_idx",
];

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[apply-199] ${msg}`);
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

  const schemaPresent = await client.query(
    "SELECT 1 FROM pg_namespace WHERE nspname='nex'",
  );
  if ((schemaPresent.rowCount ?? 0) === 0) {
    log("FATAL · schema 'nex' not present · apply earlier migrations first");
    await client.end();
    process.exit(2);
  }
  log("prereq · nex schema present");

  const preCounts = { tables: 0, indexes: 0 };
  for (const t of NEW_TABLES) {
    const r = await client.query(`SELECT to_regclass('nex.${t}') AS t`);
    if (r.rows[0].t !== null) preCounts.tables += 1;
  }
  const preIdxRes = await client.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname='nex' AND indexname = ANY ($1::text[])`,
    [NEW_INDEXES],
  );
  preCounts.indexes = preIdxRes.rowCount ?? 0;
  log(
    `pre-apply · tables=${preCounts.tables}/${NEW_TABLES.length} · ` +
      `indexes=${preCounts.indexes}/${NEW_INDEXES.length}`,
  );

  if (!apply) {
    log("verify-only mode · pass --apply to execute the migration");
    log(
      preCounts.tables === NEW_TABLES.length
        ? "SUMMARY · all 3 tables already present · would be a no-op"
        : "SUMMARY · would create 3 SafeChat tables + 6 indexes on --apply",
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

  let tablesOk = 0;
  for (const t of NEW_TABLES) {
    const r = await client.query(`SELECT to_regclass('nex.${t}') AS t`);
    if (r.rows[0].t !== null) tablesOk += 1;
  }
  const verifyIdx = await client.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname='nex' AND indexname = ANY ($1::text[])`,
    [NEW_INDEXES],
  );
  const idxOk = verifyIdx.rowCount ?? 0;

  log(
    `post-apply · tables=${tablesOk}/${NEW_TABLES.length} ` +
      `indexes=${idxOk}/${NEW_INDEXES.length}`,
  );

  if (tablesOk !== NEW_TABLES.length || idxOk !== NEW_INDEXES.length) {
    log("FATAL · post-apply verification failed");
    await client.end();
    process.exit(2);
  }

  log(
    preCounts.tables === NEW_TABLES.length
      ? "SUMMARY · migration 199 already present · no schema change"
      : "SUMMARY · migration 199 applied cleanly · SafeChat Phase 1 schema live",
  );

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(
    `[apply-199] UNEXPECTED · ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
