// scripts/nex-phase5-endurance-report.mjs
//
// Phase 5 · W5-4 · Endurance report runner
// Invokes generateEnduranceReport against the live production ledgers
// and prints the full JSON. Read-only · no production writes.

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const inner = String.raw`
import { generateEnduranceReport } from "@/lib/nex/master-ai/endurance-report";
const report = generateEnduranceReport();
console.log("PHASE_5_ENDURANCE_REPORT:" + JSON.stringify(report, null, 2));
`;

const dir = path.resolve(process.cwd(), "scripts", ".phase5-runner");
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
