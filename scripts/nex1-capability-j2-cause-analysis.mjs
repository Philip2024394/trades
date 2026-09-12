#!/usr/bin/env node
// scripts/nex1-capability-j2-cause-analysis.mjs
//
// NEX1 · CAPABILITY J.2 · CAUSE ANALYSIS + REPAIR PROPOSAL · eight-test suite.
//
// Real-failure block (4 tests · run vitest, extract via J.1, diagnose via J.2):
//   J2.1 · source is wrong (literal producer disagrees with test)   → PROPOSE
//   J2.2 · test is wrong (violates source literal-type contract)     → REFUSE
//   J2.3 · timeout                                                    → REFUSE (out of scope)
//   J2.4 · thrown_error                                               → REFUSE (out of scope)
//
// Adversarial refusal block (4 tests · synthetic findings):
//   J2.5 · missing test_file                                          → REFUSE (no_source_reference)
//   J2.6 · nonexistent test file path                                 → REFUSE (no_source_reference)
//   J2.7 · protected source target                                    → REFUSE (protected_target)
//   J2.8 · unknown test shape (assertion without imported call)       → REFUSE (unknown_test_shape or low_confidence)
//
// J.2 is diagnosis + proposal only. No file mutation.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_J2_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-capability-j2-cause-analysis.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_J2_INNER: "1" } },
  );
  process.exit(r.status ?? 1);
}

const enginePath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/index.ts")).href;
const engine = await import(enginePath);

function runVitestOnFile(testFile, configPath) {
  const vt = spawnSync("npx", ["vitest", "run", `--config=${configPath}`, testFile, "--reporter=default"], {
    stdio: "pipe", shell: true, encoding: "utf8", cwd: REPO_ROOT,
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
  });
  return { exit: vt.status, output: (vt.stdout ?? "") + "\n" + (vt.stderr ?? "") };
}

console.log("NEX1 · CAPABILITY J.2 · CAUSE ANALYSIS + REPAIR PROPOSAL · eight-test suite");
console.log("─".repeat(80));

const evidence = {
  at: new Date().toISOString(),
  attribution: {
    teaching_infrastructure: "capability-j2-cause-analysis.ts · taught_by=master_ai_engineer",
    novel_challenge_execution: "attempted_by=nex1 · teaching_assistance=true",
    fixtures_and_scripts: "authored_by=examiner",
  },
  sub_tests: {},
};

// Track fixture files that must not be mutated
const WATCH_FILES = [
  "data/nex1-code-engine/challenge-j2/source-literal.ts",
  "data/nex1-code-engine/challenge-j2/source-contract.ts",
  "data/nex1-code-engine/challenge-j2-tests/source-wrong.test.ts",
  "data/nex1-code-engine/challenge-j2-tests/test-wrong.test.ts",
];
const preHashes = {};
for (const p of WATCH_FILES) preHashes[p] = createHash("sha256").update(readFileSync(resolve(REPO_ROOT, p), "utf8")).digest("hex");

function assertNoMutation() {
  for (const p of WATCH_FILES) {
    const h = createHash("sha256").update(readFileSync(resolve(REPO_ROOT, p), "utf8")).digest("hex");
    if (h !== preHashes[p]) return { ok: false, path: p };
  }
  return { ok: true };
}

async function runRealFailure({ id, label, testFile, configPath, expectedKind, extraChecks }) {
  console.log(`\n── ${id} · ${label} ──`);
  const { output } = runVitestOnFile(testFile, configPath);
  const extract = engine.extractRuntimeFailures(output);
  const record = { extractor_kind: extract.kind };
  if (extract.kind !== "ok" || extract.findings.length === 0) {
    console.log(`  · J.1 extract kind=${extract.kind} · no findings`);
    record.verdict = "fail";
    console.log(`  → verdict: FAIL`);
    return record;
  }
  const finding = extract.findings[0];
  console.log(`  · J.1 finding · kind=${finding.kind} · expected=${finding.expected} · actual=${finding.actual}`);
  const diag = engine.diagnoseAndPropose(finding, REPO_ROOT);
  record.diagnosis = { kind: diag.kind, diagnosis: diag.diagnosis, confidence: diag.confidence, proposal: diag.proposal, reasoning_trace: diag.reasoning_trace };
  console.log(`  · J.2 kind=${diag.kind} · confidence=${diag.confidence}`);
  console.log(`  · J.2 diagnosis=${diag.diagnosis.slice(0, 120)}`);
  if (diag.proposal) {
    console.log(`  · J.2 proposal · ${diag.proposal.change_kind} · ${diag.proposal.target_file}#${diag.proposal.target_function} · ${diag.proposal.current_literal} → ${diag.proposal.proposed_literal}`);
  }
  const acceptable = Array.isArray(expectedKind) ? expectedKind : [expectedKind];
  const kindOk = acceptable.includes(diag.kind);
  const extraOk = extraChecks ? extraChecks(diag) : true;
  record.verdict = kindOk && extraOk ? "pass" : "fail";
  console.log(`  → verdict: ${record.verdict.toUpperCase()}`);
  return record;
}

function runAdversarial({ id, label, finding, expectedKind }) {
  console.log(`\n── ${id} · ${label} ──`);
  const diag = engine.diagnoseAndPropose(finding, REPO_ROOT);
  const record = { finding_ref: finding, diagnosis: { kind: diag.kind, diagnosis: diag.diagnosis, confidence: diag.confidence, reasoning_trace: diag.reasoning_trace } };
  console.log(`  · J.2 kind=${diag.kind} · confidence=${diag.confidence}`);
  console.log(`  · J.2 diagnosis=${diag.diagnosis.slice(0, 120)}`);
  const acceptable = Array.isArray(expectedKind) ? expectedKind : [expectedKind];
  record.verdict = acceptable.includes(diag.kind) && diag.proposal === null ? "pass" : "fail";
  console.log(`  → verdict: ${record.verdict.toUpperCase()}`);
  return record;
}

// ─── Real failure cases ───────────────────────────────────────────────
evidence.sub_tests["J2.1"] = await runRealFailure({
  id: "J2.1",
  label: "source is wrong (literal producer disagrees with test) → PROPOSE",
  testFile: "data/nex1-code-engine/challenge-j2-tests/source-wrong.test.ts",
  configPath: "vitest.config.capability-j2.mts",
  expectedKind: "proposal",
  extraChecks: (d) =>
    d.proposal?.change_kind === "replace_return_literal"
    && d.proposal?.target_file.endsWith("source-literal.ts")
    && d.proposal?.target_function === "getAnswer"
    && d.proposal?.current_literal === "1"
    && d.proposal?.proposed_literal === "2",
});

evidence.sub_tests["J2.2"] = await runRealFailure({
  id: "J2.2",
  label: "test is wrong (contract violation) → REFUSE",
  testFile: "data/nex1-code-engine/challenge-j2-tests/test-wrong.test.ts",
  configPath: "vitest.config.capability-j2.mts",
  expectedKind: ["refused_test_may_be_wrong", "refused_low_confidence", "refused_unknown_test_shape"],
  extraChecks: (d) => d.proposal === null,
});

evidence.sub_tests["J2.3"] = await runRealFailure({
  id: "J2.3",
  label: "timeout → REFUSE (unrepairable_class)",
  testFile: "data/nex1-code-engine/challenge-j-tests/timeout-fail.ts",
  configPath: "vitest.config.capability-j.mts",
  expectedKind: "refused_unrepairable_class",
});

evidence.sub_tests["J2.4"] = await runRealFailure({
  id: "J2.4",
  label: "thrown_error → REFUSE (unrepairable_class)",
  testFile: "data/nex1-code-engine/challenge-j-tests/throw-fail.ts",
  configPath: "vitest.config.capability-j.mts",
  expectedKind: "refused_unrepairable_class",
});

// ─── Adversarial refusal cases ────────────────────────────────────────
evidence.sub_tests["J2.5"] = runAdversarial({
  id: "J2.5",
  label: "missing test_file → REFUSE (no_source_reference)",
  finding: {
    kind: "assertion_mismatch",
    test_file: null,
    test_name: null,
    expected: "2",
    actual: "1",
    assertion: "toBe",
    error_class: null,
    error_message: null,
    stack_hint: null,
    timeout_ms: null,
    raw_slice: "",
    taught_by: "master_ai_engineer",
  },
  expectedKind: "refused_no_source_reference",
});

evidence.sub_tests["J2.6"] = runAdversarial({
  id: "J2.6",
  label: "nonexistent test file → REFUSE (no_source_reference)",
  finding: {
    kind: "assertion_mismatch",
    test_file: "data/nex1-code-engine/does-not-exist/ghost.test.ts",
    test_name: "phantom",
    expected: "2",
    actual: "1",
    assertion: "toBe",
    error_class: null,
    error_message: null,
    stack_hint: null,
    timeout_ms: null,
    raw_slice: "",
    taught_by: "master_ai_engineer",
  },
  expectedKind: "refused_no_source_reference",
});

// For J2.7 · construct a synthetic finding whose test file imports a
// protected source. Use the pre-existing __protected-fixture__/ pattern.
const protectedFixtureTest = "data/nex1-code-engine/__protected-fixture__/j2-protected.test.ts";
mkdirSync(resolve(REPO_ROOT, "data/nex1-code-engine/__protected-fixture__"), { recursive: true });
writeFileSync(
  resolve(REPO_ROOT, protectedFixtureTest),
  [
    "// J2.7 fixture · test imports a producer from a protected path.",
    "// J.2 must refuse to propose changes to the protected source.",
    "import { describe, expect, it } from \"vitest\";",
    "import { protectedProducer } from \"./protected-producer\";",
    "describe(\"j2-protected\", () => {",
    "  it(\"expects 99\", () => {",
    "    expect(protectedProducer()).toBe(99);",
    "  });",
    "});",
    "",
  ].join("\n"),
);
const protectedFixtureSource = "data/nex1-code-engine/__protected-fixture__/protected-producer.ts";
writeFileSync(
  resolve(REPO_ROOT, protectedFixtureSource),
  "export function protectedProducer(): number { return 7; }\n",
);
evidence.sub_tests["J2.7"] = runAdversarial({
  id: "J2.7",
  label: "protected source target → REFUSE (protected_target)",
  finding: {
    kind: "assertion_mismatch",
    test_file: protectedFixtureTest,
    test_name: "expects 99",
    expected: "99",
    actual: "7",
    assertion: "toBe",
    error_class: null,
    error_message: null,
    stack_hint: null,
    timeout_ms: null,
    raw_slice: "",
    taught_by: "master_ai_engineer",
  },
  expectedKind: "refused_protected_target",
});

// J2.8 · unknown test shape · test file has no imported-function call in assert
const unknownShapeTest = "data/nex1-code-engine/challenge-j2-tests/unknown-shape.ts";
writeFileSync(
  resolve(REPO_ROOT, unknownShapeTest),
  [
    "// J2.8 · assertion on a locally-computed value with no imported source producer.",
    "import { describe, expect, it } from \"vitest\";",
    "describe(\"j2-unknown\", () => {",
    "  it(\"expects 42\", () => {",
    "    const local = 5 + 3;",
    "    expect(local).toBe(42);",
    "  });",
    "});",
    "",
  ].join("\n"),
);
evidence.sub_tests["J2.8"] = runAdversarial({
  id: "J2.8",
  label: "unknown test shape (no imported producer) → REFUSE",
  finding: {
    kind: "assertion_mismatch",
    test_file: unknownShapeTest,
    test_name: "expects 42",
    expected: "42",
    actual: "8",
    assertion: "toBe",
    error_class: null,
    error_message: null,
    stack_hint: null,
    timeout_ms: null,
    raw_slice: "",
    taught_by: "master_ai_engineer",
  },
  expectedKind: ["refused_unknown_test_shape", "refused_low_confidence"],
});

// ── Verify no mutation across watched fixtures ─────────────────────────
const noMut = assertNoMutation();
if (!noMut.ok) {
  console.log(`\n⚠️  MUTATION DETECTED · ${noMut.path} · J.2 must never mutate production code`);
  for (const key of Object.keys(evidence.sub_tests)) evidence.sub_tests[key].verdict = "fail";
}
evidence.no_mutation = noMut.ok;

const dir = resolve(REPO_ROOT, "data/nex1-code-engine/capability-j2-validation");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidencePath = resolve(dir, `suite-${stamp}.json`);
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf8");
console.log(`\nEvidence: ${evidencePath}`);

console.log("\n══════════ CAPABILITY J.2 VERDICT ══════════");
for (const [k, v] of Object.entries(evidence.sub_tests)) console.log(`  ${k}: ${v.verdict}`);
console.log(`  no_mutation: ${evidence.no_mutation}`);
const allPass = Object.values(evidence.sub_tests).every((t) => t.verdict === "pass") && evidence.no_mutation;
console.log(allPass ? "  RESULT · CAPABILITY J.2 PASS across all eight sub-tests · no mutation." : "  RESULT · at least one sub-test failed · inspect evidence.");
console.log("═".repeat(44));
process.exit(allPass ? 0 : 1);
