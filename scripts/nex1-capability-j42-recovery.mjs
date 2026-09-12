#!/usr/bin/env node
// scripts/nex1-capability-j42-recovery.mjs
//
// NEX1 · CAPABILITY J.4.2 · LONG RUN WITH IN-LOOP RECOVERY · two-test suite.
//
//   J4.2.1 · A verified → B fix_failing_test recovers via J.3 → C verified
//            expected: all_verified · B state=verified_with_recovery
//   J4.2.2 · A verified → B fix_failing_test where J.2 refuses → HARD STOP
//            expected: failed_hard_mid_run · C stays queued · rollback of A

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_J42_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-capability-j42-recovery.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_J42_INNER: "1" } },
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
    task_id: `j42-${directive.field_name ?? "repair"}`,
    attempt_id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    intent: "add_feature",
    context: {
      task_prompt: "j42",
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

function tscErrorsScoped(targets) {
  const tsc = run("npx", ["tsc", "--noEmit", "--skipLibCheck", "--noErrorTruncation", "--pretty", "false"], {
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" },
  });
  const out = (tsc.stdout ?? "") + "\n" + (tsc.stderr ?? "");
  const lines = out.split(/\r?\n/);
  const repoRootNorm = REPO_ROOT.replace(/\\/g, "/");
  const forms = new Set();
  for (const t of targets) {
    const norm = t.replace(/\\/g, "/");
    forms.add(norm);
    if (norm.startsWith(repoRootNorm + "/")) forms.add(norm.slice(repoRootNorm.length + 1));
  }
  let count = 0;
  for (const line of lines) {
    const norm = line.replace(/\\/g, "/");
    for (const form of forms) {
      if (norm.startsWith(form + "(") || norm.startsWith(form + ":")) { count++; break; }
    }
  }
  return count;
}

console.log("NEX1 · CAPABILITY J.4.2 · LONG RUN WITH IN-LOOP RECOVERY · two-test suite");
console.log("─".repeat(78));

const evidence = {
  at: new Date().toISOString(),
  attribution: {
    teaching_infrastructure: "capability-j42-long-run-with-recovery.ts · taught_by=master_ai_engineer",
    novel_challenge_execution: "attempted_by=nex1 · teaching_assistance=true",
    fixtures_and_scripts: "authored_by=examiner",
  },
  sub_tests: {},
};

const WATCH = [
  "data/nex1-code-engine/challenge-j4/target-a.ts",
  "data/nex1-code-engine/challenge-j4/target-d.ts",
  "data/nex1-code-engine/challenge-j2/source-literal.ts",
  "data/nex1-code-engine/challenge-j2/source-contract.ts",
  "data/nex1-code-engine/challenge-j2-tests/source-wrong.test.ts",
  "data/nex1-code-engine/challenge-j2-tests/test-wrong.test.ts",
];
const preHashes = Object.fromEntries(WATCH.map((p) => [p, sha256(readFileSync(resolve(REPO_ROOT, p), "utf8"))]));

function byteIdentical() {
  for (const p of WATCH) {
    const h = sha256(readFileSync(resolve(REPO_ROOT, p), "utf8"));
    if (h !== preHashes[p]) return false;
  }
  return true;
}

const scope = { root: resolve(REPO_ROOT, "data/nex1-code-engine/challenge-j4") };

async function runRecoveryTest({ id, label, spec, expectedVerdict, expectedStates }) {
  console.log(`\n── ${id} · ${label} ──`);
  const result = await engine.executeLongRunWithRecovery(spec, {
    repo_root: REPO_ROOT,
    scope,
    apply_directive: applyDirective,
    tsc_errors_scoped: tscErrorsScoped,
  });
  console.log(`  · verdict = ${result.verdict}`);
  console.log(`  · rollback = ${result.rollback_status}`);
  console.log(`  · stopped_after_id = ${result.stopped_after_id ?? "(none)"}`);
  for (const g of result.per_goal) console.log(`    · ${g.id} [${g.kind}] → ${g.state}${g.recovery_used ? " (recovery)" : ""} · ${g.reason.slice(0, 90)}`);
  const record = { run_verdict: result.verdict, rollback: result.rollback_status, stopped_after: result.stopped_after_id, per_goal: result.per_goal };
  const verdictOk = result.verdict === expectedVerdict;
  const statesOk = expectedStates
    ? result.per_goal.length === expectedStates.length && expectedStates.every((s, i) => result.per_goal[i].state === s)
    : true;
  const bytesOk = byteIdentical();
  record.byte_identical = bytesOk;
  record.verdict_ok = verdictOk;
  record.states_ok = statesOk;
  console.log(`  · byte_identical = ${bytesOk}`);
  const pass = verdictOk && statesOk && bytesOk;
  console.log(`  → verdict: ${pass ? "PASS" : "FAIL"}`);
  return { verdict: pass ? "pass" : "fail", ...record };
}

// ─── J4.2.1 · recovery succeeds ───────────────────────────────────────
evidence.sub_tests["J4.2.1"] = await runRecoveryTest({
  id: "J4.2.1",
  label: "A verified → B recovers via J.3 → C verified · all_verified",
  spec: {
    items: [
      { id: "A-target-a", kind: "add_field", goal: { goal: "add_field", type_name: "TargetA", concept: "afield", desired_kind: "number" } },
      { id: "B-recover", kind: "fix_failing_test", test_file: "data/nex1-code-engine/challenge-j2-tests/source-wrong.test.ts", vitest_config: "vitest.config.capability-j2.mts" },
      { id: "C-target-d", kind: "add_field", goal: { goal: "add_field", type_name: "TargetD", concept: "dfield", desired_kind: "string" } },
    ],
    max_iterations: 5,
  },
  expectedVerdict: "all_verified",
  expectedStates: ["verified", "verified_with_recovery", "verified"],
});

// ─── J4.2.2 · recovery refused · hard stop · rollback ─────────────────
evidence.sub_tests["J4.2.2"] = await runRecoveryTest({
  id: "J4.2.2",
  label: "A verified → B J.2 refuses (test-wrong) → HARD STOP · C queued · rollback",
  spec: {
    items: [
      { id: "A-target-a", kind: "add_field", goal: { goal: "add_field", type_name: "TargetA", concept: "afield2", desired_kind: "number" } },
      { id: "B-refuse", kind: "fix_failing_test", test_file: "data/nex1-code-engine/challenge-j2-tests/test-wrong.test.ts", vitest_config: "vitest.config.capability-j2.mts" },
      { id: "C-target-d", kind: "add_field", goal: { goal: "add_field", type_name: "TargetD", concept: "dfield2", desired_kind: "string" } },
    ],
    max_iterations: 5,
  },
  expectedVerdict: "failed_hard_mid_run",
  expectedStates: ["verified", "failed_hard", "queued"],
});

const dir = resolve(REPO_ROOT, "data/nex1-code-engine/capability-j42-validation");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidencePath = resolve(dir, `suite-${stamp}.json`);
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf8");
console.log(`\nEvidence: ${evidencePath}`);

console.log("\n══════════ CAPABILITY J.4.2 VERDICT ══════════");
for (const [k, v] of Object.entries(evidence.sub_tests)) console.log(`  ${k}: ${v.verdict}`);
const allPass = Object.values(evidence.sub_tests).every((t) => t.verdict === "pass");
console.log(allPass ? "  RESULT · CAPABILITY J.4.2 PASS · in-loop recovery works and hard-stops safely." : "  RESULT · at least one sub-test failed · inspect evidence.");
console.log("═".repeat(46));
process.exit(allPass ? 0 : 1);
