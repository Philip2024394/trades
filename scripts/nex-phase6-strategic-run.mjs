// scripts/nex-phase6-strategic-run.mjs
//
// Phase 6 · W5-5 · Runs strategic-intelligence against live production
// ledgers · prints real recommendations. Read-only · does NOT persist
// to production strategic_recommendations.jsonl (Founder gate).

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const inner = String.raw`
import { deriveStrategicRecommendations } from "@/lib/nex/master-ai/strategic-intelligence";
const recs = deriveStrategicRecommendations();
console.log("PHASE_6_STRATEGIC_RECOMMENDATIONS:" + JSON.stringify({
  count: recs.length,
  by_confidence: recs.reduce((acc, r) => { acc[r.confidence] = (acc[r.confidence] ?? 0) + 1; return acc; }, {}),
  recommendations: recs,
  founder_gate: "no autonomous action taken · every recommendation requires explicit Founder decision",
}, null, 2));
`;

const dir = path.resolve(process.cwd(), "scripts", ".phase6-runner");
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const tsPath = path.join(dir, "runner.ts");
writeFileSync(tsPath, inner, "utf8");
process.on("exit", () => { try { unlinkSync(tsPath); } catch { /* */ } });

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", tsPath],
  { cwd: process.cwd(), stdio: "inherit", env: { ...process.env, NODE_NO_WARNINGS: "1" }, shell: true }
);
child.on("exit", (code) => process.exit(code ?? 1));
