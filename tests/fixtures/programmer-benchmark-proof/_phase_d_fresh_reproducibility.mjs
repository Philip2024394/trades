// NEX Programmer Agent · Phase D · FRESH-PROCESS REPRODUCIBILITY PROOF
// Philip 2026-09-05 · AUTHORIZE §28
//
// Spawns as a SEPARATE Node process · loads the exact corpus version ·
// executes the exact benchmark runner logic · compares the aggregate
// results against a previous run summary. Verifies that:
//   · deterministic output (same corpus + same reviewer → same results)
//   · no conversational state required
//   · corpus is loaded from source · not from in-memory cache

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

if (!process.env.__PHASE_D_FRESH_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __PHASE_D_FRESH_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  console.log("\n═══ FRESH PROCESS · Phase D benchmark reproducibility ═══");
  console.log(`  process.pid=${process.pid}`);

  const priorRunPath = path.join(here, "_phase_d_run.json");
  if (!existsSync(priorRunPath)) {
    console.error("FAIL · no prior run summary at " + priorRunPath + " · run _phase_d_benchmark_runner.mjs first");
    process.exit(1);
  }
  const priorRun = JSON.parse(readFileSync(priorRunPath, "utf8"));

  const { freezeCorpus } = await import("../../../src/lib/nex/programmer-benchmark/corpus.ts");
  const { evaluateCorpus, checkThresholds, deriveEvaluationVerdict } = await import("../../../src/lib/nex/programmer-benchmark/evaluator.ts");
  const { CORPUS_V1_CASES, CORPUS_VERSION } = await import("./_corpus_v1/cases.ts");

  const corpus = freezeCorpus({
    version: CORPUS_VERSION,
    authored_by: "philip · 2026-09-05",
    cases: CORPUS_V1_CASES,
  });

  console.log(`  corpus version loaded: ${corpus.version}`);
  console.log(`  case count           : ${corpus.case_count}`);

  const run = evaluateCorpus(corpus, { triggered_by: "runner" });
  const checks = checkThresholds(run.overall, run.per_class);
  const verdict = deriveEvaluationVerdict(checks);

  // ─── Verify determinism against prior run ────────────────────

  const fingerprint = (results) => createHash("sha256")
    .update(results.map((r) => `${r.case_id}|${r.match_status}|${r.actual_verdict}|${r.actual_finding_count}`).sort().join("\n"))
    .digest("hex")
    .slice(0, 24);

  const priorFP = fingerprint(priorRun.run.results);
  const freshFP = fingerprint(run.results);

  console.log(`\n─── Determinism check ───`);
  console.log(`  prior fingerprint: ${priorFP}`);
  console.log(`  fresh fingerprint: ${freshFP}`);
  const deterministic = priorFP === freshFP;
  console.log(`  deterministic    : ${deterministic ? "🟢 YES" : "🔴 NO"}`);

  // ─── Verify aggregate metrics match ──────────────────────────

  const overallMatches =
    priorRun.run.overall.correct === run.overall.correct &&
    priorRun.run.overall.wrong === run.overall.wrong &&
    priorRun.run.overall.defective_catch_rate === run.overall.defective_catch_rate &&
    priorRun.run.overall.false_positive_rate === run.overall.false_positive_rate;
  console.log(`  overall metrics  : ${overallMatches ? "🟢 MATCH" : "🔴 MISMATCH"}`);

  // ─── Emit fresh-process summary ──────────────────────────────

  const summary = {
    process_pid: process.pid,
    ran_at: new Date().toISOString(),
    prior_run_id: priorRun.run.run_id,
    fresh_run_id: run.run_id,
    corpus_version: corpus.version,
    case_count: corpus.case_count,
    prior_fingerprint: priorFP,
    fresh_fingerprint: freshFP,
    deterministic,
    overall_matches: overallMatches,
    fresh_overall: run.overall,
    fresh_verdict: verdict,
  };
  writeFileSync(path.join(here, "_phase_d_fresh_reproducibility.json"), JSON.stringify(summary, null, 2) + "\n", "utf8");
  console.log(`\n→ _phase_d_fresh_reproducibility.json`);

  if (!deterministic || !overallMatches) {
    console.error(`\n🔴 Phase D reproducibility FAILED · fingerprints diverge`);
    process.exit(1);
  }
  console.log(`\n🟢 fresh process reproduced identical results from disk · no conversational state required`);
  process.exit(0);
}
