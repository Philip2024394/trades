#!/usr/bin/env node
// show-workforce.mjs · HQ view of the Walker Workforce.
//
// Reads the persisted workforce-state.json and prints the operational
// snapshot: workers by state, workers by branch, records today,
// recent incidents, open breakers, dead-letter count.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

if (!process.env.__WORKFORCE_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __WORKFORCE_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { WorkforceRegistry } = await import("../../src/lib/nex/indonesia/workforce/registry.ts");
  const { buildReport } = await import("../../src/lib/nex/indonesia/workforce/reporter.ts");
  const registry = new WorkforceRegistry();
  const report = buildReport(registry);

  console.log(`\nNEX WALKER WORKFORCE · HQ view`);
  console.log(`Snapshot taken: ${report.takenAt}`);
  console.log(`\nWORKERS         ${report.totals.workers}`);
  for (const [s, n] of Object.entries(report.totals.byState)) if (n > 0) console.log(`  ${s.padEnd(10)} ${n}`);
  console.log(`\nRECORDS TODAY   ${report.totals.recordsToday}`);
  console.log(`LAST PUBLISH    ${report.totals.lastPublishAt ?? "(none yet)"}`);

  console.log(`\nBY BRANCH`);
  console.log(`  branch          workers  healthy  degraded  dead`);
  console.log(`  ─────────────── ───────  ───────  ────────  ────`);
  for (const b of report.byBranch) {
    console.log(`  ${b.branch.padEnd(15)} ${String(b.workers).padStart(7)}  ${String(b.healthy).padStart(7)}  ${String(b.degraded).padStart(8)}  ${String(b.dead).padStart(4)}`);
  }

  if (report.recentIncidents.length > 0) {
    console.log(`\n⚠ RECENT INCIDENTS`);
    for (const i of report.recentIncidents) {
      console.log(`  ${i.workerId.padEnd(48)} ${i.state.padEnd(10)} since ${i.since}`);
      if (i.reason) console.log(`    reason: ${i.reason}`);
    }
  }

  if (report.openBreakers.length > 0) {
    console.log(`\n🔴 OPEN CIRCUIT BREAKERS · ${report.openBreakers.length}`);
    for (const b of report.openBreakers) {
      console.log(`  ${b.sourceKey.padEnd(40)} state=${b.state} failures=${b.failures}`);
    }
  }

  console.log(`\nDEAD LETTER QUEUE · ${report.deadLetterCount} entries`);
  console.log("");
}
