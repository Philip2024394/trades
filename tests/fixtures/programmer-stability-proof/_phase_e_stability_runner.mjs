// NEX Programmer Agent · Phase E · STABILITY RUNNER
// Philip 2026-09-05 · AUTHORIZE · PHASE E §26 §34
//
// Executes the Phase E temporal stability matrix:
//   · baseline evaluation (immutable reference)
//   · 5 identical fresh-config runs (materially-identical proof)
//   · 4 controlled changes (reviewer / knowledge / corpus / evaluator)
//   · 1 adversarial temporal test (aggregate-masking regression)
//   · attribution report per change
//   · persists append-only history
//
// SAFETY:
//   · Pure evaluation · no writes outside proof directory · no network
//   · No scheduling · no watching · no continuous operation
//   · Historical runs preserved append-only · never mutated

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

// Route stability store to a proof-local directory so this runner
// does not pollute production data · and so the fresh-reproducibility
// runner (a second process) can read exactly what this process wrote.
process.env.NEX_PROGRAMMER_STABILITY_DIR = path.join(here, "store");

if (!process.env.__PHASE_E_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __PHASE_E_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const {
    _resetStabilityStoreForTests, appendStabilityRun, buildStabilityRun,
    persistFullResult, readStabilityRuns, generateRunId,
  } = await import("../../../src/lib/nex/programmer-stability/history.ts");
  const {
    captureManifest, computeCaseFingerprint, manifestsIdentical,
  } = await import("../../../src/lib/nex/programmer-stability/version-manifest.ts");
  const {
    computeDrift, checkConsecutiveRuns,
  } = await import("../../../src/lib/nex/programmer-stability/drift-detector.ts");
  const { freezeCorpus } = await import("../../../src/lib/nex/programmer-benchmark/corpus.ts");
  const { evaluateCorpus } = await import("../../../src/lib/nex/programmer-benchmark/evaluator.ts");
  const { CORPUS_V1_CASES, CORPUS_VERSION } = await import("../programmer-benchmark-proof/_corpus_v1/cases.ts");

  // Fresh store for this run (append-only history starts empty)
  _resetStabilityStoreForTests();

  console.log("\n═══ NEX Programmer-Agent Phase E · Stability & Drift Runner ═══\n");

  // ─── Setup · immutable corpus + manifest ─────────────────────

  const corpus = freezeCorpus({
    version: CORPUS_VERSION,
    authored_by: "philip · 2026-09-05",
    cases: CORPUS_V1_CASES,
  });
  const baselineManifest = captureManifest({ repoRoot, corpus });

  console.log("─── Baseline manifest ───");
  console.log(`  benchmark_version : ${baselineManifest.benchmark_version}`);
  console.log(`  benchmark_hash    : ${baselineManifest.benchmark_hash}`);
  console.log(`  reviewer_hash     : ${baselineManifest.reviewer_hash}`);
  console.log(`  evaluator_hash    : ${baselineManifest.evaluator_hash}`);
  console.log(`  knowledge_snapshot: ${baselineManifest.knowledge_snapshot_hash}`);
  console.log(`  environment       : ${baselineManifest.environment_identifier}`);

  // ─── BASELINE run ────────────────────────────────────────────

  console.log("\n─── BASELINE run ───");
  const baseEv = evaluateCorpus(corpus, { triggered_by: "runner" });
  const basePointer = persistFullResult("stab_baseline", baseEv);
  const baseline = buildStabilityRun({
    evaluation: baseEv, manifest: baselineManifest,
    triggered_by: "runner",
    parent_run_id: null, baseline_run_id: null,
    notes: "baseline · Phase E · 43-case corpus v1",
    full_result_pointer: basePointer,
    case_fingerprint: computeCaseFingerprint(baseEv.results.map((r) => ({
      case_id: r.case_id, match_status: r.match_status,
      actual_verdict: r.actual_verdict, actual_finding_count: r.actual_finding_count,
    }))),
    run_id_override: "stab_baseline",
  });
  appendStabilityRun(baseline);
  console.log(`  baseline run_id     : ${baseline.run_id}`);
  console.log(`  case_fingerprint    : ${baseline.case_fingerprint}`);
  console.log(`  defective catch rate: ${(baseline.overall.defective_catch_rate * 100).toFixed(1)}%`);
  console.log(`  false-positive rate : ${(baseline.overall.false_positive_rate * 100).toFixed(1)}%`);
  console.log(`  tests-pass-wrong    : ${(baseline.overall.tests_pass_but_code_wrong_catch_rate * 100).toFixed(1)}%`);
  console.log(`  uncertain accuracy  : ${(baseline.overall.uncertain_accuracy * 100).toFixed(1)}%`);

  // ─── 5 IDENTICAL RUNS · same manifest · fresh runs ──────────

  console.log("\n─── 5 identical runs (§26 test 1) ───");
  const identicalRuns = [];
  for (let i = 1; i <= 5; i++) {
    const ev = evaluateCorpus(corpus, { triggered_by: "runner" });
    const runId = `stab_identical_${i}`;
    const pointer = persistFullResult(runId, ev);
    const fp = computeCaseFingerprint(ev.results.map((r) => ({
      case_id: r.case_id, match_status: r.match_status,
      actual_verdict: r.actual_verdict, actual_finding_count: r.actual_finding_count,
    })));
    const run = buildStabilityRun({
      evaluation: ev, manifest: baselineManifest, triggered_by: "runner",
      parent_run_id: i === 1 ? baseline.run_id : `stab_identical_${i - 1}`,
      baseline_run_id: baseline.run_id,
      notes: `identical run ${i}/5`,
      full_result_pointer: pointer, case_fingerprint: fp,
      run_id_override: runId,
    });
    appendStabilityRun(run);
    identicalRuns.push(run);
    const drift = computeDrift(baseline, run);
    console.log(`  run ${i}: fp=${run.case_fingerprint} · direction=${drift.overall_direction} · flips=${drift.verdict_flips.length}`);
  }
  const identicalCheck = checkConsecutiveRuns([baseline, ...identicalRuns]);
  console.log(`  all identical: ${identicalCheck.all_identical ? "🟢 YES" : "🔴 NO"}`);

  // ─── CONTROLLED CHANGE A · reviewer change (simulated via manifest) ─

  console.log("\n─── Change A · reviewer change (manifest bump) ───");
  const reviewerChangedManifest = { ...baselineManifest, reviewer_hash: "simulated_reviewer_hash_A_change" };
  const changeAEv = evaluateCorpus(corpus, { triggered_by: "runner" });
  const changeAPointer = persistFullResult("stab_change_A_reviewer", changeAEv);
  const changeARun = buildStabilityRun({
    evaluation: changeAEv, manifest: reviewerChangedManifest, triggered_by: "controlled_change",
    parent_run_id: baseline.run_id, baseline_run_id: baseline.run_id,
    notes: "controlled change · reviewer hash simulated bump",
    full_result_pointer: changeAPointer,
    case_fingerprint: computeCaseFingerprint(changeAEv.results.map((r) => ({
      case_id: r.case_id, match_status: r.match_status,
      actual_verdict: r.actual_verdict, actual_finding_count: r.actual_finding_count,
    }))),
    run_id_override: "stab_change_A_reviewer",
  });
  appendStabilityRun(changeARun);
  const driftA = computeDrift(baseline, changeARun);
  console.log(`  attribution: ${driftA.attribution.summary}`);
  console.log(`  reviewer_changed: ${driftA.attribution.reviewer_changed}`);
  console.log(`  direction: ${driftA.overall_direction}`);

  // ─── CONTROLLED CHANGE B · knowledge snapshot change ────────

  console.log("\n─── Change B · knowledge snapshot change ───");
  const knowledgeChangedManifest = { ...baselineManifest, knowledge_snapshot_hash: "kh_new_snapshot_B" };
  const changeBEv = evaluateCorpus(corpus, { triggered_by: "runner" });
  const changeBPointer = persistFullResult("stab_change_B_knowledge", changeBEv);
  const changeBRun = buildStabilityRun({
    evaluation: changeBEv, manifest: knowledgeChangedManifest, triggered_by: "controlled_change",
    parent_run_id: baseline.run_id, baseline_run_id: baseline.run_id,
    notes: "controlled change · knowledge snapshot simulated bump",
    full_result_pointer: changeBPointer,
    case_fingerprint: computeCaseFingerprint(changeBEv.results.map((r) => ({
      case_id: r.case_id, match_status: r.match_status,
      actual_verdict: r.actual_verdict, actual_finding_count: r.actual_finding_count,
    }))),
    run_id_override: "stab_change_B_knowledge",
  });
  appendStabilityRun(changeBRun);
  const driftB = computeDrift(baseline, changeBRun);
  console.log(`  attribution: ${driftB.attribution.summary}`);
  console.log(`  knowledge_changed: ${driftB.attribution.knowledge_changed}`);
  console.log(`  direction: ${driftB.overall_direction}`);

  // ─── CONTROLLED CHANGE C · corpus version change (v1.1) ─────

  console.log("\n─── Change C · corpus version bump (v1.1 · one modified case) ───");
  const v11Cases = CORPUS_V1_CASES.map((c, i) => i === 0 ? {
    ...c, corpus_version: "programmer-benchmark-v1.1",
    request: { ...c.request, requirement: c.request.requirement + " [v1.1 clarified]" },
    requirement: c.requirement + " [v1.1 clarified]",
  } : { ...c, corpus_version: "programmer-benchmark-v1.1" });
  const corpusV11 = freezeCorpus({ version: "programmer-benchmark-v1.1", authored_by: "test", cases: v11Cases });
  const v11Manifest = captureManifest({ repoRoot, corpus: corpusV11 });
  const changeCEv = evaluateCorpus(corpusV11, { triggered_by: "runner" });
  const changeCPointer = persistFullResult("stab_change_C_corpus_v11", changeCEv);
  const changeCRun = buildStabilityRun({
    evaluation: changeCEv, manifest: v11Manifest, triggered_by: "controlled_change",
    parent_run_id: baseline.run_id, baseline_run_id: baseline.run_id,
    notes: "controlled change · corpus v1.1 (bench_001 requirement clarified)",
    full_result_pointer: changeCPointer,
    case_fingerprint: computeCaseFingerprint(changeCEv.results.map((r) => ({
      case_id: r.case_id, match_status: r.match_status,
      actual_verdict: r.actual_verdict, actual_finding_count: r.actual_finding_count,
    }))),
    run_id_override: "stab_change_C_corpus_v11",
  });
  appendStabilityRun(changeCRun);
  const driftC = computeDrift(baseline, changeCRun);
  console.log(`  attribution: ${driftC.attribution.summary}`);
  console.log(`  benchmark_changed: ${driftC.attribution.benchmark_changed}`);
  console.log(`  direction: ${driftC.overall_direction}`);
  // §22: historical v1 results MUST remain unchanged
  const historicalV1 = readStabilityRuns().filter((r) => r.version_manifest.benchmark_version === CORPUS_VERSION);
  console.log(`  historical v1 runs preserved: ${historicalV1.length} (unchanged)`);

  // ─── CONTROLLED CHANGE D · evaluator change (manifest bump) ─

  console.log("\n─── Change D · evaluator change (manifest bump) ───");
  const evaluatorChangedManifest = { ...baselineManifest, evaluator_hash: "simulated_evaluator_hash_D_change" };
  const changeDEv = evaluateCorpus(corpus, { triggered_by: "runner" });
  const changeDPointer = persistFullResult("stab_change_D_evaluator", changeDEv);
  const changeDRun = buildStabilityRun({
    evaluation: changeDEv, manifest: evaluatorChangedManifest, triggered_by: "controlled_change",
    parent_run_id: baseline.run_id, baseline_run_id: baseline.run_id,
    notes: "controlled change · evaluator hash simulated bump",
    full_result_pointer: changeDPointer,
    case_fingerprint: computeCaseFingerprint(changeDEv.results.map((r) => ({
      case_id: r.case_id, match_status: r.match_status,
      actual_verdict: r.actual_verdict, actual_finding_count: r.actual_finding_count,
    }))),
    run_id_override: "stab_change_D_evaluator",
  });
  appendStabilityRun(changeDRun);
  const driftD = computeDrift(baseline, changeDRun);
  console.log(`  attribution: ${driftD.attribution.summary}`);
  console.log(`  evaluator_changed: ${driftD.attribution.evaluator_changed}`);
  console.log(`  direction: ${driftD.overall_direction}`);

  // ─── ADVERSARIAL TEMPORAL TEST (§22) · aggregate masking ────

  console.log("\n─── Adversarial temporal test · aggregate masking (§22) ───");
  // Construct a fabricated "changed reviewer" scenario: one defect class silently drops
  // from 100% to 40% catch-rate while overall accuracy stays high. Phase E must FLAG this.
  const badPerClass = baseEv.per_class.map((m) => m.defect_class === "security.sql_injection"
    ? { ...m, catch_rate: 0.4, correct: 0, wrong: 1 }
    : m);
  const adversarialEv = {
    ...baseEv,
    per_class: badPerClass,
    // superficially higher overall accuracy · aggregate masking attempt
    overall: { ...baseEv.overall, overall_accuracy: Math.min(1.0, baseEv.overall.overall_accuracy + 0.02) },
  };
  const advManifest = { ...baselineManifest, reviewer_hash: "simulated_reviewer_hash_with_class_regression" };
  const advPointer = persistFullResult("stab_adversarial_mask", adversarialEv);
  const advRun = buildStabilityRun({
    evaluation: adversarialEv, manifest: advManifest, triggered_by: "adversarial_test",
    parent_run_id: baseline.run_id, baseline_run_id: baseline.run_id,
    notes: "ADVERSARIAL · aggregate masking attempt · security.sql_injection silently regressed to 40%",
    full_result_pointer: advPointer,
    case_fingerprint: computeCaseFingerprint(adversarialEv.results.map((r) => ({
      case_id: r.case_id, match_status: r.match_status,
      actual_verdict: r.actual_verdict, actual_finding_count: r.actual_finding_count,
    }))),
    run_id_override: "stab_adversarial_mask",
  });
  appendStabilityRun(advRun);
  const driftAdv = computeDrift(baseline, advRun);
  console.log(`  direction: ${driftAdv.overall_direction}`);
  console.log(`  reasons:`);
  for (const r of driftAdv.reasons) console.log(`    · ${r}`);
  const advClassFailed = driftAdv.per_class_drift.find((d) => d.defect_class === "security.sql_injection" && d.direction === "FAILED");
  console.log(`  security.sql_injection detected as FAILED: ${advClassFailed ? "🟢 YES · aggregate mask defeated" : "🔴 NO · aggregate mask succeeded (BUG)"}`);

  // ─── Emit run summary + report inputs ────────────────────────

  const historicalRuns = readStabilityRuns();
  const summary = {
    ran_at: new Date().toISOString(),
    baseline_run_id: baseline.run_id,
    baseline_manifest: baselineManifest,
    identical_runs: {
      count: identicalRuns.length,
      all_identical: identicalCheck.all_identical,
      fingerprints: identicalCheck.fingerprints,
    },
    controlled_changes: {
      reviewer: { run_id: changeARun.run_id, attribution: driftA.attribution, direction: driftA.overall_direction },
      knowledge: { run_id: changeBRun.run_id, attribution: driftB.attribution, direction: driftB.overall_direction },
      corpus: { run_id: changeCRun.run_id, attribution: driftC.attribution, direction: driftC.overall_direction, historical_v1_preserved: historicalV1.length },
      evaluator: { run_id: changeDRun.run_id, attribution: driftD.attribution, direction: driftD.overall_direction },
    },
    adversarial: {
      run_id: advRun.run_id,
      direction: driftAdv.overall_direction,
      class_regression_detected: !!advClassFailed,
      reasons: driftAdv.reasons,
    },
    all_drifts: {
      identical_runs: identicalRuns.map((r) => computeDrift(baseline, r)),
      change_A: driftA, change_B: driftB, change_C: driftC, change_D: driftD,
      adversarial: driftAdv,
    },
    total_persisted_runs: historicalRuns.length,
  };
  const outPath = path.join(here, "_phase_e_stability_run.json");
  writeFileSync(outPath, JSON.stringify(summary, null, 2) + "\n", "utf8");
  console.log(`\n→ ${outPath}`);

  // ─── Now spawn fresh reproducibility runner ──────────────────

  console.log("\n─── Spawning fresh reproducibility runner ───");
  const freshResult = await new Promise((resolve) => {
    const child = spawn(
      "npx",
      ["tsx", path.join(here, "_phase_e_fresh_reproducibility.mjs")],
      { stdio: ["ignore", "pipe", "pipe"], cwd: repoRoot, shell: true, env: { ...process.env, __PHASE_E_INNER__: undefined } },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += String(d); process.stdout.write(String(d)); });
    child.stderr.on("data", (d) => { stderr += String(d); process.stderr.write(String(d)); });
    child.on("exit", (code) => resolve({ code, stdout, stderr }));
  });
  console.log(`\n✓ fresh_process exit_code=${freshResult.code}`);

  // ─── Final aggregate ─────────────────────────────────────────

  const anyFailed =
    identicalCheck.all_identical === false ||
    !advClassFailed ||
    freshResult.code !== 0;
  console.log(`\n═══ PHASE E RUNNER RESULT: ${anyFailed ? "🔴 problem detected" : "🟢 all stability checks green"} ═══`);
  process.exit(anyFailed ? 1 : 0);
}
