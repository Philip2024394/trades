#!/usr/bin/env node
// scripts/nex1-capability-i-test-synthesis.mjs
//
// NEX1 · CAPABILITY I.1 · TEST SYNTHESIS · seven-test suite.
//
// Planned cases (5) · synthesise → apply → run vitest → verify pass:
//   I1 · primitive strings (Reservation)
//   I2 · primitive number+string (Invoice)
//   I3 · array field (Catalog.tags:readonly string[])
//   I4 · heritage chain (LevelD via A/B/C)
//   I5 · duplicate-symbol Vehicle (must resolve to module-a)
//
// Refusal cases (2) · synthesise must return refusal · no mutation:
//   I6 · complex custom type (UserProfile.settings:CustomSettings)
//   I7 · protected path (SecretConfig in __protected-fixture__)
//
// For planned cases · success requires:
//   · plan.kind === "planned"
//   · directive applied to test target file
//   · vitest run on the specific test file · exit=0 · at least 1 test passed
//   · all fixtures + test target restored byte-identical

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_I_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-capability-i-test-synthesis.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_I_INNER: "1" } },
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
    task_id: `i-${directive.test_name?.slice(0, 20) ?? "test"}`,
    attempt_id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    intent: "add_test",
    context: {
      task_prompt: "capability-i test synthesis",
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

function runVitestOnFile(testFile) {
  const vt = run("npx", ["vitest", "run", "--config=vitest.config.capability-i.mts", testFile, "--reporter=default"], {
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
  });
  const out = (vt.stdout ?? "") + "\n" + (vt.stderr ?? "");
  const passed = Number(/Tests\s+(\d+)\s+passed/.exec(out)?.[1] ?? "0");
  const failed = Number(/Tests.*?(\d+)\s+failed/.exec(out)?.[1] ?? "0");
  return { exit: vt.status, passed, failed, tail: out.split(/\r?\n/).slice(-12).join("\n") };
}

console.log("NEX1 · CAPABILITY I.1 · TEST SYNTHESIS · seven-test suite");
console.log("─".repeat(72));

const evidence = {
  at: new Date().toISOString(),
  attribution: {
    teaching_infrastructure: "capability-i-test-synthesis.ts · taught_by=master_ai_engineer",
    novel_challenge_execution: "attempted_by=nex1 · teaching_assistance=true",
    fixtures_and_scripts: "authored_by=examiner",
  },
  sub_tests: {},
};

async function runPlanned({ label, goal, watchFiles, testTargetFile }) {
  console.log(`\n── ${label} ──`);
  const snap = new Map();
  const originalHashes = {};
  for (const p of watchFiles) {
    const c = readFileSync(resolve(REPO_ROOT, p), "utf8");
    snap.set(p, c);
    originalHashes[p] = sha256(c);
  }
  const record = { goal };
  try {
    const plan = engine.synthesiseTestForType(goal);
    console.log(`  · plan.kind = ${plan.kind}`);
    console.log(`  · plan.reason = ${plan.reason.slice(0, 120)}`);
    record.plan = { kind: plan.kind, target_source_file: plan.target_source_file, test_name: plan.test_name, enumerated_fields: plan.enumerated_fields, reason: plan.reason };

    if (plan.kind !== "planned" || !plan.directive) {
      record.verdict = "fail";
      console.log(`  · EXECUTION SKIPPED · expected planned, got ${plan.kind}`);
    } else {
      console.log(`  · fields: [${plan.enumerated_fields?.map((f) => `${f.name}:${f.declared_type}`).join(", ")}]`);
      const ap = await applyDirective(plan.directive.target_path, plan.directive);
      console.log(`  · directive applied: ${ap.ok} · Δ+${ap.delta ?? 0}B`);
      if (!ap.ok) {
        record.verdict = "fail";
        record.apply_error = ap.reason;
      } else {
        const vt = runVitestOnFile(testTargetFile);
        record.vitest = { exit: vt.exit, passed: vt.passed, failed: vt.failed };
        console.log(`  · vitest exit=${vt.exit} passed=${vt.passed} failed=${vt.failed}`);
        if (vt.exit !== 0 || vt.passed === 0 || vt.failed > 0) {
          record.verdict = "fail";
          record.vitest_tail = vt.tail;
        }
      }
    }
  } finally {
    for (const [p, c] of snap) writeFileSync(resolve(REPO_ROOT, p), c, "utf8");
    let byteIdentical = true;
    for (const p of watchFiles) {
      if (sha256(readFileSync(resolve(REPO_ROOT, p), "utf8")) !== originalHashes[p]) byteIdentical = false;
    }
    record.byte_identical = byteIdentical;
    console.log(`  · byte_identical: ${byteIdentical}`);
  }
  if (!record.verdict) {
    record.verdict = (record.byte_identical && record.vitest?.passed > 0 && record.vitest?.failed === 0) ? "pass" : "fail";
  }
  console.log(`  → verdict: ${record.verdict.toUpperCase()}`);
  return record;
}

async function runRefusal({ label, goal, watchFiles, expectedKind }) {
  console.log(`\n── ${label} ──`);
  const snap = new Map();
  const originalHashes = {};
  for (const p of watchFiles) {
    const c = readFileSync(resolve(REPO_ROOT, p), "utf8");
    snap.set(p, c);
    originalHashes[p] = sha256(c);
  }
  const record = { goal, expectedKind };
  try {
    const plan = engine.synthesiseTestForType(goal);
    console.log(`  · plan.kind = ${plan.kind}`);
    console.log(`  · plan.reason = ${plan.reason.slice(0, 120)}`);
    record.plan = { kind: plan.kind, reason: plan.reason };
  } finally {
    for (const [p, c] of snap) writeFileSync(resolve(REPO_ROOT, p), c, "utf8");
    let byteIdentical = true;
    for (const p of watchFiles) {
      if (sha256(readFileSync(resolve(REPO_ROOT, p), "utf8")) !== originalHashes[p]) byteIdentical = false;
    }
    record.byte_identical = byteIdentical;
    console.log(`  · byte_identical: ${byteIdentical}`);
  }
  record.verdict = (record.plan.kind === expectedKind && record.byte_identical) ? "pass" : "fail";
  console.log(`  → verdict: ${record.verdict.toUpperCase()}`);
  return record;
}

// ─── I1 · Reservation ─────────────────────────────────────────────────
evidence.sub_tests["I1"] = await runPlanned({
  label: "I1 · Reservation (primitive strings)",
  goal: {
    target_type: "Reservation",
    source_scope: { root: resolve(REPO_ROOT, "data/nex1-code-engine/novel-e") },
    test_target_file: "data/nex1-code-engine/challenge-i-tests/reservation-tests.ts",
    test_target_describe: "Capability I · Reservation",
  },
  watchFiles: ["data/nex1-code-engine/challenge-i-tests/reservation-tests.ts", "data/nex1-code-engine/novel-e/schema.ts"],
  testTargetFile: "data/nex1-code-engine/challenge-i-tests/reservation-tests.ts",
});

// ─── I2 · Invoice ─────────────────────────────────────────────────────
evidence.sub_tests["I2"] = await runPlanned({
  label: "I2 · Invoice (string + number)",
  goal: {
    target_type: "Invoice",
    source_scope: { root: resolve(REPO_ROOT, "data/nex1-code-engine/challenge-h") },
    test_target_file: "data/nex1-code-engine/challenge-i-tests/invoice-tests.ts",
    test_target_describe: "Capability I · Invoice",
  },
  watchFiles: ["data/nex1-code-engine/challenge-i-tests/invoice-tests.ts", "data/nex1-code-engine/challenge-h/invoice-schema.ts"],
  testTargetFile: "data/nex1-code-engine/challenge-i-tests/invoice-tests.ts",
});

// ─── I3 · Catalog (array) ─────────────────────────────────────────────
evidence.sub_tests["I3"] = await runPlanned({
  label: "I3 · Catalog (readonly string[] array field)",
  goal: {
    target_type: "Catalog",
    source_scope: { root: resolve(REPO_ROOT, "data/nex1-code-engine/challenge-i") },
    test_target_file: "data/nex1-code-engine/challenge-i-tests/catalog-tests.ts",
    test_target_describe: "Capability I · Catalog",
  },
  watchFiles: ["data/nex1-code-engine/challenge-i-tests/catalog-tests.ts", "data/nex1-code-engine/challenge-i/catalog.ts"],
  testTargetFile: "data/nex1-code-engine/challenge-i-tests/catalog-tests.ts",
});

// ─── I4 · LevelD (heritage chain) ─────────────────────────────────────
evidence.sub_tests["I4"] = await runPlanned({
  label: "I4 · LevelD (heritage · aId+bTag+cLabel+dNote via A/B/C/D)",
  goal: {
    target_type: "LevelD",
    source_scope: { root: resolve(REPO_ROOT, "data/nex1-code-engine/chain-4l") },
    test_target_file: "data/nex1-code-engine/challenge-i-tests/leveld-tests.ts",
    test_target_describe: "Capability I · LevelD · heritage chain",
  },
  watchFiles: ["data/nex1-code-engine/challenge-i-tests/leveld-tests.ts"],
  testTargetFile: "data/nex1-code-engine/challenge-i-tests/leveld-tests.ts",
});

// ─── I5 · Vehicle (duplicate-symbol) ──────────────────────────────────
evidence.sub_tests["I5"] = await runPlanned({
  label: "I5 · Vehicle (duplicate-symbol resolves to module-a)",
  goal: {
    target_type: "Vehicle",
    source_scope: { root: resolve(REPO_ROOT, "data/nex1-code-engine/duplicate-f") },
    test_target_file: "data/nex1-code-engine/challenge-i-tests/vehicle-tests.ts",
    test_target_describe: "Capability I · Vehicle · duplicate-symbol",
  },
  watchFiles: ["data/nex1-code-engine/challenge-i-tests/vehicle-tests.ts"],
  testTargetFile: "data/nex1-code-engine/challenge-i-tests/vehicle-tests.ts",
});

// ─── I6 · UserProfile · complex refuse ────────────────────────────────
evidence.sub_tests["I6"] = await runRefusal({
  label: "I6 · UserProfile (settings:CustomSettings) · REFUSAL required",
  goal: {
    target_type: "UserProfile",
    source_scope: { root: resolve(REPO_ROOT, "data/nex1-code-engine/challenge-i") },
    test_target_file: "data/nex1-code-engine/challenge-i-tests/user-profile-tests.ts",
    test_target_describe: "Capability I · UserProfile",
  },
  watchFiles: ["data/nex1-code-engine/challenge-i/user-profile.ts"],
  expectedKind: "refused_complex_type",
});

// ─── I7 · SecretConfig · protected refuse ─────────────────────────────
evidence.sub_tests["I7"] = await runRefusal({
  label: "I7 · SecretConfig (protected path) · REFUSAL required",
  goal: {
    target_type: "SecretConfig",
    source_scope: { root: resolve(REPO_ROOT, "data/nex1-code-engine/__protected-fixture__") },
    test_target_file: "data/nex1-code-engine/challenge-i-tests/secret-tests.ts",
    test_target_describe: "Capability I · SecretConfig",
  },
  watchFiles: ["data/nex1-code-engine/__protected-fixture__/secret-config.ts"],
  expectedKind: "refused_protected_path",
});

const dir = resolve(REPO_ROOT, "data/nex1-code-engine/capability-i-validation");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidencePath = resolve(dir, `suite-${stamp}.json`);
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf8");
console.log(`\nEvidence: ${evidencePath}`);

console.log("\n══════════ CAPABILITY I.1 VERDICT ══════════");
for (const [k, v] of Object.entries(evidence.sub_tests)) console.log(`  ${k}: ${v.verdict}`);
const allPass = Object.values(evidence.sub_tests).every((t) => t.verdict === "pass");
console.log(allPass ? "  RESULT · CAPABILITY I.1 PASS across all seven sub-tests." : "  RESULT · at least one sub-test failed · inspect evidence.");
console.log("═".repeat(44));
process.exit(allPass ? 0 : 1);
