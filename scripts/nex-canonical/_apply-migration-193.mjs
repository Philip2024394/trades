// scripts/nex-canonical/_apply-migration-193.mjs
//
// NEX Emergency Help · idempotent applier for migration 193
// (foundation schema: emergency_incident · incident_recipient ·
// emergency_responder_optin · trusted_contact · emergency_rate_limit).
//
// CRITICAL IDENTITY GATE
//   SELECT current_database() MUST equal 'nex_dev' before any write.
//   The script refuses to touch any other database.
//
// IDEMPOTENCE
//   All CREATE statements use IF NOT EXISTS. Zero DML. Safe to re-run.
//
// USAGE
//   # dry-run · verify SQL + identity but do not apply
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-193.mjs
//
//   # apply · explicit flag required for the write
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-193.mjs --apply
//
// EXIT
//   0 · verify-only completed OR apply succeeded (or already present)
//   1 · identity check failed · aborted before any write
//   2 · migration failed · transaction rolled back
//   3 · migration file not found

import * as fs from "node:fs/promises";
import * as path from "node:path";
import pg from "pg";

const MIG_FILE = "deploy/postgres/init/193_nex_emergency_schema.sql";
const EXPECTED_TABLES = [
  "emergency_incident",
  "incident_recipient",
  "emergency_responder_optin",
  "trusted_contact",
  "emergency_rate_limit",
];

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[apply-193] ${msg}`);
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

  // Pre-check: which of the five emergency tables are already present?
  const preCheck = await client.query(
    `SELECT
       to_regclass('nex.emergency_incident')         AS t1,
       to_regclass('nex.incident_recipient')         AS t2,
       to_regclass('nex.emergency_responder_optin')  AS t3,
       to_regclass('nex.trusted_contact')            AS t4,
       to_regclass('nex.emergency_rate_limit')       AS t5`,
  );
  const pre = preCheck.rows[0];
  const presentBefore = [pre.t1, pre.t2, pre.t3, pre.t4, pre.t5]
    .filter((v) => v !== null).length;
  log(`pre-apply · ${presentBefore}/${EXPECTED_TABLES.length} emergency tables present`);

  if (!apply) {
    log("verify-only mode · pass --apply to execute the migration");
    log(
      presentBefore === EXPECTED_TABLES.length
        ? "SUMMARY · nothing to do · all 5 tables already present"
        : `SUMMARY · would create ${EXPECTED_TABLES.length - presentBefore} new table(s) on --apply`,
    );
    await client.end();
    process.exit(0);
  }

  // Apply the migration in a transaction. Additive · idempotent · a
  // second run finds every CREATE statement a no-op.
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
       (SELECT to_regclass('nex.emergency_incident'))                                   AS t1,
       (SELECT to_regclass('nex.incident_recipient'))                                   AS t2,
       (SELECT to_regclass('nex.emergency_responder_optin'))                            AS t3,
       (SELECT to_regclass('nex.trusted_contact'))                                      AS t4,
       (SELECT to_regclass('nex.emergency_rate_limit'))                                 AS t5,
       (SELECT 1 FROM pg_indexes WHERE schemaname='nex' AND indexname='idx_ei_requester_state_created') AS ix1,
       (SELECT 1 FROM pg_indexes WHERE schemaname='nex' AND indexname='idx_ei_state_expires')           AS ix2,
       (SELECT 1 FROM pg_indexes WHERE schemaname='nex' AND indexname='idx_ir_recipient_status_notified') AS ix3,
       (SELECT 1 FROM pg_indexes WHERE schemaname='nex' AND indexname='idx_ir_incident_status')         AS ix4,
       (SELECT 1 FROM pg_indexes WHERE schemaname='nex' AND indexname='idx_ero_simulated_opted_in')     AS ix5,
       (SELECT 1 FROM pg_indexes WHERE schemaname='nex' AND indexname='idx_tc_owner_added')             AS ix6,
       (SELECT 1 FROM pg_constraint WHERE conname='uq_ir_incident_recipient')                           AS uq1,
       (SELECT 1 FROM pg_constraint WHERE conname='pk_tc_owner_contact')                                AS pk1,
       (SELECT 1 FROM pg_constraint WHERE conname='pk_erl_account_window')                              AS pk2`,
  );
  const v = verify.rows[0];
  log(
    `post-apply · tables=${[v.t1, v.t2, v.t3, v.t4, v.t5].filter((x) => x !== null).length}/5 ` +
      `indexes=${[v.ix1, v.ix2, v.ix3, v.ix4, v.ix5, v.ix6].filter(Boolean).length}/6 ` +
      `constraints=${[v.uq1, v.pk1, v.pk2].filter(Boolean).length}/3`,
  );

  const anyMissing =
    !v.t1 || !v.t2 || !v.t3 || !v.t4 || !v.t5
    || !v.ix1 || !v.ix2 || !v.ix3 || !v.ix4 || !v.ix5 || !v.ix6
    || !v.uq1 || !v.pk1 || !v.pk2;
  if (anyMissing) {
    log("FATAL · post-apply verification failed");
    await client.end();
    process.exit(2);
  }

  log(
    presentBefore === EXPECTED_TABLES.length
      ? "SUMMARY · migration 193 already present · no new objects"
      : `SUMMARY · migration 193 applied cleanly · ${EXPECTED_TABLES.length - presentBefore} new table(s) created`,
  );

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[apply-193] UNEXPECTED · ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
