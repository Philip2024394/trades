// scripts/nex-phase11-strategic-continuous-run.mjs
//
// Phase 11 · Runs the strategic-intelligence continuous cycle against
// live production ledgers · classifies + fingerprints + persists +
// generates weekly rollup. Defaults to DRY-RUN (does not write) unless
// --persist flag is passed.

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const persist = process.argv.includes("--persist");

const inner = String.raw`
import { runStrategicCycle } from "@/lib/nex/master-ai/strategic-intelligence-continuous";
const dryRun = process.argv.includes("--dry-run") || !process.argv.includes("--persist");
const result = runStrategicCycle({ dry_run: dryRun });
console.log("PHASE_11_STRATEGIC_CYCLE:" + JSON.stringify({
  cycle_id: result.cycle_id,
  persisted: result.persisted,
  ledger_path: result.ledger_path,
  recommendations_count: result.recommendations.length,
  by_classification: result.recommendations.reduce((acc, r) => { acc[r.classification] = (acc[r.classification] ?? 0) + 1; return acc; }, {}),
  by_confidence: result.recommendations.reduce((acc, r) => { acc[r.confidence] = (acc[r.confidence] ?? 0) + 1; return acc; }, {}),
  weekly_rollup: result.weekly_rollup,
  recommendations: result.recommendations.map((r) => ({
    fingerprint: r.fingerprint,
    generator: r.generator,
    classification: r.classification,
    confidence: r.confidence,
    cycles_observed: r.cycles_observed,
    first_seen_iso: r.first_seen_iso,
    hypothesis_excerpt: r.hypothesis.slice(0, 200),
  })),
  founder_gate: "recommendations are OBSERVATIONS · never actions · every record still carries requires_founder_approval:true",
}, null, 2));
`;

const dir = path.resolve(process.cwd(), "scripts", ".phase11-runner");
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const tsPath = path.join(dir, "runner.ts");
writeFileSync(tsPath, inner, "utf8");
process.on("exit", () => { try { unlinkSync(tsPath); } catch { /* */ } });

const args = ["tsx", tsPath];
if (persist) args.push("--persist"); else args.push("--dry-run");

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  args,
  { cwd: process.cwd(), stdio: "inherit", env: { ...process.env, NODE_NO_WARNINGS: "1" }, shell: true }
);
child.on("exit", (code) => process.exit(code ?? 1));
