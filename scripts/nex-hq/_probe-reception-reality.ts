// scripts/nex-hq/_probe-reception-reality.ts · Task #72 Step 4 · 2026-08-22
//
// Read-only probe · runs evaluateAllSystems against nex_dev and prints
// the Reception Reality Strip content the browser would render. Used for
// Step 4 acceptance evidence.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/nex-hq/_probe-reception-reality.ts

import { Pool } from "pg";
import { evaluateAllSystems } from "../../src/lib/nex/hq/system-aggregator.js";

const GLYPH: Record<string, string> = {
  GREEN: "🟢", PARTIAL: "🟡", FAILED: "🔴", STUCK: "🔵",
  NOT_RUNNING: "⚪", BLOCKED: "⛔", UNKNOWN: "❓",
};

async function main() {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
  const pool = new Pool({ connectionString: url });
  try {
    const systems = await evaluateAllSystems(pool);
    console.log("\n╔══════════════════════════════════════════════════════════════════════════════╗");
    console.log("║  NEX HQ · Reception Reality Strip · same evaluator as /workers · Step 4     ║");
    console.log("╚══════════════════════════════════════════════════════════════════════════════╝\n");
    console.log("SYSTEM                                 STATUS        REALITY");
    console.log("─".repeat(80));
    for (const s of systems) {
      const badge = `${GLYPH[s.verdict]} ${s.verdict.padEnd(11)}`;
      console.log(`${s.system.displayName.padEnd(40).slice(0, 40)} ${badge}  ${s.reality}`);
      if (s.worker_ids.length > 0) {
        console.log(`  ${" ".repeat(40)}                ${s.worker_ids.join(", ")}`);
      }
      console.log(`  ${" ".repeat(40)}                last checked: ${s.evaluated_at}`);
      console.log();
    }
    const summary: Record<string, number> = {};
    for (const s of systems) summary[s.verdict] = (summary[s.verdict] ?? 0) + 1;
    console.log("── SYSTEM AGGREGATE ──");
    for (const [v, n] of Object.entries(summary)) if (n > 0) console.log(`  ${GLYPH[v] ?? "·"} ${v.padEnd(12)} ${n} system${n === 1 ? "" : "s"}`);
  } catch (err) {
    console.error("[reception] error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
