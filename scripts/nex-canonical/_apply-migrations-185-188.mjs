// scripts/nex-canonical/_apply-migrations-185-188.mjs
//
// NEX Directory · Verticals agent · idempotent one-shot applier for the
// four source-registry seed migrations (185..188). These migrations are
// additive: they insert a single row into `nex.source_registry` with
// ON CONFLICT (source_id) DO NOTHING. Re-running finds the row already
// present and logs "0 new rows written". Safe on populated DB.
//
// CRITICAL IDENTITY GATE
//   SELECT current_database() MUST equal 'nex_dev' before any write.
//   The script refuses to touch any other database.
//
// CRITICAL BEHAVIOUR GATE
//   This script never flips `can_display` or `can_derive` away from the
//   defaults set by the migration file. The founder authored the flags
//   inside the SQL files; this script merely applies them verbatim.
//
// USAGE
//   node --env-file=.env.local scripts/nex-canonical/_apply-migrations-185-188.mjs
//
// EXIT
//   0 · all four migrations applied cleanly (or already present)
//   1 · identity check failed · aborted before any write
//   2 · migration failed · transaction rolled back
//
// This file is a VERTICALS-AGENT utility · it is NOT the sealed migration
// pipeline · it is a thin, explicit, auditable applier.

import * as fs from "node:fs/promises";
import * as path from "node:path";
import pg from "pg";

const MIGRATIONS = [
  {
    file: "deploy/postgres/init/185_nex_source_registry_legacy_accommodation.sql",
    expectedSourceId: "nex_accommodation_business_legacy",
  },
  {
    file: "deploy/postgres/init/186_nex_source_registry_legacy_service.sql",
    expectedSourceId: "nex_service_business_legacy",
  },
  {
    file: "deploy/postgres/init/187_nex_source_registry_legacy_mp_seller.sql",
    expectedSourceId: "nex_mp_seller_legacy",
  },
  {
    file: "deploy/postgres/init/188_nex_source_registry_legacy_transport.sql",
    expectedSourceId: "nex_transport_acquisition_legacy",
  },
];

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[apply-185-188] ${msg}`);
}

async function main() {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) {
    log("FATAL · NEX_POSTGRES_URL is not set");
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

  // Pre-count of source_registry rows (for delta reporting).
  const expectedIds = MIGRATIONS.map((m) => m.expectedSourceId);
  const beforeRes = await client.query(
    "SELECT source_id FROM nex.source_registry WHERE source_id = ANY($1) ORDER BY source_id",
    [expectedIds],
  );
  const beforeSet = new Set(beforeRes.rows.map((r) => r.source_id));
  log(
    `pre-apply · existing matching rows: ${beforeSet.size}/${expectedIds.length}` +
      (beforeSet.size > 0 ? ` [${Array.from(beforeSet).join(", ")}]` : ""),
  );

  // Apply in a single transaction. If any migration fails, roll back
  // everything to avoid partial state.
  const repo = process.cwd();
  try {
    await client.query("BEGIN");
    for (const m of MIGRATIONS) {
      const abs = path.resolve(repo, m.file);
      const sql = await fs.readFile(abs, "utf8");
      log(`applying ${m.file} · expected source_id='${m.expectedSourceId}'`);
      await client.query(sql);
    }
    await client.query("COMMIT");
    log("transaction committed");
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    log(`FATAL · migration failed · ${err instanceof Error ? err.message : String(err)}`);
    await client.end();
    process.exit(2);
  }

  // Verify all four rows exist with expected flags.
  const verifyRes = await client.query(
    `SELECT source_id, source_type, can_derive, can_display,
            can_redistribute, attribution_required
       FROM nex.source_registry
      WHERE source_id = ANY($1)
      ORDER BY source_id`,
    [expectedIds],
  );
  log("post-apply · source_registry rows:");
  for (const row of verifyRes.rows) {
    log(
      `  · ${row.source_id} · can_derive=${row.can_derive} · can_display=${row.can_display} · can_redistribute=${row.can_redistribute} · attribution_required=${row.attribution_required}`,
    );
  }
  const found = new Set(verifyRes.rows.map((r) => r.source_id));
  const missing = expectedIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    log(`FATAL · missing rows post-apply: ${missing.join(", ")}`);
    await client.end();
    process.exit(2);
  }

  const newlyWritten = expectedIds.filter((id) => !beforeSet.has(id)).length;
  log(`SUMMARY · ${verifyRes.rows.length} rows present · ${newlyWritten} newly written this run`);

  // Explicit publication-gate assertion · can_display must be FALSE on all four.
  const anyPublishable = verifyRes.rows.filter((r) => r.can_display === true);
  if (anyPublishable.length > 0) {
    log(
      `WARNING · can_display=TRUE on: ${anyPublishable.map((r) => r.source_id).join(", ")} · verticals agent did not do this · investigate`,
    );
  } else {
    log("publication-gate OK · all 4 verticals carry can_display=FALSE");
  }

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[apply-185-188] UNEXPECTED · ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
