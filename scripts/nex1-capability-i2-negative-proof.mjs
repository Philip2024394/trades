#!/usr/bin/env node
// scripts/nex1-capability-i2-negative-proof.mjs
//
// NEX1 · CAPABILITY I.2 · NEGATIVE TYPE-SYSTEM PROOFS · seven-test suite.
//
// Propose cases (5) · synthesise → apply → tsc must report 0 errors on
// the test file → vitest passes:
//   I2.1 · number field       (ageNum)
//   I2.2 · string field       (nameStr)
//   I2.3 · boolean field      (activeBool)
//   I2.4 · array field        (tagsArr : readonly string[])
//   I2.5 · union field        (kindUnion : "widget" | "gadget")
//
// Refuse cases (2) · synthesis must not produce a directive:
//   I2.6 · complex field      (settingsComplex : ShapesSettings)
//   I2.7 · non-existent field (Shapes.doesNotExist)
//   I2.8 · protected target   (SecretConfig.token · under __protected-fixture__/)

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_I2_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-capability-i2-negative-proof.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_I2_INNER: "1" } },
  );
  process.exit(r.status ?? 1);
}

function sha256(t) { return createHash("sha256").update(t).digest("hex"); }
function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: "pipe", shell: true, encoding: "utf8", cwd: REPO_ROOT, ...opts });
}

const enginePath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/index.ts")).href;
const engine = await import(enginePath);

const registry = new engine.Nex1ReasoningRegistry();
registry.register(engine.AstSemanticAdapter);

async function applyDirective(target, directive) {
  const abs = resolve(REPO_ROOT, target);
  const content = readFileSync(abs, "utf8");
  const req = {
    task_id: `i2-${directive.test_name?.slice(0, 20) ?? "test"}`,
    attempt_id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    intent: "add_test",
    context: {
      task_prompt: "capability-i2 negative proof",
      repo_snapshot_hash: sha256(content),
      file_slices: [{ path: target, content, content_hash: sha256(content) }],
      relevant_adrs: [],
      declared_scope: [target],
    },
    output_kind: "diff",
    template_directive: { ...directive, target_path: target },
  };
  const resp = await engine.nex1InvokeAdapter(registry, req);
  if (!resp.ok) return { ok: false, reason: resp.reason };
  const applied = engine.applyWholeFileDiff(resp.result.proposed_diff);
  const next = applied.get(target);
  if (!next) return { ok: false, reason: "empty diff" };
  writeFileSync(abs, next, "utf8");
  return { ok: true, delta: next.length - content.length };
}

/**
 * @summary Run tsc against the whole tree, then count errors localised to
 * the specific test file. Zero errors on that file = the @ts-expect-error
 * successfully consumed the wrong-typed assignment error.
 */
function tscErrorsInFile(testFile) {
  const tsc = run("npx", ["tsc", "--noEmit", "--skipLibCheck", "--noErrorTruncation", "--pretty", "false"], {
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" },
  });
  const out = (tsc.stdout ?? "") + "\n" + (tsc.stderr ?? "");
  const lines = out.split(/\r?\n/);
  const norm = testFile.replace(/\\/g, "/");
  return lines.filter((l) => l.replace(/\\/g, "/").startsWith(norm)).length;
}

function runVitestOnFile(testFile) {
  const vt = run("npx", ["vitest", "run", "--config=vitest.config.capability-i2.mts", testFile, "--reporter=default"], {
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
  });
  const out = (vt.stdout ?? "") + "\n" + (vt.stderr ?? "");
  const passed = Number(/(\d+)\s+passed/.exec(out)?.[1] ?? "0");
  const failed = Number(/(\d+)\s+failed/.exec(out)?.[1] ?? "0");
  return { exit: vt.status, passed, failed };
}

console.log("NEX1 · CAPABILITY I.2 · NEGATIVE TYPE-SYSTEM PROOF · eight-test suite");
console.log("─".repeat(72));

const evidence = {
  at: new Date().toISOString(),
  attribution: {
    teaching_infrastructure: "capability-i2-negative-proof.ts · taught_by=master_ai_engineer",
    novel_challenge_execution: "attempted_by=nex1 · teaching_assistance=true",
    fixtures_and_scripts: "authored_by=examiner",
  },
  sub_tests: {},
};

// Watch fixtures for byte-identity
const WATCH = [
  "data/nex1-code-engine/challenge-i2/shapes.ts",
  "data/nex1-code-engine/challenge-i2-tests/age-tests.ts",
  "data/nex1-code-engine/challenge-i2-tests/name-tests.ts",
  "data/nex1-code-engine/challenge-i2-tests/active-tests.ts",
  "data/nex1-code-engine/challenge-i2-tests/tags-tests.ts",
  "data/nex1-code-engine/challenge-i2-tests/kind-tests.ts",
];
const preHashes = Object.fromEntries(WATCH.map((p) => [p, sha256(readFileSync(resolve(REPO_ROOT, p), "utf8"))]));

async function runPropose({ id, label, goal, testTargetFile, expectedWrongType }) {
  console.log(`\n── ${id} · ${label} ──`);
  const snap = readFileSync(resolve(REPO_ROOT, testTargetFile), "utf8");
  const originalHash = sha256(snap);
  const record = { expectedWrongType };
  try {
    const plan = engine.synthesiseNegativeProof(goal);
    console.log(`  · plan.kind = ${plan.kind}`);
    console.log(`  · declared_field_type = ${plan.declared_field_type}`);
    console.log(`  · wrong_typed_value = ${plan.wrong_typed_value}`);
    record.plan = { kind: plan.kind, declared_field_type: plan.declared_field_type, wrong_typed_value: plan.wrong_typed_value, test_name: plan.test_name };

    if (plan.kind !== "planned" || !plan.directive) {
      record.verdict = "fail";
      console.log(`  · EXECUTION SKIPPED · expected planned, got ${plan.kind}`);
    } else {
      const ap = await applyDirective(plan.directive.target_path, plan.directive);
      console.log(`  · directive applied: ${ap.ok} · Δ+${ap.delta ?? 0}B`);
      const tscErrorCount = tscErrorsInFile(testTargetFile);
      console.log(`  · tsc scoped errors in test file: ${tscErrorCount} (expected 0 · @ts-expect-error consumed the wrong-typed error)`);
      const vt = runVitestOnFile(testTargetFile);
      console.log(`  · vitest exit=${vt.exit} passed=${vt.passed} failed=${vt.failed}`);
      record.tsc_errors = tscErrorCount;
      record.vitest = vt;
      record.verdict = (tscErrorCount === 0 && vt.exit === 0 && vt.passed >= 1 && vt.failed === 0) ? "pass" : "fail";
    }
  } finally {
    writeFileSync(resolve(REPO_ROOT, testTargetFile), snap, "utf8");
    const restoredHash = sha256(readFileSync(resolve(REPO_ROOT, testTargetFile), "utf8"));
    record.byte_identical = restoredHash === originalHash;
  }
  if (!record.verdict) record.verdict = "fail";
  console.log(`  · byte_identical: ${record.byte_identical}`);
  console.log(`  → verdict: ${record.verdict.toUpperCase()}`);
  return record;
}

function runRefuse({ id, label, goal, expectedKind }) {
  console.log(`\n── ${id} · ${label} ──`);
  const plan = engine.synthesiseNegativeProof(goal);
  const record = { plan: { kind: plan.kind, reason: plan.reason }, expectedKind };
  console.log(`  · plan.kind = ${plan.kind}`);
  console.log(`  · plan.reason = ${plan.reason.slice(0, 120)}`);
  const acceptable = Array.isArray(expectedKind) ? expectedKind : [expectedKind];
  record.verdict = acceptable.includes(plan.kind) && plan.directive === null ? "pass" : "fail";
  console.log(`  → verdict: ${record.verdict.toUpperCase()}`);
  return record;
}

// ─── Propose cases ────────────────────────────────────────────────────
evidence.sub_tests["I2.1"] = await runPropose({
  id: "I2.1",
  label: "number field (ageNum) · @ts-expect-error rejects string",
  goal: {
    target_type: "Shapes",
    target_field: "ageNum",
    source_scope: { root: resolve(REPO_ROOT, "data/nex1-code-engine/challenge-i2") },
    test_target_file: "data/nex1-code-engine/challenge-i2-tests/age-tests.ts",
    test_target_describe: "Capability I.2 · Shapes.ageNum",
  },
  testTargetFile: "data/nex1-code-engine/challenge-i2-tests/age-tests.ts",
  expectedWrongType: "number",
});

evidence.sub_tests["I2.2"] = await runPropose({
  id: "I2.2",
  label: "string field (nameStr) · @ts-expect-error rejects number",
  goal: {
    target_type: "Shapes",
    target_field: "nameStr",
    source_scope: { root: resolve(REPO_ROOT, "data/nex1-code-engine/challenge-i2") },
    test_target_file: "data/nex1-code-engine/challenge-i2-tests/name-tests.ts",
    test_target_describe: "Capability I.2 · Shapes.nameStr",
  },
  testTargetFile: "data/nex1-code-engine/challenge-i2-tests/name-tests.ts",
  expectedWrongType: "string",
});

evidence.sub_tests["I2.3"] = await runPropose({
  id: "I2.3",
  label: "boolean field (activeBool) · @ts-expect-error rejects string",
  goal: {
    target_type: "Shapes",
    target_field: "activeBool",
    source_scope: { root: resolve(REPO_ROOT, "data/nex1-code-engine/challenge-i2") },
    test_target_file: "data/nex1-code-engine/challenge-i2-tests/active-tests.ts",
    test_target_describe: "Capability I.2 · Shapes.activeBool",
  },
  testTargetFile: "data/nex1-code-engine/challenge-i2-tests/active-tests.ts",
  expectedWrongType: "boolean",
});

evidence.sub_tests["I2.4"] = await runPropose({
  id: "I2.4",
  label: "array field (tagsArr) · @ts-expect-error rejects scalar",
  goal: {
    target_type: "Shapes",
    target_field: "tagsArr",
    source_scope: { root: resolve(REPO_ROOT, "data/nex1-code-engine/challenge-i2") },
    test_target_file: "data/nex1-code-engine/challenge-i2-tests/tags-tests.ts",
    test_target_describe: "Capability I.2 · Shapes.tagsArr",
  },
  testTargetFile: "data/nex1-code-engine/challenge-i2-tests/tags-tests.ts",
  expectedWrongType: "readonly string[]",
});

evidence.sub_tests["I2.5"] = await runPropose({
  id: "I2.5",
  label: "union field (kindUnion) · @ts-expect-error rejects out-of-union literal",
  goal: {
    target_type: "Shapes",
    target_field: "kindUnion",
    source_scope: { root: resolve(REPO_ROOT, "data/nex1-code-engine/challenge-i2") },
    test_target_file: "data/nex1-code-engine/challenge-i2-tests/kind-tests.ts",
    test_target_describe: "Capability I.2 · Shapes.kindUnion",
  },
  testTargetFile: "data/nex1-code-engine/challenge-i2-tests/kind-tests.ts",
  expectedWrongType: "\"widget\" | \"gadget\"",
});

// ─── Refuse cases ─────────────────────────────────────────────────────
evidence.sub_tests["I2.6"] = runRefuse({
  id: "I2.6",
  label: "complex field (settingsComplex : ShapesSettings) · REFUSE",
  goal: {
    target_type: "Shapes",
    target_field: "settingsComplex",
    source_scope: { root: resolve(REPO_ROOT, "data/nex1-code-engine/challenge-i2") },
    test_target_file: "data/nex1-code-engine/challenge-i2-tests/kind-tests.ts",
    test_target_describe: "Capability I.2 · Shapes.settingsComplex",
  },
  expectedKind: "refused_complex_type",
});

evidence.sub_tests["I2.7"] = runRefuse({
  id: "I2.7",
  label: "non-existent field (Shapes.doesNotExist) · REFUSE (no_field)",
  goal: {
    target_type: "Shapes",
    target_field: "doesNotExist",
    source_scope: { root: resolve(REPO_ROOT, "data/nex1-code-engine/challenge-i2") },
    test_target_file: "data/nex1-code-engine/challenge-i2-tests/kind-tests.ts",
    test_target_describe: "Capability I.2 · Shapes.doesNotExist",
  },
  expectedKind: "refused_no_field",
});

evidence.sub_tests["I2.8"] = runRefuse({
  id: "I2.8",
  label: "protected target (SecretConfig.token · __protected-fixture__) · REFUSE (protected_path)",
  goal: {
    target_type: "SecretConfig",
    target_field: "token",
    source_scope: { root: resolve(REPO_ROOT, "data/nex1-code-engine/__protected-fixture__") },
    test_target_file: "data/nex1-code-engine/challenge-i2-tests/kind-tests.ts",
    test_target_describe: "Capability I.2 · SecretConfig.token",
  },
  expectedKind: "refused_protected_path",
});

// Byte-identity across fixtures
let byteIdentical = true;
for (const p of WATCH) {
  const h = sha256(readFileSync(resolve(REPO_ROOT, p), "utf8"));
  if (h !== preHashes[p]) { byteIdentical = false; console.log(`  ⚠️  MUTATION LEFT: ${p}`); }
}
evidence.all_fixtures_byte_identical = byteIdentical;

const dir = resolve(REPO_ROOT, "data/nex1-code-engine/capability-i2-validation");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidencePath = resolve(dir, `suite-${stamp}.json`);
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf8");
console.log(`\nEvidence: ${evidencePath}`);

console.log("\n══════════ CAPABILITY I.2 VERDICT ══════════");
for (const [k, v] of Object.entries(evidence.sub_tests)) console.log(`  ${k}: ${v.verdict}`);
console.log(`  all_fixtures_byte_identical: ${byteIdentical}`);
const allPass = Object.values(evidence.sub_tests).every((t) => t.verdict === "pass") && byteIdentical;
console.log(allPass ? "  RESULT · CAPABILITY I.2 PASS · negative proofs verified." : "  RESULT · at least one sub-test failed · inspect evidence.");
console.log("═".repeat(44));
process.exit(allPass ? 0 : 1);
