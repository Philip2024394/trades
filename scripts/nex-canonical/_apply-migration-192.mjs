// scripts/nex-canonical/_apply-migration-192.mjs
//
// NEX Directory · Accommodation Clearance Prep · idempotent applier
// for migration 192 (nex.attribution_template reviewable catalog).
//
// CRITICAL IDENTITY GATE
//   SELECT current_database() MUST equal 'nex_dev' before any write.
//   The script refuses to touch any other database.
//
// WHAT 192 DOES NOT DO
//   · Does NOT UPDATE nex.source_registry.
//   · Does NOT flip can_display on any source.
//   · Does NOT promote any canonical to VERIFIED.
//   The applier is defence-in-depth: the SQL file is pure CREATE TABLE
//   + seed INSERT ON CONFLICT DO NOTHING. The applier never issues an
//   additional statement outside the file.
//
// IDEMPOTENCE
//   The migration uses CREATE TABLE IF NOT EXISTS + INSERT ...
//   ON CONFLICT (template_id) DO NOTHING. Running twice:
//     - CREATE TABLE sees the table and no-ops.
//     - INSERT skips any pre-existing template_id (never overwrites).
//
// USAGE
//   # dry-run · verify SQL + identity but do not apply
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-192.mjs
//
//   # apply · explicit flag required for the write
//   node --env-file=.env.local scripts/nex-canonical/_apply-migration-192.mjs --apply
//
// EXIT
//   0 · verify-only completed OR apply succeeded (or already present)
//   1 · identity check failed · aborted before any write
//   2 · migration failed · transaction rolled back
//   3 · migration file not found

import * as fs from "node:fs/promises";
import * as path from "node:path";
import pg from "pg";

const MIG_FILE = "deploy/postgres/init/192_nex_osm_odbl_attribution_template.sql";
const EXPECTED_TABLE = "attribution_template";
const EXPECTED_TEMPLATES = [
  "osm_odbl_v1",
  "osm_cc_by_sa_v1",
  "openstreetmap_contributor_v2",
  "osm_derived_via_overpass_v1",
];

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[apply-192] ${msg}`);
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

  // Belt-and-braces · verify the SQL body does not touch source_registry
  // before we execute it. The applier refuses to run an unexpected
  // migration body even if the file at this slot has been swapped.
  const bareBody = sql.replace(/--[^\n]*/g, "");
  if (/\bUPDATE\s+nex\.source_registry\b/i.test(bareBody)) {
    log("FATAL · refusing to run · migration body contains UPDATE nex.source_registry");
    process.exit(1);
  }
  if (/\bSET\s+can_display\b/i.test(bareBody)) {
    log("FATAL · refusing to run · migration body touches can_display");
    process.exit(1);
  }

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

  // Pre-check: does nex.attribution_template already exist?
  const preCheck = await client.query(
    `SELECT to_regclass('nex.attribution_template') AS reg`,
  );
  const alreadyPresent = preCheck.rows[0].reg !== null;
  log(
    alreadyPresent
      ? "pre-apply · nex.attribution_template is already present"
      : "pre-apply · nex.attribution_template is NOT yet present",
  );

  // Snapshot source_registry row count before + after so the applier
  // can prove zero rows were touched.
  const regBefore = await client.query(
    `SELECT COUNT(*)::int AS n FROM nex.source_registry`,
  );
  const regCountBefore = regBefore.rows[0].n;
  log(`pre-apply · nex.source_registry row count = ${regCountBefore}`);

  if (!apply) {
    log("verify-only mode · pass --apply to execute the migration");
    log(
      alreadyPresent
        ? "SUMMARY · nothing to do · table exists"
        : "SUMMARY · would create nex.attribution_template on --apply",
    );
    await client.end();
    process.exit(0);
  }

  // Apply the migration in a transaction.
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    log("transaction committed");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    log(
      `FATAL · migration failed · ${err instanceof Error ? err.message : String(err)}`,
    );
    await client.end();
    process.exit(2);
  }

  // Post-apply verification.
  const verify = await client.query(
    `SELECT
       (SELECT to_regclass('nex.attribution_template'))                          AS tbl,
       (SELECT 1 FROM pg_indexes WHERE schemaname='nex' AND indexname='idx_nex_at_simulated') AS idx1`,
  );
  const v = verify.rows[0];
  log(
    `post-apply · table=${v.tbl ? "present" : "MISSING"} ` +
      `idx1=${v.idx1 ? "present" : "MISSING"}`,
  );

  const seeded = await client.query(
    `SELECT template_id, simulated FROM nex.attribution_template ORDER BY template_id`,
  );
  log(
    `post-apply · catalog has ${seeded.rows.length} row(s): ` +
      seeded.rows
        .map((r) => `${r.template_id}(simulated=${r.simulated})`)
        .join(", "),
  );
  const seededIds = new Set(seeded.rows.map((r) => r.template_id));
  const missing = EXPECTED_TEMPLATES.filter((id) => !seededIds.has(id));
  if (missing.length > 0) {
    log(`FATAL · missing expected template_ids: ${missing.join(", ")}`);
    await client.end();
    process.exit(2);
  }
  const notSimulated = seeded.rows.filter((r) => r.simulated === false);
  if (notSimulated.length > 0) {
    log(
      `WARN · ${notSimulated.length} row(s) carry simulated=false (operator may have promoted post-apply) · ${notSimulated.map((r) => r.template_id).join(", ")}`,
    );
  }

  // source_registry row count MUST be unchanged.
  const regAfter = await client.query(
    `SELECT COUNT(*)::int AS n FROM nex.source_registry`,
  );
  const regCountAfter = regAfter.rows[0].n;
  log(`post-apply · nex.source_registry row count = ${regCountAfter}`);
  if (regCountAfter !== regCountBefore) {
    log(
      `FATAL · source_registry row count changed (${regCountBefore} → ${regCountAfter}) · migration 192 must never write to source_registry`,
    );
    await client.end();
    process.exit(2);
  }

  const anyMissing = !v.tbl || !v.idx1;
  if (anyMissing) {
    log("FATAL · post-apply verification failed");
    await client.end();
    process.exit(2);
  }

  log(
    alreadyPresent
      ? `SUMMARY · migration 192 already present · ${seeded.rows.length} template(s) present`
      : `SUMMARY · migration 192 applied cleanly · nex.${EXPECTED_TABLE} created · ${seeded.rows.length} template(s) seeded`,
  );

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(
    `[apply-192] UNEXPECTED · ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
