// scripts/nex-phase10-knowledge-evolution-run.mjs
//
// Phase 10 · runs knowledge-evolution against real production knowledge store
// (which currently doesn't exist · so the report is honest zero).
// Also runs against a synthetic sample derived from Phase 4's taught knowledge
// so Founder can see the mechanism against real-shaped data.

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const inner = String.raw`
import { readKnowledge } from "@/lib/nex/programmer-learning/store";
import { generateEvolutionReport } from "@/lib/nex/programmer-learning/knowledge-evolution";
import { phase4TaughtKnowledgePayload } from "@/lib/nex/agents/nex-speaking/corpus-phase4";

const productionItems = readKnowledge();
const productionReport = generateEvolutionReport(productionItems);

// Also demonstrate the mechanism against Phase 4's real taught knowledge
// (as-if it had been persisted) to show how the evolution report looks
// once knowledge accumulates.
const demoItems = [phase4TaughtKnowledgePayload()];
const demoReport = generateEvolutionReport(demoItems);

console.log("PHASE_10_KNOWLEDGE_EVOLUTION:" + JSON.stringify({
  production_knowledge_store: {
    file_exists: productionItems.length > 0,
    report: productionReport,
  },
  demo_using_phase4_taught_knowledge: {
    report: demoReport,
  },
  founder_gate: "supersession proposals ALWAYS require Founder approval · nothing is applied automatically",
}, null, 2));
`;

const dir = path.resolve(process.cwd(), "scripts", ".phase10-runner");
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
