// scripts/nex-canonical/_safechat-retention-sweep.mjs
//
// NEX SafeChat Phase 1 · classification retention sweep runner
// (sealed 2026-10-10 Privacy Audit).
//
// Deletes rows from nex.safechat_classification older than
// NEX_SAFECHAT_RETENTION_DAYS (default 30). Idempotent · safe to re-run.
//
// SESSION IDENTITY GATE
//   current_database() MUST equal 'nex_dev' before any write. The
//   script refuses to touch any other database.
//
// USAGE
//   # dry-run · reports what WOULD be deleted
//   node --env-file=.env.local scripts/nex-canonical/_safechat-retention-sweep.mjs --dry-run
//
//   # live run · deletes + reports the row count
//   node --env-file=.env.local scripts/nex-canonical/_safechat-retention-sweep.mjs --apply
//
// EXIT
//   0 · sweep (or dry-run) completed
//   1 · identity check failed · aborted before any write
//   2 · DB error · nothing deleted
//   3 · invalid NEX_SAFECHAT_RETENTION_DAYS

import pg from "pg";

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[safechat-retention] ${msg}`);
}

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
    apply: argv.includes("--apply"),
  };
}

function readRetentionDays() {
  const raw = process.env.NEX_SAFECHAT_RETENTION_DAYS;
  if (!raw) return 30;
  if (!/^\d+$/.test(raw)) {
    log(`FATAL · NEX_SAFECHAT_RETENTION_DAYS must be a positive integer · got '${raw}'`);
    process.exit(3);
  }
  const n = Number.parseInt(raw, 10);
  if (n <= 0) {
    log(`FATAL · NEX_SAFECHAT_RETENTION_DAYS must be > 0 · got ${n}`);
    process.exit(3);
  }
  return n;
}

async function main() {
  const { dryRun, apply } = parseArgs(process.argv.slice(2));
  if (!dryRun && !apply) {
    log("usage: --dry-run (count only) · --apply (delete)");
    process.exit(0);
  }
  if (dryRun && apply) {
    log("FATAL · pass EITHER --dry-run OR --apply, not both");
    process.exit(3);
  }

  const retentionDays = readRetentionDays();
  log(`retention window · ${retentionDays} days`);

  const url = process.env.NEX_POSTGRES_URL;
  if (!url) {
    log("FATAL · NEX_POSTGRES_URL is not set");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  // --- identity gate ---
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

  // --- table presence check ---
  const tbl = await client.query(
    "SELECT to_regclass('nex.safechat_classification') AS t",
  );
  if (tbl.rows[0].t === null) {
    log("FATAL · nex.safechat_classification is absent · apply migration 199 first");
    await client.end();
    process.exit(2);
  }

  // --- dry-run · count only ---
  if (dryRun) {
    try {
      const r = await client.query(
        `SELECT count(*)::int AS n,
                (now() - ($1::int || ' days')::interval)::text AS at
           FROM nex.safechat_classification
          WHERE classified_at < now() - ($1::int || ' days')::interval`,
        [retentionDays],
      );
      const row = r.rows[0] ?? { n: 0, at: "" };
      log(`DRY-RUN · would delete ${row.n} row(s) older than ${row.at}`);
      await client.end();
      process.exit(0);
    } catch (err) {
      log(`FATAL · dry-run query failed · ${err instanceof Error ? err.message : String(err)}`);
      await client.end();
      process.exit(2);
    }
  }

  // --- live sweep ---
  try {
    const r = await client.query(
      `WITH deleted AS (
         DELETE FROM nex.safechat_classification
          WHERE classified_at < now() - ($1::int || ' days')::interval
         RETURNING classification_id
       )
       SELECT count(*)::int AS n,
              (now() - ($1::int || ' days')::interval)::text AS at
         FROM deleted`,
      [retentionDays],
    );
    const row = r.rows[0] ?? { n: 0, at: "" };
    log(`APPLIED · deleted ${row.n} row(s) older than ${row.at}`);
    log("sweep is idempotent · re-run will delete 0 unless time passes");
    await client.end();
    process.exit(0);
  } catch (err) {
    log(`FATAL · sweep failed · ${err instanceof Error ? err.message : String(err)}`);
    await client.end();
    process.exit(2);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(
    `[safechat-retention] UNEXPECTED · ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
