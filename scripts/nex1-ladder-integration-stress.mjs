#!/usr/bin/env node
// scripts/nex1-ladder-integration-stress.mjs
//
// NEX1 · FULL LADDER INTEGRATION STRESS TEST · read-only orchestrator.
//
// Runs every capability suite in ladder order. For each suite:
//   · captures fixture SHA before and after
//   · captures exit code and duration
//   · verifies no fixture leak (cross-suite contamination)
//   · verifies no unauthorised mutation escaped
//
// Produces a single evidence file with the aggregate result.
//
// No new engine code. No new capability. This is a stability check on
// the accumulated system.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, extname } from "node:path";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
function sha256(t) { return createHash("sha256").update(t).digest("hex"); }

// ── Discover all fixture .ts files under data/nex1-code-engine/ · exclude
//    validation and evidence JSON files.
function walkFixtures() {
  const root = resolve(REPO_ROOT, "data/nex1-code-engine");
  const out = [];
  const excludeDirs = new Set([
    "capability-c-validation",
    "capability-d-validation",
    "capability-e-validation",
    "capability-f-validation",
    "capability-g-validation",
    "capability-h-validation",
    "capability-h3-validation",
    "capability-i-validation",
    "capability-i2-validation",
    "capability-j-validation",
    "capability-j2-validation",
    "capability-j22-validation",
    "capability-j3-validation",
    "capability-j4-validation",
    "capability-j42-validation",
    "sprint-2-5-consequence",
    "sprint-2-real-repo",
    "sprint-2-worktree",
    "sprint-2-retention",
    "first-task",
    "novel-challenge",
    "novel-e",
    "introspection-probe",
    "teacher-bootstrap",
  ]);
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      const full = join(dir, e);
      let st; try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        // Skip validation dirs entirely
        if (excludeDirs.has(e)) continue;
        walk(full);
      } else if (st.isFile() && [".ts", ".tsx"].includes(extname(full))) {
        out.push(full);
      }
    }
  };
  walk(root);
  return out;
}

// Also track the engine source files we've been teacher-modifying
function walkEngineFiles() {
  const root = resolve(REPO_ROOT, "src/lib/nex-agent/code-engine");
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      const full = join(dir, e);
      let st; try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) walk(full);
      else if (st.isFile() && [".ts"].includes(extname(full))) out.push(full);
    }
  };
  walk(root);
  return out;
}

console.log("NEX1 · FULL LADDER INTEGRATION STRESS TEST");
console.log("─".repeat(72));

const fixtureFiles = walkFixtures();
const engineFiles = walkEngineFiles();
console.log(`Fixture files under data/nex1-code-engine/: ${fixtureFiles.length}`);
console.log(`Engine files under src/lib/nex-agent/code-engine/: ${engineFiles.length}`);

// Baseline hashes across every relevant file
const baseline = {};
for (const p of [...fixtureFiles, ...engineFiles]) {
  baseline[p.replace(/\\/g, "/")] = sha256(readFileSync(p, "utf8"));
}
console.log(`Baseline SHAs captured: ${Object.keys(baseline).length}`);

const SUITES = [
  { id: "A · novel-challenge · Capability A generalisation",       script: "scripts/nex1-novel-challenge-capability-a.mjs" },
  { id: "C · adversarial validation",                              script: "scripts/nex1-novel-challenges-capability-c.mjs" },
  { id: "D · multi-challenge validation",                          script: "scripts/nex1-novel-challenges-capability-d.mjs" },
  { id: "E · multi-file ripple",                                   script: "scripts/nex1-novel-challenges-capability-e.mjs" },
  { id: "E · novel-e generalisation",                              script: "scripts/nex1-novel-e-generalisation.mjs" },
  { id: "F · autonomous discovery suite",                          script: "scripts/nex1-capability-f-suite.mjs" },
  { id: "G · multi-hop heritage suite",                            script: "scripts/nex1-capability-g-multihop.mjs" },
  { id: "H.1 · structured-goal planning",                          script: "scripts/nex1-capability-h-planning.mjs" },
  { id: "H.3 · multi-goal planning",                               script: "scripts/nex1-capability-h3-multigoal.mjs" },
  { id: "I.1 · test synthesis / positive proof",                   script: "scripts/nex1-capability-i-test-synthesis.mjs" },
  { id: "I.2 · negative type-system proof",                        script: "scripts/nex1-capability-i2-negative-proof.mjs" },
  { id: "J.1 · runtime failure extraction",                        script: "scripts/nex1-capability-j-runtime-diagnosis.mjs" },
  { id: "J.2 · cause analysis + proposal",                         script: "scripts/nex1-capability-j2-cause-analysis.mjs" },
  { id: "J.2.2 · broader assertion shapes",                        script: "scripts/nex1-capability-j22-broader-shapes.mjs" },
  { id: "J.2.3 · multi-hop cause analysis",                        script: "scripts/nex1-capability-j23-multi-hop.mjs" },
  { id: "J.3 · apply · rerun · prove",                             script: "scripts/nex1-capability-j3-verify-repair.mjs" },
  { id: "J.4.1 · long-run pilot",                                  script: "scripts/nex1-capability-j4-long-run.mjs" },
  { id: "J.4.2 · long-run with in-loop recovery",                  script: "scripts/nex1-capability-j42-recovery.mjs" },
];

const perSuite = [];
const start = Date.now();

for (let idx = 0; idx < SUITES.length; idx++) {
  const s = SUITES[idx];
  console.log(`\n[${idx + 1}/${SUITES.length}] ${s.id}`);
  const t0 = Date.now();
  const res = spawnSync("node", [s.script], {
    stdio: "pipe", encoding: "utf8", shell: true, cwd: REPO_ROOT,
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" },
  });
  const elapsed = Date.now() - t0;
  const exitCode = res.status ?? 1;
  const stdout = res.stdout ?? "";
  const stderr = res.stderr ?? "";
  const lastVerdictLine = (stdout.match(/RESULT[^\n]*/g) ?? []).slice(-1)[0] ?? "(no RESULT line)";
  // Broadened match: any of PASS / GENERALISES / HOLDS / LOOP CLOSED /
  // PROVEN / DEMONSTRATED / CHAIN SAFE means the suite reported success.
  const passLike =
    /PASS|GENERALISES|HOLDS|LOOP CLOSED|PROVEN|DEMONSTRATED|CHAIN SAFE|SAFETY PRESERVED/i.test(lastVerdictLine)
    && !/at least one sub-test failed|NOT CLEAN|DID NOT GENERALISE|NOT DEMONSTRATED/i.test(lastVerdictLine);

  // Byte-identity check across all relevant files
  const drifted = [];
  for (const p of [...fixtureFiles, ...engineFiles]) {
    const key = p.replace(/\\/g, "/");
    const current = sha256(readFileSync(p, "utf8"));
    if (current !== baseline[key]) drifted.push({ path: key, before: baseline[key], after: current });
  }

  const record = {
    idx: idx + 1,
    id: s.id,
    script: s.script,
    exit_code: exitCode,
    elapsed_ms: elapsed,
    verdict_line: lastVerdictLine,
    pass_like: passLike,
    drift_count: drifted.length,
    drift_paths: drifted.map((d) => d.path).slice(0, 20),
    stdout_tail: stdout.split(/\r?\n/).slice(-8).join("\n"),
    stderr_tail: stderr.split(/\r?\n/).slice(-4).join("\n"),
  };
  perSuite.push(record);

  const mark = passLike && drifted.length === 0 && exitCode === 0 ? "✅" : "❌";
  console.log(`  ${mark} exit=${exitCode} · ${elapsed}ms · ${lastVerdictLine.slice(0, 100)}`);
  if (drifted.length > 0) {
    console.log(`  ⚠️  drift detected on ${drifted.length} file(s):`);
    for (const d of drifted.slice(0, 5)) console.log(`     ${d.path} · ${d.before.slice(0, 8)} → ${d.after.slice(0, 8)}`);
  }
}

const totalElapsed = Date.now() - start;

const dir = resolve(REPO_ROOT, "data/nex1-code-engine/ladder-integration");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidencePath = resolve(dir, `integration-${stamp}.json`);
writeFileSync(evidencePath, JSON.stringify({
  at: new Date().toISOString(),
  total_elapsed_ms: totalElapsed,
  fixture_file_count: fixtureFiles.length,
  engine_file_count: engineFiles.length,
  per_suite: perSuite,
}, null, 2), "utf8");

const passed = perSuite.filter((s) => s.pass_like && s.drift_count === 0 && s.exit_code === 0);
const failed = perSuite.filter((s) => !(s.pass_like && s.drift_count === 0 && s.exit_code === 0));

console.log("\n══════════ LADDER INTEGRATION VERDICT ══════════");
console.log(`  suites passed:                    ${passed.length} / ${SUITES.length}`);
console.log(`  suites failed / drifted / errored: ${failed.length}`);
console.log(`  total elapsed:                    ${(totalElapsed / 1000).toFixed(1)}s`);
if (failed.length > 0) {
  console.log("\n  Failed / drifted suites:");
  for (const f of failed) {
    console.log(`    - ${f.id}: exit=${f.exit_code} · drift=${f.drift_count} · verdict='${f.verdict_line.slice(0, 60)}'`);
  }
}
console.log(`\nEvidence: ${evidencePath}`);
console.log("═".repeat(50));
process.exit(failed.length === 0 ? 0 : 1);
