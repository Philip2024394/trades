// NEX Programmer Agent · Phase E · FRESH-PROCESS REPRODUCIBILITY PROOF
// Philip 2026-09-05 · AUTHORIZE §23 §35 (criterion 17)
//
// Spawned as a SEPARATE Node process by the Phase E stability runner.
// Reads the persisted baseline (append-only JSONL history) · re-executes
// the evaluation against the exact same corpus + manifest inputs ·
// compares the fingerprint to the baseline. Determinism proof.

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

process.env.NEX_PROGRAMMER_STABILITY_DIR = path.join(here, "store");

if (!process.env.__PHASE_E_FRESH_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __PHASE_E_FRESH_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  console.log("\n═══ FRESH PROCESS · Phase E reproducibility ═══");
  console.log(`  process.pid=${process.pid}`);
  console.log(`  store=${process.env.NEX_PROGRAMMER_STABILITY_DIR}`);

  const { readStabilityRuns } = await import("../../../src/lib/nex/programmer-stability/history.ts");
  const { captureManifest, computeCaseFingerprint } = await import("../../../src/lib/nex/programmer-stability/version-manifest.ts");
  const { computeDrift } = await import("../../../src/lib/nex/programmer-stability/drift-detector.ts");
  const { freezeCorpus } = await import("../../../src/lib/nex/programmer-benchmark/corpus.ts");
  const { evaluateCorpus } = await import("../../../src/lib/nex/programmer-benchmark/evaluator.ts");
  const { CORPUS_V1_CASES, CORPUS_VERSION } = await import("../programmer-benchmark-proof/_corpus_v1/cases.ts");

  // Read baseline from disk · no in-memory sharing with runner process
  const runs = readStabilityRuns();
  const baseline = runs.find((r) => r.run_id === "stab_baseline");
  if (!baseline) {
    console.error("FAIL · baseline run not found on disk · run _phase_e_stability_runner.mjs first");
    process.exit(1);
  }
  console.log(`  loaded baseline: ${baseline.run_id} (${baseline.timestamp})`);
  console.log(`  baseline fingerprint: ${baseline.case_fingerprint}`);

  // Reproduce evaluation from scratch
  const corpus = freezeCorpus({
    version: CORPUS_VERSION,
    authored_by: "philip · 2026-09-05",
    cases: CORPUS_V1_CASES,
  });
  const manifest = captureManifest({ repoRoot, corpus });
  const ev = evaluateCorpus(corpus, { triggered_by: "runner" });
  const fp = computeCaseFingerprint(ev.results.map((r) => ({
    case_id: r.case_id, match_status: r.match_status,
    actual_verdict: r.actual_verdict, actual_finding_count: r.actual_finding_count,
  })));

  console.log(`\n─── Reproduction attempt ───`);
  console.log(`  fresh fingerprint  : ${fp}`);
  console.log(`  baseline fingerprint: ${baseline.case_fingerprint}`);
  const fpMatch = fp === baseline.case_fingerprint;
  console.log(`  fingerprint match  : ${fpMatch ? "🟢 YES · deterministic" : "🔴 NO · non-determinism suspected"}`);

  // Also verify manifest hashes match
  const manifestMatch =
    manifest.benchmark_hash === baseline.version_manifest.benchmark_hash &&
    manifest.reviewer_hash === baseline.version_manifest.reviewer_hash &&
    manifest.evaluator_hash === baseline.version_manifest.evaluator_hash;
  console.log(`  manifest hashes match: ${manifestMatch ? "🟢 YES" : "🔴 NO"}`);

  // Persist proof summary
  const summary = {
    process_pid: process.pid,
    ran_at: new Date().toISOString(),
    baseline_loaded_from_disk: baseline.run_id,
    baseline_fingerprint: baseline.case_fingerprint,
    fresh_fingerprint: fp,
    fingerprint_match: fpMatch,
    manifest_hashes_match: manifestMatch,
    fresh_manifest: manifest,
    baseline_manifest: baseline.version_manifest,
  };
  writeFileSync(path.join(here, "_phase_e_fresh_reproducibility.json"), JSON.stringify(summary, null, 2) + "\n", "utf8");
  console.log(`\n→ _phase_e_fresh_reproducibility.json`);

  if (!fpMatch || !manifestMatch) {
    console.error(`\n🔴 fresh reproduction FAILED`);
    process.exit(1);
  }
  console.log(`\n🟢 fresh process reproduced identical fingerprint + manifest from disk · no conversational state required`);
  process.exit(0);
}
