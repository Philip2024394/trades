#!/usr/bin/env node
// scripts/nex1-capability-j23-multi-hop.mjs
//
// NEX1 · CAPABILITY J.2.3 · MULTI-HOP CAUSE ANALYSIS · five-test suite.
//
//   J23.1 · 2 bugs · both fixed across 2 hops · all_verified_multi_hop
//   J23.2 · 3 bugs · all fixed across 3 hops · all_verified_multi_hop
//   J23.3 · hop 1 fixes h1 · hop 2 complex-type refusal · refused_mid_chain_j2 · rollback
//   J23.4 · 4 bugs · max_hops=3 · refused_hop_cap_exceeded · rollback
//   J23.5 · hop 1 fixes h1 · hop 2 fixes h2 but breaks t3 (regression) · refused_mid_chain_regression · rollback

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_J23_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-capability-j23-multi-hop.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_J23_INNER: "1" } },
  );
  process.exit(r.status ?? 1);
}

function sha256(t) { return createHash("sha256").update(t).digest("hex"); }
const enginePath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/index.ts")).href;
const engine = await import(enginePath);

const CONFIG = "vitest.config.capability-j23.mts";

console.log("NEX1 · CAPABILITY J.2.3 · MULTI-HOP CAUSE ANALYSIS · five-test suite");
console.log("─".repeat(74));

const evidence = {
  at: new Date().toISOString(),
  attribution: {
    teaching_infrastructure: "capability-j23-multi-hop-recovery.ts · taught_by=master_ai_engineer",
    novel_challenge_execution: "attempted_by=nex1 · teaching_assistance=true",
    fixtures_and_scripts: "authored_by=examiner",
  },
  sub_tests: {},
};

// Watch fixture set for byte-identity across the suite
const WATCH = [
  "data/nex1-code-engine/challenge-j23/source-hops.ts",
  "data/nex1-code-engine/challenge-j23-tests/two-hop.test.ts",
  "data/nex1-code-engine/challenge-j23-tests/three-hop.test.ts",
  "data/nex1-code-engine/challenge-j23-tests/complex-mid-chain.test.ts",
  "data/nex1-code-engine/challenge-j23-tests/cap-exceeded.test.ts",
  "data/nex1-code-engine/challenge-j23-tests/regression-mid-chain.test.ts",
];
const preHashes = Object.fromEntries(WATCH.map((p) => [p, sha256(readFileSync(resolve(REPO_ROOT, p), "utf8"))]));

async function runMultiHop({ id, label, testFile, maxHops = 3, expectedVerdict, extraChecks }) {
  console.log(`\n── ${id} · ${label} ──`);
  const result = await engine.executeMultiHopRecovery(
    { config_file: CONFIG, test_files: [testFile] },
    REPO_ROOT,
    maxHops,
  );
  console.log(`  · verdict = ${result.verdict}`);
  console.log(`  · rollback = ${result.rollback_status}`);
  console.log(`  · hops applied: ${result.hops.length}`);
  for (const h of result.hops) {
    console.log(`    · hop ${h.hop_number}: ${h.test_name} · ${h.diagnosis_kind}${h.applied ? " · APPLIED" : ""} · ${h.result.slice(0, 80)}`);
  }
  console.log(`  · initial_failing_names = [${result.initial_failing_names.join(", ").slice(0, 100)}]`);
  console.log(`  · final_failing_names = [${result.final_failing_names.join(", ").slice(0, 100)}]`);
  if (result.newly_failing_names) console.log(`  · NEWLY failing (regression) = [${result.newly_failing_names.join(", ")}]`);

  const record = { verdict_seen: result.verdict, rollback: result.rollback_status, hop_count: result.hops.length, initial_failing: result.initial_failing_names, final_failing: result.final_failing_names, newly_failing: result.newly_failing_names ?? null };
  const verdictOk = result.verdict === expectedVerdict;
  const extraOk = extraChecks ? extraChecks(result) : true;
  const bytesOk = byteIdenticalCheck();
  record.byte_identical = bytesOk;
  record.verdict_ok = verdictOk;
  record.extra_ok = extraOk;
  const pass = verdictOk && extraOk && bytesOk;
  console.log(`  · byte_identical = ${bytesOk}`);
  console.log(`  → verdict: ${pass ? "PASS" : "FAIL"}`);
  return { verdict: pass ? "pass" : "fail", ...record };
}

function byteIdenticalCheck() {
  for (const p of WATCH) {
    const h = sha256(readFileSync(resolve(REPO_ROOT, p), "utf8"));
    if (h !== preHashes[p]) return false;
  }
  return true;
}

// ─── J23.1 · 2-hop success ────────────────────────────────────────────
evidence.sub_tests["J23.1"] = await runMultiHop({
  id: "J23.1",
  label: "2 bugs · both fixed in 2 hops · all_verified_multi_hop",
  testFile: "data/nex1-code-engine/challenge-j23-tests/two-hop.test.ts",
  expectedVerdict: "all_verified_multi_hop",
  extraChecks: (r) => r.hops.length === 2 && r.hops.every((h) => h.applied),
});

// ─── J23.2 · 3-hop success ────────────────────────────────────────────
evidence.sub_tests["J23.2"] = await runMultiHop({
  id: "J23.2",
  label: "3 bugs · all fixed in 3 hops · all_verified_multi_hop",
  testFile: "data/nex1-code-engine/challenge-j23-tests/three-hop.test.ts",
  expectedVerdict: "all_verified_multi_hop",
  extraChecks: (r) => r.hops.length === 3 && r.hops.every((h) => h.applied),
});

// ─── J23.3 · mid-chain complex refusal ────────────────────────────────
evidence.sub_tests["J23.3"] = await runMultiHop({
  id: "J23.3",
  label: "hop 1 succeeds · hop 2 J.2 refuses (literal contract) · refused_mid_chain_j2",
  testFile: "data/nex1-code-engine/challenge-j23-tests/complex-mid-chain.test.ts",
  expectedVerdict: "refused_mid_chain_j2",
  extraChecks: (r) => r.hops.length >= 1,
});

// ─── J23.4 · hop-cap exceeded ─────────────────────────────────────────
evidence.sub_tests["J23.4"] = await runMultiHop({
  id: "J23.4",
  label: "4 bugs · max_hops=3 · refused_hop_cap_exceeded",
  testFile: "data/nex1-code-engine/challenge-j23-tests/cap-exceeded.test.ts",
  maxHops: 3,
  expectedVerdict: "refused_hop_cap_exceeded",
  extraChecks: (r) => r.hops.length === 3 && r.hops.every((h) => h.applied),
});

// ─── J23.5 · mid-chain regression ─────────────────────────────────────
evidence.sub_tests["J23.5"] = await runMultiHop({
  id: "J23.5",
  label: "hop 1 fixes · hop 2 fix breaks t3 · refused_mid_chain_regression",
  testFile: "data/nex1-code-engine/challenge-j23-tests/regression-mid-chain.test.ts",
  expectedVerdict: "refused_mid_chain_regression",
  extraChecks: (r) => Array.isArray(r.newly_failing_names) && r.newly_failing_names.length > 0,
});

const dir = resolve(REPO_ROOT, "data/nex1-code-engine/capability-j23-validation");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidencePath = resolve(dir, `suite-${stamp}.json`);
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf8");
console.log(`\nEvidence: ${evidencePath}`);

console.log("\n══════════ CAPABILITY J.2.3 VERDICT ══════════");
for (const [k, v] of Object.entries(evidence.sub_tests)) console.log(`  ${k}: ${v.verdict}`);
const allPass = Object.values(evidence.sub_tests).every((t) => t.verdict === "pass");
console.log(allPass ? "  RESULT · CAPABILITY J.2.3 PASS · multi-hop chain safe." : "  RESULT · at least one sub-test failed · inspect evidence.");
console.log("═".repeat(46));
process.exit(allPass ? 0 : 1);
