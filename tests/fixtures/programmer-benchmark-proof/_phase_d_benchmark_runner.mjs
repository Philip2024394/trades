// NEX Programmer Agent · Phase D · BENCHMARK RUNNER
// Philip 2026-09-05 · AUTHORIZE · PHASE D §35
//
// Executes the frozen benchmark corpus against the Programmer Agent's
// review() function · aggregates per-class + overall + tests-pass-wrong
// + false-positive + uncertainty metrics · checks thresholds · derives
// GREEN/YELLOW/RED · writes machine-readable evidence + report inputs.
//
// SAFETY:
//   · Pure evaluation · no writes outside proof directory · no network
//   · Corpus is immutable during the run (freezeCorpus + snapshotCorpus)
//   · No autonomy · no scheduling · single explicit invocation

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

if (!process.env.__PHASE_D_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __PHASE_D_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { freezeCorpus, snapshotCorpus, isCorpusFrozen, detectHardcodingLeaks } =
    await import("../../../src/lib/nex/programmer-benchmark/corpus.ts");
  const { evaluateCorpus, checkThresholds, deriveEvaluationVerdict } =
    await import("../../../src/lib/nex/programmer-benchmark/evaluator.ts");
  const { CORPUS_V1_CASES, CORPUS_VERSION } = await import("./_corpus_v1/cases.ts");

  console.log("\n═══ NEX Programmer-Agent Phase D · Benchmark Runner ═══\n");

  // ─── Freeze + snapshot ────────────────────────────────────────

  const corpus = freezeCorpus({
    version: CORPUS_VERSION,
    authored_by: "philip · 2026-09-05",
    cases: CORPUS_V1_CASES,
  });
  console.log(`  corpus version : ${corpus.version}`);
  console.log(`  case count     : ${corpus.case_count}`);
  console.log(`  classes covered: ${corpus.defect_classes_covered.length}`);
  console.log(`  frozen?        : ${isCorpusFrozen(corpus)}`);

  const snap = snapshotCorpus(corpus);
  const leaks = detectHardcodingLeaks(corpus);
  console.log(`  hardcoding-leak scan: ${leaks.length === 0 ? "🟢 none" : `⚠ ${leaks.length}`}`);
  if (leaks.length > 0) {
    for (const l of leaks) console.log(`     · ${l}`);
  }

  // ─── Evaluate ────────────────────────────────────────────────

  console.log(`\n─── Evaluating ${corpus.case_count} cases ───\n`);
  const run = evaluateCorpus(corpus, { triggered_by: "runner" });

  // ─── Per-case output ─────────────────────────────────────────

  let correctCount = 0;
  let wrongCount = 0;
  let execErrCount = 0;
  for (const r of run.results) {
    const icon = r.match_status === "CORRECT" ? "🟢" : r.match_status === "WRONG" ? "🔴" : "⚫";
    if (r.match_status === "CORRECT") correctCount++;
    else if (r.match_status === "WRONG") wrongCount++;
    else execErrCount++;
    if (r.match_status !== "CORRECT") {
      console.log(`${icon} ${r.case_id} · ${r.defect_class} · expected=${r.expected_verdict} · actual=${r.actual_verdict}${r.execution_error ? " · err=" + r.execution_error.slice(0, 80) : ""}`);
    }
  }

  // ─── Per-class metrics ───────────────────────────────────────

  console.log(`\n─── Per-class metrics ───\n`);
  for (const cls of run.per_class) {
    const isControl = cls.defect_class.startsWith("control.");
    const icon = isControl ? "  " : (cls.catch_rate >= 0.80 ? "🟢" : "🔴");
    console.log(`${icon} ${cls.defect_class.padEnd(50)} · n=${cls.total} · catch=${(cls.catch_rate * 100).toFixed(0)}% · wrong=${cls.wrong} · err=${cls.execution_error}`);
  }

  // ─── Overall metrics ─────────────────────────────────────────

  console.log(`\n─── Overall metrics ───`);
  console.log(`  total cases         : ${run.overall.total_cases}`);
  console.log(`  correct             : ${run.overall.correct}`);
  console.log(`  wrong               : ${run.overall.wrong}`);
  console.log(`  execution errors    : ${run.overall.execution_error}`);
  console.log(`  overall accuracy    : ${(run.overall.overall_accuracy * 100).toFixed(1)}%`);
  console.log(`  defective catch-rate: ${(run.overall.defective_catch_rate * 100).toFixed(1)}% (${run.overall.defective_correct}/${run.overall.defective_total})`);
  console.log(`  false-positive rate : ${(run.overall.false_positive_rate * 100).toFixed(1)}% (${run.overall.correct_total - run.overall.correct_correctly_accepted}/${run.overall.correct_total})`);
  console.log(`  uncertainty accuracy: ${(run.overall.uncertain_accuracy * 100).toFixed(1)}% (${run.overall.uncertain_correct}/${run.overall.uncertain_total})`);
  console.log(`  tests-pass-wrong    : ${(run.overall.tests_pass_but_code_wrong_catch_rate * 100).toFixed(1)}% (${run.overall.tests_pass_but_code_wrong_correct}/${run.overall.tests_pass_but_code_wrong_total})`);

  // ─── Threshold checks ────────────────────────────────────────

  console.log(`\n─── Threshold checks ───\n`);
  const checks = checkThresholds(run.overall, run.per_class);
  for (const c of checks) {
    const icon = c.passed ? "🟢" : (c.criterion.endsWith(":sample_size") ? "🟡" : "🔴");
    console.log(`${icon} ${c.criterion.padEnd(60)} · measured=${c.measured.toFixed(3)} · threshold=${c.threshold} · ${c.detail}`);
  }

  const verdict = deriveEvaluationVerdict(checks);
  console.log(`\n═══ EVALUATION VERDICT: ${verdict.verdict === "GREEN" ? "🟢" : verdict.verdict === "YELLOW" ? "🟡" : "🔴"} ${verdict.verdict} ═══`);
  for (const r of verdict.reasons) console.log(`  · ${r}`);

  // ─── Persist evidence ────────────────────────────────────────

  const outSummary = {
    ran_at: new Date().toISOString(),
    corpus: {
      version: corpus.version,
      frozen_at: corpus.frozen_at,
      case_count: corpus.case_count,
      defect_classes_covered: corpus.defect_classes_covered,
      snapshot: snap,
      hardcoding_leaks: leaks,
    },
    run,
    threshold_checks: checks,
    aggregate_verdict: verdict,
  };
  const outPath = path.join(here, "_phase_d_run.json");
  writeFileSync(outPath, JSON.stringify(outSummary, null, 2) + "\n", "utf8");
  console.log(`\n→ ${outPath}`);

  if (verdict.verdict === "RED") {
    console.error(`\n🔴 Phase D FAILED · thresholds not met`);
    process.exit(1);
  } else {
    console.log(`\n🟢 correct=${correctCount} · wrong=${wrongCount} · exec_err=${execErrCount}`);
    process.exit(0);
  }
}
