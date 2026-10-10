// scripts/nex-canonical/_apply-migration-205.mjs
//
// NEX Family Safety · Parent Custody Link (migration 205 · idempotent ·
// session-identity gated).
//
// APPLY ORDER
//   205 depends on 203 (creation_request_id FK). Run 204 → 203 → 205.
//
// CRITICAL IDENTITY GATE
//   SELECT current_database() MUST equal 'nex_dev' before any write.

import * as fs from "node:fs/promises";
import * as path from "node:path";
import pg from "pg";

const MIG_FILE = "deploy/postgres/init/205_nex_parent_custody_link.sql";

const NEW_TABLES = ["parent_custody_link"];

const NEW_INDEXES = [
  "parent_custody_link_active_uq",
  "parent_custody_link_parent_idx",
  "parent_custody_link_transfer_due_idx",
];

const REQUIRED_PREREQ_TABLES = ["child_account_creation_request"];

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[apply-205] ${msg}`);
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
    log("FATAL · schema 'nex' not present");
    await client.end();
    process.exit(2);
  }
  log("prereq · nex schema present");

  for (const t of REQUIRED_PREREQ_TABLES) {
    const r = await client.query(`SELECT to_regclass('nex.${t}') AS t`);
    if (r.rows[0].t === null) {
      log(`FATAL · prereq table nex.${t} missing · apply migration 203 first`);
      await client.end();
      process.exit(2);
    }
  }
  log(`prereq · ${REQUIRED_PREREQ_TABLES.join(", ")} present`);

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
        ? "SUMMARY · table already present · would be a no-op"
        : "SUMMARY · would create parent_custody_link + 3 indexes on --apply",
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
      ? "SUMMARY · migration 205 already present · no schema change"
      : "SUMMARY · migration 205 applied cleanly · parent_custody_link live",
  );

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(
    `[apply-205] UNEXPECTED · ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
