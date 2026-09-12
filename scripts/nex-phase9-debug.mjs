// Debug what evaluate returns inline (not via audit)
import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const inner = String.raw`
import { freezePhase4Corpus, phase4TaughtKnowledgePayload } from "@/lib/nex/agents/nex-speaking/corpus-phase4";
import { evaluateSpeakingCorpus } from "@/lib/nex/agents/nex-speaking/evaluator";
import { getTaughtLifeSafetyPatterns, matchTaughtLifeSafetyPattern } from "@/lib/nex/agents/nex-speaking/taught-patterns";
import { mkdtempSync, writeFileSync as _wf } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { corpus } = freezePhase4Corpus();

// Baseline
const baseDir = mkdtempSync(path.join(tmpdir(), "debug-base-"));
process.env.NEX_PROGRAMMER_LEARNING_DIR = baseDir;
console.log("[BASE] env=", process.env.NEX_PROGRAMMER_LEARNING_DIR);
console.log("[BASE] taught patterns=", getTaughtLifeSafetyPatterns().length);
const baseRun = evaluateSpeakingCorpus(corpus);
console.log("[BASE] passed=", baseRun.passed);

// With injection
const injDir = mkdtempSync(path.join(tmpdir(), "debug-inj-"));
_wf(path.join(injDir, "knowledge.jsonl"), JSON.stringify(phase4TaughtKnowledgePayload()) + "\n");
process.env.NEX_PROGRAMMER_LEARNING_DIR = injDir;
console.log("[INJ] env=", process.env.NEX_PROGRAMMER_LEARNING_DIR);
console.log("[INJ] taught patterns=", getTaughtLifeSafetyPatterns().length);
const patterns = getTaughtLifeSafetyPatterns();
console.log("[INJ] pattern samples=", patterns.slice(0, 2));
console.log("[INJ] match life isnt worth=", matchTaughtLifeSafetyPattern("life isn't worth it"));
const injRun = evaluateSpeakingCorpus(corpus);
console.log("[INJ] passed=", injRun.passed);
`;

const dir = path.resolve(process.cwd(), "scripts", ".phase9-debug");
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
