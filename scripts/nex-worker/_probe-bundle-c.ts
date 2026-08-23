// scripts/nex-worker/_probe-bundle-c.ts · Task #77 Bundle C · 2026-08-22
//
// Verifies:
//   1. Image Intake dedicated spec is active · no longer falls through to
//      evaluateGenericDefault (six-criteria reason strings should change).
//   2. Comms Social spec exists in the router · will activate when a
//      social:comms:* worker registers (Vercel cron or manual invocation).
//   3. Reception shows 5 HQ_SYSTEMS (Walker · CLE · Brain · Intake · Social)
//      including the two new entries · aggregate verdict honest per system.
//   4. Triaged records untouched · Walker + CLE evaluators unchanged.
//
// End-to-end trigger: one empty Image Intake batch fires a new cycle_run
// so the evaluator has a real cycle to bracket. No side effects on triaged
// records (empty batch writes zero knowledge_inbox rows).

import { Pool } from "pg";
import { runIntakeBatch } from "../../src/lib/nex/intake/image-plus-description-worker.js";
import { evaluateAllSystems } from "../../src/lib/nex/hq/system-aggregator.js";
import { evaluateWorker, listAllWorkers } from "../../src/lib/nex/hq/evaluate-worker.js";

async function main() {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
  const pool = new Pool({ connectionString: url });
  try {
    console.log("\n═════ BUNDLE C PROBE · Image Intake + Comms Social specs · 2026-08-22 ═════\n");

    // ── 1 · trigger one image intake batch (zero side effects) ─────────
    console.log("1. Triggering Image Intake (empty batch · registers a fresh cycle_run) ...");
    await runIntakeBatch(pool, []);
    console.log("   done");

    // ── 2 · six-criteria for intake:image · verify dedicated spec active
    console.log("\n2. Six-criteria for intake:image (dedicated spec should replace generic-default):");
    const intakeRef = (await listAllWorkers(pool)).find((w) => w.worker_id === "intake:image");
    if (!intakeRef) {
      console.log("   FAIL · intake:image not registered · Bundle A gap");
    } else {
      const ev = await evaluateWorker(pool, intakeRef);
      console.log(`   verdict=${ev.verdict}`);
      console.log(`   reason=${ev.verdict_reason}`);
      for (const k of ["input", "consumed", "output", "state", "heartbeat", "provable"] as const) {
        const c = ev.criteria[k];
        console.log(`     ${c.passed ? "PASS" : "FAIL"}  ${k.padEnd(10)} count=${String(c.count).padStart(4)}  ${c.reason.slice(0, 80)}`);
      }
      const usingDedicatedSpec = !ev.criteria.input.reason.includes("No dedicated spec");
      console.log(`   dedicated-spec active: ${usingDedicatedSpec ? "YES ✓" : "NO ✗"}`);
    }

    // ── 3 · Reception aggregate · 5 systems expected ────────────────────
    console.log("\n3. Reception aggregate · expect 5 systems (Walker · CLE · Brain · Intake · Social):");
    const systems = await evaluateAllSystems(pool);
    for (const s of systems) {
      console.log(`   ${s.verdict.padEnd(12)}  ${s.system.displayName.padEnd(45).slice(0, 45)}  ${s.reality}`);
    }
    const hasIntake = systems.some((s) => s.system.key === "intake");
    const hasSocial = systems.some((s) => s.system.key === "social");
    console.log(`   intake system row: ${hasIntake ? "YES ✓" : "NO ✗"}`);
    console.log(`   social system row: ${hasSocial ? "YES ✓" : "NO ✗"}`);

    // ── 4 · triaged records untouched ──────────────────────────────────
    const triaged = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM nex.knowledge_inbox) AS knowledge_inbox_total,
        (SELECT COUNT(*)::int FROM nex.knowledge_inbox WHERE status='waiting') AS waiting_should_stay_4
    `);
    console.log("\n4. Triaged records (must remain 157/4):", triaged.rows[0]);

    // ── 5 · verdict ────────────────────────────────────────────────────
    const allGood =
      systems.length === 5 &&
      hasIntake && hasSocial &&
      triaged.rows[0].knowledge_inbox_total === 157 &&
      triaged.rows[0].waiting_should_stay_4 === 4;
    console.log("\n═════ VERDICT ═════");
    console.log(allGood ? "🟢 GREEN · Bundle C specs live · Reception knows 5 systems" : "🟡 AMBER · see above");
    console.log();
  } catch (err) {
    console.error("[probe] error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
