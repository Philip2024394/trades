#!/usr/bin/env node
// scripts/nex1-capability-j3-verify-repair.mjs
//
// NEX1 · CAPABILITY J.3 · APPLY · RERUN · PROVE · five-test suite.
//
// J3.1 · verified_repair · end-to-end fix
//        J.1 → J.2 → J.3 · source-wrong fixture · vitest goes 0→1 passing
//
// J3.2 · rejected_still_failing · proposal literal does not fix the assertion
//        Synthetic proposal with wrong proposed_literal
//
// J3.3 · rejected_regression · fix one test → break another (critical adversarial)
//        Two-test fixture where fixing test 1 breaks test 2 · J.3 must roll back
//
// J3.4 · rejected_no_proposal · pass a REFUSED diagnosis to J.3
//        Chain-of-custody test · J.3 must decline to execute
//
// J3.5 · rejected_compile_error · proposed_literal that produces invalid TS
//        Synthetic proposal with garbage literal · rerun fails to compile

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_J3_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-capability-j3-verify-repair.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_J3_INNER: "1" } },
  );
  process.exit(r.status ?? 1);
}

function sha256(t) { return createHash("sha256").update(t).digest("hex"); }
function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: "pipe", shell: true, encoding: "utf8", cwd: REPO_ROOT, ...opts });
}

const enginePath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/index.ts")).href;
const engine = await import(enginePath);

console.log("NEX1 · CAPABILITY J.3 · APPLY · RERUN · PROVE · five-test suite");
console.log("─".repeat(72));

const evidence = {
  at: new Date().toISOString(),
  attribution: {
    teaching_infrastructure: "capability-j3-verify-repair.ts · taught_by=master_ai_engineer",
    novel_challenge_execution: "attempted_by=nex1 · teaching_assistance=true",
    fixtures_and_scripts: "authored_by=examiner",
  },
  sub_tests: {},
};

// Track fixtures for byte-identity across the whole suite
const WATCH_FIXTURES = [
  "data/nex1-code-engine/challenge-j2/source-literal.ts",
  "data/nex1-code-engine/challenge-j2-tests/source-wrong.test.ts",
  "data/nex1-code-engine/challenge-j3/shared-value.ts",
  "data/nex1-code-engine/challenge-j3-tests/regression-pair.test.ts",
];
const preHashes = Object.fromEntries(
  WATCH_FIXTURES.map((p) => [p, sha256(readFileSync(resolve(REPO_ROOT, p), "utf8"))]),
);

function runVitestForFirstRunCapture(testFile, configPath) {
  const vt = run("npx", ["vitest", "run", `--config=${configPath}`, testFile, "--reporter=default"], {
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
  });
  return { exit: vt.status, output: (vt.stdout ?? "") + "\n" + (vt.stderr ?? "") };
}

// ─── J3.1 · end-to-end verified_repair ────────────────────────────────
{
  const label = "J3.1 · end-to-end · J.1 → J.2 → J.3 · verified_repair expected";
  console.log(`\n── ${label} ──`);
  const testFile = "data/nex1-code-engine/challenge-j2-tests/source-wrong.test.ts";
  const configPath = "vitest.config.capability-j2.mts";
  // 1. Run vitest, extract via J.1
  const { output } = runVitestForFirstRunCapture(testFile, configPath);
  const extract = engine.extractRuntimeFailures(output);
  if (extract.kind !== "ok" || extract.findings.length === 0) {
    console.log(`  · SKIP · J.1 did not produce a finding`);
    evidence.sub_tests["J3.1"] = { verdict: "fail", reason: "J.1 did not produce a finding" };
  } else {
    const finding = extract.findings[0];
    const diagnosis = engine.diagnoseAndPropose(finding, REPO_ROOT);
    console.log(`  · J.2 kind=${diagnosis.kind}`);
    if (diagnosis.kind !== "proposal") {
      console.log(`  · SKIP · J.2 did not produce a proposal`);
      evidence.sub_tests["J3.1"] = { verdict: "fail", reason: "J.2 did not produce a proposal" };
    } else {
      const result = engine.executeAndVerifyRepair(
        diagnosis,
        { config_file: configPath, test_files: [testFile] },
        REPO_ROOT,
      );
      console.log(`  · J.3 verdict=${result.verdict}`);
      console.log(`    first_run=${result.first_run?.exit_code}/${result.first_run?.passed}p/${result.first_run?.failed}f · second_run=${result.second_run?.exit_code}/${result.second_run?.passed}p/${result.second_run?.failed}f`);
      console.log(`    rollback=${result.rollback_status} · elapsed=${result.elapsed_ms}ms`);
      const rec = { verdict: result.verdict === "verified_repair" ? "pass" : "fail", result };
      evidence.sub_tests["J3.1"] = rec;
      console.log(`  → verdict: ${rec.verdict.toUpperCase()}`);
    }
  }
}

// ─── J3.2 · rejected_still_failing ────────────────────────────────────
{
  const label = "J3.2 · synthetic proposal with wrong literal · rejected_still_failing expected";
  console.log(`\n── ${label} ──`);
  const diagnosis = {
    kind: "proposal",
    proposal: {
      change_kind: "replace_return_literal",
      target_file: "data/nex1-code-engine/challenge-j2/source-literal.ts",
      target_function: "getAnswer",
      current_literal: "1",
      proposed_literal: "3", // wrong! test expects 2
      rationale: "synthetic · wrong on purpose",
    },
    finding_ref: null,
    diagnosis: "synthetic",
    confidence: 0.5,
    reasoning_trace: [],
    taught_by: "master_ai_engineer",
  };
  const result = engine.executeAndVerifyRepair(
    diagnosis,
    { config_file: "vitest.config.capability-j2.mts", test_files: ["data/nex1-code-engine/challenge-j2-tests/source-wrong.test.ts"] },
    REPO_ROOT,
  );
  console.log(`  · J.3 verdict=${result.verdict} · rollback=${result.rollback_status}`);
  const rec = { verdict: result.verdict === "rejected_still_failing" ? "pass" : "fail", result };
  evidence.sub_tests["J3.2"] = rec;
  console.log(`  → verdict: ${rec.verdict.toUpperCase()}`);
}

// ─── J3.3 · rejected_regression ───────────────────────────────────────
{
  const label = "J3.3 · CRITICAL adversarial · fix one test, break another → rejected_regression";
  console.log(`\n── ${label} ──`);
  const diagnosis = {
    kind: "proposal",
    proposal: {
      change_kind: "replace_return_literal",
      target_file: "data/nex1-code-engine/challenge-j3/shared-value.ts",
      target_function: "getVal",
      current_literal: "1",
      proposed_literal: "2",
      rationale: "synthetic proposal aimed at test 1 · will break test 2",
    },
    finding_ref: null,
    diagnosis: "synthetic · regression harness",
    confidence: 0.85,
    reasoning_trace: [],
    taught_by: "master_ai_engineer",
  };
  const result = engine.executeAndVerifyRepair(
    diagnosis,
    { config_file: "vitest.config.capability-j3.mts", test_files: ["data/nex1-code-engine/challenge-j3-tests/regression-pair.test.ts"] },
    REPO_ROOT,
  );
  console.log(`  · J.3 verdict=${result.verdict} · rollback=${result.rollback_status}`);
  console.log(`    first_run=${result.first_run?.passed}p/${result.first_run?.failed}f · second_run=${result.second_run?.passed}p/${result.second_run?.failed}f`);
  const rec = { verdict: result.verdict === "rejected_regression" ? "pass" : "fail", result };
  evidence.sub_tests["J3.3"] = rec;
  console.log(`  → verdict: ${rec.verdict.toUpperCase()}`);
}

// ─── J3.4 · rejected_no_proposal ──────────────────────────────────────
{
  const label = "J3.4 · chain-of-custody · REFUSED diagnosis passed to J.3 → rejected_no_proposal";
  console.log(`\n── ${label} ──`);
  const refusedDiagnosis = {
    kind: "refused_test_may_be_wrong",
    proposal: null,
    finding_ref: null,
    diagnosis: "synthetic refused diagnosis",
    confidence: 0.9,
    reasoning_trace: [],
    taught_by: "master_ai_engineer",
  };
  const result = engine.executeAndVerifyRepair(
    refusedDiagnosis,
    { config_file: "vitest.config.capability-j2.mts", test_files: ["data/nex1-code-engine/challenge-j2-tests/source-wrong.test.ts"] },
    REPO_ROOT,
  );
  console.log(`  · J.3 verdict=${result.verdict}`);
  const rec = { verdict: result.verdict === "rejected_no_proposal" ? "pass" : "fail", result };
  evidence.sub_tests["J3.4"] = rec;
  console.log(`  → verdict: ${rec.verdict.toUpperCase()}`);
}

// ─── J3.5 · rejected_compile_error ────────────────────────────────────
{
  const label = "J3.5 · proposal with invalid literal · rejected_compile_error or still_failing";
  console.log(`\n── ${label} ──`);
  const diagnosis = {
    kind: "proposal",
    proposal: {
      change_kind: "replace_return_literal",
      target_file: "data/nex1-code-engine/challenge-j2/source-literal.ts",
      target_function: "getAnswer",
      current_literal: "1",
      proposed_literal: "@@garbage@@", // syntactically invalid
      rationale: "synthetic · garbage",
    },
    finding_ref: null,
    diagnosis: "synthetic · garbage proposal",
    confidence: 0.5,
    reasoning_trace: [],
    taught_by: "master_ai_engineer",
  };
  const result = engine.executeAndVerifyRepair(
    diagnosis,
    { config_file: "vitest.config.capability-j2.mts", test_files: ["data/nex1-code-engine/challenge-j2-tests/source-wrong.test.ts"] },
    REPO_ROOT,
  );
  console.log(`  · J.3 verdict=${result.verdict} · rollback=${result.rollback_status}`);
  // Accept either rejected_compile_error OR rejected_still_failing · both are honest refusals
  const rec = {
    verdict: (result.verdict === "rejected_compile_error" || result.verdict === "rejected_still_failing") ? "pass" : "fail",
    result,
  };
  evidence.sub_tests["J3.5"] = rec;
  console.log(`  → verdict: ${rec.verdict.toUpperCase()}`);
}

// ── Byte-identity check across all watched fixtures ──────────────────
let byteIdentical = true;
for (const p of WATCH_FIXTURES) {
  const h = sha256(readFileSync(resolve(REPO_ROOT, p), "utf8"));
  if (h !== preHashes[p]) {
    byteIdentical = false;
    console.log(`  ⚠️  MUTATION LEFT: ${p} · rollback failed on some test`);
  }
}
evidence.all_fixtures_byte_identical = byteIdentical;

const dir = resolve(REPO_ROOT, "data/nex1-code-engine/capability-j3-validation");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidencePath = resolve(dir, `suite-${stamp}.json`);
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf8");
console.log(`\nEvidence: ${evidencePath}`);

console.log("\n══════════ CAPABILITY J.3 VERDICT ══════════");
for (const [k, v] of Object.entries(evidence.sub_tests)) console.log(`  ${k}: ${v.verdict}`);
console.log(`  all_fixtures_byte_identical: ${byteIdentical}`);
const allPass = Object.values(evidence.sub_tests).every((t) => t.verdict === "pass") && byteIdentical;
console.log(allPass ? "  RESULT · CAPABILITY J.3 PASS across all five sub-tests · loop closed." : "  RESULT · at least one sub-test failed · inspect evidence.");
console.log("═".repeat(44));
process.exit(allPass ? 0 : 1);
