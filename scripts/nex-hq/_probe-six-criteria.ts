// scripts/nex-hq/_probe-six-criteria.ts · Task #72 Step 3 · 2026-08-22
//
// Read-only probe · runs the six-criteria evaluator against every worker
// currently registered in nex_dev and prints the honest verdicts. Used
// for Step 3 acceptance evidence · never mutates data.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/nex-hq/_probe-six-criteria.ts

import { Pool } from "pg";
import { evaluateWorker, listAllWorkers } from "../../src/lib/nex/hq/evaluate-worker.js";
import type { CriteriaKey } from "../../src/lib/nex/hq/worker-criteria.js";

const CRIT_ORDER: CriteriaKey[] = ["input", "consumed", "output", "state", "heartbeat", "provable"];
const GLYPH: Record<string, string> = {
  GREEN: "🟢", PARTIAL: "🟡", FAILED: "🔴", STUCK: "🔵",
  NOT_RUNNING: "⚪", BLOCKED: "⛔", UNKNOWN: "❓",
};

async function main() {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
  const pool = new Pool({ connectionString: url });
  try {
    const workers = await listAllWorkers(pool);
    console.log(`[six-criteria] evaluating ${workers.length} worker(s)\n`);
    const summary: Record<string, number> = {
      GREEN: 0, PARTIAL: 0, FAILED: 0, STUCK: 0, NOT_RUNNING: 0, BLOCKED: 0, UNKNOWN: 0,
    };
    for (const w of workers) {
      const ev = await evaluateWorker(pool, w);
      summary[ev.verdict] = (summary[ev.verdict] ?? 0) + 1;
      console.log(`${GLYPH[ev.verdict]} ${ev.verdict}  ${ev.worker_id}`);
      console.log(`   ${ev.verdict_reason}`);
      console.log(`   criteria:`);
      for (const k of CRIT_ORDER) {
        const c = ev.criteria[k];
        console.log(`     ${c.passed ? "PASS" : "FAIL"}  ${k.padEnd(10)}  count=${String(c.count).padStart(4)}  ${c.reason.slice(0, 90)}`);
      }
      console.log();
    }
    console.log(`── SUMMARY ──`);
    for (const [v, n] of Object.entries(summary)) if (n > 0) console.log(`  ${GLYPH[v] ?? "·"} ${v.padEnd(12)} ${n}`);
  } catch (err) {
    console.error("[six-criteria] error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
