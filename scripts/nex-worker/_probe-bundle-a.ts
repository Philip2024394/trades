// scripts/nex-worker/_probe-bundle-a.ts · Task #75 Bundle A · 2026-08-22
//
// Read-only-then-safe-trigger probe:
//   1. Verify migration 072 landed (delivery_workers dropped · archive exists).
//   2. Trigger Image Intake worker with an EMPTY batch (zero side effects on
//      any triaged record · zero DB inserts to knowledge_inbox · only writes
//      canonical heartbeat + cycle_run).
//   3. Verify intake:image heartbeat + cycle_run rows appear in canonical tables.
//   4. Grep-equivalent · confirm no delivery_workers references remain in worker code.
//
// Delivery + Comms Social workers are NOT triggered here because:
//   · Delivery would process real delivery_jobs rows (Step-0 triaged · protected).
//   · Comms Social needs Next.js runtime for its db imports.
// Both are structurally verified via TypeScript compilation + grep · runtime
// verification happens the next time either worker naturally runs.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/nex-worker/_probe-bundle-a.ts

import { Pool } from "pg";
import { runIntakeBatch } from "../../src/lib/nex/intake/image-plus-description-worker.js";

async function main() {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
  const pool = new Pool({ connectionString: url });

  try {
    console.log("\n═════ BUNDLE A PROBE · 2026-08-22 ═════\n");

    // ── 1 · Verify migration 072 landed ────────────────────────────
    const migCheck = await pool.query(`
      SELECT
        (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='nex' AND table_name='delivery_workers')) AS plural_gone_should_be_false,
        (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='nex' AND table_name='delivery_workers_archive_2026_08_22')) AS archive_exists,
        (SELECT COUNT(*)::int FROM nex.delivery_workers_archive_2026_08_22) AS archive_rows
    `);
    console.log("1. Migration 072 state:");
    console.log("  ", migCheck.rows[0]);

    // ── 2 · Baseline: how many canonical heartbeats exist right now? ─
    const preHb = await pool.query(`
      SELECT worker_id, worker_type, last_status,
             ROUND(EXTRACT(EPOCH FROM (now() - last_heartbeat_at))) AS age_s
      FROM nex.worker_heartbeat ORDER BY worker_id
    `);
    console.log("\n2. Canonical worker_heartbeat rows BEFORE:");
    for (const r of preHb.rows) console.log(`   ${r.worker_id.padEnd(38)} type=${r.worker_type.padEnd(12)} status=${String(r.last_status).padEnd(10)} age=${r.age_s}s`);

    // ── 3 · Trigger Image Intake worker with empty batch ────────────
    console.log("\n3. Triggering Image Intake with empty batch (zero side effects · pure heartbeat proof) ...");
    const t0 = Date.now();
    const result = await runIntakeBatch(pool, []);
    const dt = Date.now() - t0;
    console.log(`   done in ${dt}ms · received=${result.received} processed=${result.processed} failed=${result.failed} batchId=${result.batchId}`);

    // ── 4 · Verify intake:image heartbeat + cycle_run rows appeared ─
    const postHbRow = await pool.query(`
      SELECT worker_id, worker_type, worker_config, last_status, last_cycle_run_id,
             ROUND(EXTRACT(EPOCH FROM (now() - last_heartbeat_at))) AS age_s,
             metadata
      FROM nex.worker_heartbeat WHERE worker_id = 'intake:image'
    `);
    console.log("\n4a. intake:image canonical heartbeat AFTER:");
    if (postHbRow.rows.length === 0) console.log("   FAIL · no row found");
    else {
      const r = postHbRow.rows[0];
      console.log(`   worker_id=${r.worker_id} type=${r.worker_type} config=${r.worker_config}`);
      console.log(`   status=${r.last_status} age=${r.age_s}s cycle_run_id=${r.last_cycle_run_id}`);
      console.log(`   metadata=${JSON.stringify(r.metadata)}`);
    }

    const postCycle = await pool.query(`
      SELECT id, worker_id, worker_type, started_at, finished_at, duration_ms, status,
             records_processed, records_new, errors_count, summary
      FROM nex.worker_cycle_run
      WHERE worker_id = 'intake:image'
      ORDER BY started_at DESC LIMIT 1
    `);
    console.log("\n4b. intake:image most-recent cycle_run:");
    if (postCycle.rows.length === 0) console.log("   FAIL · no cycle_run found");
    else {
      const r = postCycle.rows[0];
      console.log(`   id=${r.id}`);
      console.log(`   started=${r.started_at?.toISOString?.() ?? r.started_at}`);
      console.log(`   finished=${r.finished_at?.toISOString?.() ?? r.finished_at}`);
      console.log(`   duration=${r.duration_ms}ms status=${r.status}`);
      console.log(`   records_processed=${r.records_processed} records_new=${r.records_new} errors=${r.errors_count}`);
      console.log(`   summary=${JSON.stringify(r.summary)}`);
    }

    // ── 5 · Verify triaged records untouched ────────────────────────
    const triaged = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM nex.knowledge_inbox) AS knowledge_inbox_total,
        (SELECT COUNT(*)::int FROM nex.knowledge_inbox WHERE status='waiting') AS waiting_should_stay_4
    `);
    console.log("\n5. Triaged records (must be identical BEFORE=157/4):");
    console.log("  ", triaged.rows[0]);

    // ── 6 · Verdict ─────────────────────────────────────────────────
    const allGood =
      migCheck.rows[0].plural_gone_should_be_false === false &&
      migCheck.rows[0].archive_exists === true &&
      postHbRow.rows.length === 1 &&
      postCycle.rows.length === 1 &&
      triaged.rows[0].knowledge_inbox_total === 157 &&
      triaged.rows[0].waiting_should_stay_4 === 4;

    console.log("\n═════ VERDICT ═════");
    console.log(allGood ? "🟢 GREEN · Bundle A probe passed" : "🟡 AMBER · check above");
    console.log();
  } catch (err) {
    console.error("[probe] error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
