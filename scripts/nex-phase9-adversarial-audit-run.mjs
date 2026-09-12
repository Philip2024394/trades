// scripts/nex-phase9-adversarial-audit-run.mjs
//
// Phase 9 · Runs adversarial audit against the REAL Phase 4 speaking
// teaching claim (Δ+3) and prints the full audit result.

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const inner = String.raw`
import { runAdversarialAudit } from "@/lib/nex/programmer-improvement/adversarial-evaluator";
import { freezePhase4Corpus, phase4TaughtKnowledgePayload } from "@/lib/nex/agents/nex-speaking/corpus-phase4";
import { evaluateSpeakingCorpus } from "@/lib/nex/agents/nex-speaking/evaluator";

const { corpus } = freezePhase4Corpus();

const claim = {
  claim_id: "adv_phase4_speaking_real",
  candidate_id: "know_phase4_speaking_life_safety_implicit_v1",
  candidate_kind: "knowledge",
  domain_label: "speaking.life_safety",
  original_delta: 3,
  baseline_passed: 1,
  original_knowledge: phase4TaughtKnowledgePayload(),
  evaluate: (rootDir, opts) => {
    let corpusForRun = corpus;
    if (opts?.reverse_case_order || opts?.extra_summary_prefix) {
      const cases = corpus.cases.slice();
      if (opts.reverse_case_order) cases.reverse();
      if (opts.extra_summary_prefix) {
        for (let i = 0; i < cases.length; i += 1) {
          const c = cases[i];
          cases[i] = {
            ...c,
            user_context: { ...c.user_context, message: opts.extra_summary_prefix + c.user_context.message },
          };
        }
      }
      corpusForRun = { ...corpus, cases };
    }
    const run = evaluateSpeakingCorpus(corpusForRun);
    return run.results.filter((r) => r.match_status === "CORRECT").length;
  },
};

const audit = runAdversarialAudit(claim);
console.log("PHASE_9_ADVERSARIAL_AUDIT:" + JSON.stringify(audit, null, 2));
`;

const dir = path.resolve(process.cwd(), "scripts", ".phase9-runner");
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
