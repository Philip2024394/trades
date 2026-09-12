#!/usr/bin/env node
// scripts/nex1-capability-j22-broader-shapes.mjs
//
// NEX1 · CAPABILITY J.2.2 · BROADER CAUSE-ANALYSIS SHAPES · six-test suite.
//
// New assertion shapes (5) · plus one end-to-end J.3 verification (1):
//   J22.1 · imported call + safe `as` cast · same primitive → PROPOSE
//   J22.2 · imported call + widening cast that bypasses literal contract → REFUSE (test_may_be_wrong)
//   J22.3 · imported CONSTANT · source literal disagrees → PROPOSE
//   J22.4 · chained call · ambiguous cause → REFUSE (low_confidence)
//   J22.5 · locally-computed value · no imported producer → REFUSE (unknown_test_shape)
//   J22.6 · end-to-end · J22.1 proposal fed through J.3 · VERIFIED_REPAIR
//
// J.2.2 strictly extends J.2's cause-analysis surface. Mutation authority
// remains with J.3.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_J22_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-capability-j22-broader-shapes.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_J22_INNER: "1" } },
  );
  process.exit(r.status ?? 1);
}

function sha256(t) { return createHash("sha256").update(t).digest("hex"); }
function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: "pipe", shell: true, encoding: "utf8", cwd: REPO_ROOT, ...opts });
}

const enginePath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/index.ts")).href;
const engine = await import(enginePath);

const CONFIG = "vitest.config.capability-j22.mts";

console.log("NEX1 · CAPABILITY J.2.2 · BROADER SHAPES · six-test suite");
console.log("─".repeat(72));

const evidence = {
  at: new Date().toISOString(),
  attribution: {
    teaching_infrastructure: "capability-j2-cause-analysis.ts EXTENDED · taught_by=master_ai_engineer",
    novel_challenge_execution: "attempted_by=nex1 · teaching_assistance=true",
    fixtures_and_scripts: "authored_by=examiner",
  },
  sub_tests: {},
};

// Watch every fixture · assert byte-identical at end
const WATCH = [
  "data/nex1-code-engine/challenge-j2/source-literal.ts",
  "data/nex1-code-engine/challenge-j2/source-contract.ts",
  "data/nex1-code-engine/challenge-j22/source-constant.ts",
  "data/nex1-code-engine/challenge-j22/source-chained.ts",
  "data/nex1-code-engine/challenge-j22-tests/cast-safe.test.ts",
  "data/nex1-code-engine/challenge-j22-tests/cast-contract-break.test.ts",
  "data/nex1-code-engine/challenge-j22-tests/imported-constant.test.ts",
  "data/nex1-code-engine/challenge-j22-tests/chained-call.test.ts",
  "data/nex1-code-engine/challenge-j22-tests/local-computed.test.ts",
];
const preHashes = Object.fromEntries(WATCH.map((p) => [p, sha256(readFileSync(resolve(REPO_ROOT, p), "utf8"))]));

function runVitestOnFile(testFile) {
  const vt = run("npx", ["vitest", "run", `--config=${CONFIG}`, testFile, "--reporter=default"], {
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
  });
  return { exit: vt.status, output: (vt.stdout ?? "") + "\n" + (vt.stderr ?? "") };
}

async function runShape({ id, label, testFile, expectedKind, extraChecks }) {
  console.log(`\n── ${id} · ${label} ──`);
  const { output } = runVitestOnFile(testFile);
  const extract = engine.extractRuntimeFailures(output);
  const record = { extractor_kind: extract.kind };
  if (extract.kind !== "ok" || extract.findings.length === 0) {
    console.log(`  · J.1 kind=${extract.kind} · no findings`);
    record.verdict = "fail";
    console.log(`  → verdict: FAIL`);
    return record;
  }
  const finding = extract.findings[0];
  console.log(`  · J.1 finding · kind=${finding.kind} · expected=${finding.expected} · actual=${finding.actual}`);
  const diag = engine.diagnoseAndPropose(finding, REPO_ROOT);
  record.diagnosis = { kind: diag.kind, diagnosis: diag.diagnosis, confidence: diag.confidence, proposal: diag.proposal };
  console.log(`  · J.2 kind=${diag.kind} · confidence=${diag.confidence}`);
  console.log(`  · J.2 diagnosis=${diag.diagnosis.slice(0, 120)}`);
  if (diag.proposal) console.log(`  · proposal · ${diag.proposal.change_kind} · ${diag.proposal.target_function} · ${diag.proposal.current_literal} → ${diag.proposal.proposed_literal}`);
  const acceptable = Array.isArray(expectedKind) ? expectedKind : [expectedKind];
  const kindOk = acceptable.includes(diag.kind);
  const extraOk = extraChecks ? extraChecks(diag) : true;
  record.verdict = kindOk && extraOk ? "pass" : "fail";
  console.log(`  → verdict: ${record.verdict.toUpperCase()}`);
  return record;
}

evidence.sub_tests["J22.1"] = await runShape({
  id: "J22.1",
  label: "imported call + safe `as number` cast · disagreement at primitive → PROPOSE",
  testFile: "data/nex1-code-engine/challenge-j22-tests/cast-safe.test.ts",
  expectedKind: "proposal",
  extraChecks: (d) =>
    d.proposal?.change_kind === "replace_return_literal"
    && d.proposal?.target_function === "getAnswer"
    && d.proposal?.current_literal === "1"
    && d.proposal?.proposed_literal === "2",
});

evidence.sub_tests["J22.2"] = await runShape({
  id: "J22.2",
  label: "widening cast bypasses literal contract → REFUSE (test_may_be_wrong)",
  testFile: "data/nex1-code-engine/challenge-j22-tests/cast-contract-break.test.ts",
  expectedKind: ["refused_test_may_be_wrong"],
  extraChecks: (d) => d.proposal === null,
});

evidence.sub_tests["J22.3"] = await runShape({
  id: "J22.3",
  label: "imported constant · disagreement at primitive → PROPOSE",
  testFile: "data/nex1-code-engine/challenge-j22-tests/imported-constant.test.ts",
  expectedKind: "proposal",
  extraChecks: (d) =>
    d.proposal?.change_kind === "replace_return_literal"
    && d.proposal?.target_function === "ANSWER"
    && d.proposal?.current_literal === "40"
    && d.proposal?.proposed_literal === "42",
});

evidence.sub_tests["J22.4"] = await runShape({
  id: "J22.4",
  label: "chained call · ambiguous cause → REFUSE (low_confidence)",
  testFile: "data/nex1-code-engine/challenge-j22-tests/chained-call.test.ts",
  expectedKind: ["refused_low_confidence", "refused_unknown_test_shape"],
  extraChecks: (d) => d.proposal === null,
});

evidence.sub_tests["J22.5"] = await runShape({
  id: "J22.5",
  label: "locally-computed value · no imported producer → REFUSE (unknown_test_shape)",
  testFile: "data/nex1-code-engine/challenge-j22-tests/local-computed.test.ts",
  expectedKind: ["refused_unknown_test_shape", "refused_low_confidence"],
  extraChecks: (d) => d.proposal === null,
});

// ─── J22.6 · end-to-end via J.3 gatekeeper ────────────────────────────
{
  const label = "J22.6 · J22.1 proposal executed via J.3 · verified_repair expected";
  console.log(`\n── ${label} ──`);
  const testFile = "data/nex1-code-engine/challenge-j22-tests/cast-safe.test.ts";
  const { output } = runVitestOnFile(testFile);
  const extract = engine.extractRuntimeFailures(output);
  if (extract.kind !== "ok" || extract.findings.length === 0) {
    evidence.sub_tests["J22.6"] = { verdict: "fail", reason: "J.1 did not extract a finding" };
    console.log("  · SKIP · J.1 did not extract a finding");
  } else {
    const finding = extract.findings[0];
    const diagnosis = engine.diagnoseAndPropose(finding, REPO_ROOT);
    if (diagnosis.kind !== "proposal") {
      evidence.sub_tests["J22.6"] = { verdict: "fail", reason: `J.2 did not produce a proposal (${diagnosis.kind})` };
      console.log(`  · SKIP · J.2 kind=${diagnosis.kind}`);
    } else {
      const result = engine.executeAndVerifyRepair(
        diagnosis,
        { config_file: CONFIG, test_files: [testFile] },
        REPO_ROOT,
      );
      console.log(`  · J.3 verdict=${result.verdict} · rollback=${result.rollback_status}`);
      console.log(`    first_run=${result.first_run?.passed}p/${result.first_run?.failed}f · second_run=${result.second_run?.passed}p/${result.second_run?.failed}f`);
      evidence.sub_tests["J22.6"] = {
        verdict: result.verdict === "verified_repair" ? "pass" : "fail",
        result,
      };
      console.log(`  → verdict: ${evidence.sub_tests["J22.6"].verdict.toUpperCase()}`);
    }
  }
}

// Byte-identity check
let byteIdentical = true;
for (const p of WATCH) {
  const h = sha256(readFileSync(resolve(REPO_ROOT, p), "utf8"));
  if (h !== preHashes[p]) { byteIdentical = false; console.log(`  ⚠️  MUTATION LEFT: ${p}`); }
}
evidence.all_fixtures_byte_identical = byteIdentical;

const dir = resolve(REPO_ROOT, "data/nex1-code-engine/capability-j22-validation");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidencePath = resolve(dir, `suite-${stamp}.json`);
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf8");
console.log(`\nEvidence: ${evidencePath}`);

console.log("\n══════════ CAPABILITY J.2.2 VERDICT ══════════");
for (const [k, v] of Object.entries(evidence.sub_tests)) console.log(`  ${k}: ${v.verdict}`);
console.log(`  all_fixtures_byte_identical: ${byteIdentical}`);
const allPass = Object.values(evidence.sub_tests).every((t) => t.verdict === "pass") && byteIdentical;
console.log(allPass ? "  RESULT · CAPABILITY J.2.2 PASS · surface expanded, safety preserved." : "  RESULT · at least one sub-test failed · inspect evidence.");
console.log("═".repeat(46));
process.exit(allPass ? 0 : 1);
