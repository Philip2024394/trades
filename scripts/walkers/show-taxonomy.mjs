#!/usr/bin/env node
// show-taxonomy.mjs · inventory of the NEX Indonesia walker workforce.
//
// Prints the full taxonomy grouped by branch, showing status
// (planned / config_defined / active / mature) + priority tier +
// target record count for each specialist walker.
//
// Use this to answer:
//   · What walkers exist as specs?
//   · Which are actually publishing records today?
//   · What's next on the Tier-A build queue?
//
// Usage: npm run walkers:taxonomy

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

if (!process.env.__TAXONOMY_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __TAXONOMY_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { listAllWalkerSpecs, BRANCH_LABELS } = await import("../../src/lib/nex/indonesia/walkers/taxonomy.ts");
  const all = listAllWalkerSpecs();

  const byBranch = {};
  for (const s of all) (byBranch[s.branch] ??= []).push(s);

  console.log(`\nNEX INDONESIA WALKER WORKFORCE · ${all.length} specialist walkers across ${Object.keys(byBranch).length} branches\n`);

  const summary = { planned: 0, config_defined: 0, active: 0, mature: 0 };
  for (const s of all) summary[s.status]++;
  console.log(`STATUS · planned:${summary.planned} · config_defined:${summary.config_defined} · active:${summary.active} · mature:${summary.mature}`);

  const targetTotal = all.reduce((a, s) => a + (s.targetRecords ?? 0), 0);
  console.log(`AT MATURITY · target records: ~${targetTotal.toLocaleString()}\n`);

  for (const [branch, label] of Object.entries(BRANCH_LABELS)) {
    const specs = byBranch[branch] ?? [];
    if (specs.length === 0) continue;
    console.log(`\n═══ ${label.toUpperCase()} · ${specs.length} walkers ═══`);
    // Sort: active first, then config_defined, then planned by priority
    specs.sort((a, b) => {
      const rank = (s) => ({ mature: 0, active: 1, config_defined: 2, planned: 3 }[s.status] ?? 9);
      const r = rank(a) - rank(b);
      return r !== 0 ? r : a.priority - b.priority;
    });
    for (const s of specs) {
      const icon = { mature: "✅", active: "✅", config_defined: "🟡", planned: "⚪" }[s.status];
      const status = s.status.padEnd(14);
      const priority = `P${s.priority}`;
      const target = s.targetRecords ? `~${s.targetRecords} records` : "".padEnd(14);
      console.log(`  ${icon} ${status} ${priority}  ${s.id.padEnd(52)} ${target}`);
      console.log(`     ${s.purpose}`);
      if (s.rationale) console.log(`     WHY: ${s.rationale}`);
    }
  }

  console.log(`\n─── PRIORITY QUEUE ───`);
  const tierA = all.filter((s) => s.priority === 1 && s.status === "planned");
  const tierB = all.filter((s) => s.priority === 2 && s.status === "planned");
  console.log(`Tier A (build next · ${tierA.length}): ${tierA.map((s) => s.id.replace("walker.", "")).join(", ")}`);
  console.log(`Tier B (build after · ${tierB.length}): ${tierB.slice(0, 8).map((s) => s.id.replace("walker.", "")).join(", ")}${tierB.length > 8 ? ` … +${tierB.length - 8} more` : ""}`);
}
