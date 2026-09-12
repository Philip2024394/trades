#!/usr/bin/env node
// scripts/nex1-sprint-2-retention-experiment.mjs
//
// Sprint 2 · RETENTION EXPERIMENT · teach → prove → remove teacher → measure.
//
// Founder-locked (2026-09-12):
//   · Adapter is optional · never becomes NEX1
//   · Both with-adapter and without-adapter scores must be recorded
//   · Retention Score = Y / X (Y = template-only alone · X = with adapter)
//   · Do NOT optimise the experiment to make NEX1 pass
//   · Retention is a signal of retention · NOT proof of internalised intelligence
//
// This script runs three fixture sub-tasks that mirror Challenge 3.B:
//   1. Add a `resolved_at: string | null` field to an existing interface
//   2. Populate `resolved_at` inside a function's return-object literal
//   3. Add a new `it(...)` test case inside an existing `describe(...)` block
//
// Fixture inputs are in-memory. The experiment does NOT modify any repo file.

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REPO_ROOT = process.cwd();

if (!process.env.NEX1_RETENTION_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-sprint-2-retention-experiment.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_RETENTION_INNER: "1" } },
  );
  process.exit(r.status ?? 1);
}

const enginePath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/index.ts")).href;
const loopPath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/nex1-authoring-loop.ts")).href;
const engine = await import(enginePath);
const loop = await import(loopPath);

// ─── Fixture sub-tasks · mirror Challenge 3.B ─────────────────────

const F1_PATH = "fixture/prov-1.ts";
const F1_SOURCE = [
  "export interface Nex1AttemptProvenance {",
  "  readonly task_id: string;",
  "  readonly attempt_id: string;",
  "  readonly at: string;",
  "}",
  "",
].join("\n");

const F2_PATH = "fixture/prov-2.ts";
const F2_SOURCE = [
  "export function recordProvenance(): { task_id: string; at: string } {",
  "  return { task_id: 't', at: new Date().toISOString() };",
  "}",
  "",
].join("\n");

const F3_PATH = "fixture/prov-3.test.ts";
const F3_SOURCE = [
  'import { describe, it, expect } from "vitest";',
  '',
  'describe("provenance", () => {',
  '  it("records task_id", () => { expect(1).toBe(1); });',
  '});',
  '',
].join("\n");

const subTasks = [
  {
    id: "add-interface-field",
    fixture_path: F1_PATH,
    fixture_source: F1_SOURCE,
    directive: {
      kind: "add_interface_field",
      target_path: F1_PATH,
      target_interface: "Nex1AttemptProvenance",
      field_name: "resolved_at",
      field_type: "string | null",
    },
    expected_content_regex: /resolved_at\s*:\s*string\s*\|\s*null/,
  },
  {
    id: "populate-in-function-body",
    fixture_path: F2_PATH,
    fixture_source: F2_SOURCE,
    directive: {
      kind: "add_return_object_property",
      target_path: F2_PATH,
      target_function: "recordProvenance",
      property_name: "resolved_at",
      property_value: "new Date().toISOString()",
    },
    expected_content_regex: /resolved_at\s*:\s*new Date\(\)\.toISOString\(\)/,
  },
  {
    id: "add-test-case",
    fixture_path: F3_PATH,
    fixture_source: F3_SOURCE,
    directive: {
      kind: "add_test_case",
      target_path: F3_PATH,
      target_describe: "provenance",
      test_name: "resolved_at is populated",
      test_body: 'expect(typeof "x").toBe("string");',
    },
    expected_content_regex: /it\(\s*"resolved_at is populated"/,
  },
];

// Build a Nex1ReasoningContext + directive for a sub-task
function buildRequest(sub) {
  return {
    task_prompt: `Sub-task: ${sub.id}`,
    intent: sub.directive.kind === "add_test_case" ? "add_test" : "add_feature",
    declared_scope: [sub.fixture_path],
    template_directive: sub.directive,
  };
}

// Custom in-memory loop invocation · we don't want the standard loop because
// it reads files from disk. Instead invoke the adapter directly with a
// hand-built context that carries the fixture as its file_slice.
async function runFixtureLoop(registry, sub) {
  const context = {
    task_prompt: `Sub-task: ${sub.id}`,
    repo_snapshot_hash: "fixture-" + sub.id,
    file_slices: [{ path: sub.fixture_path, content: sub.fixture_source, content_hash: "fixture" }],
    relevant_adrs: [],
    declared_scope: [sub.fixture_path],
  };
  const req = {
    task_id: `retention-${sub.id}`,
    attempt_id: `attempt-${Date.now()}`,
    intent: sub.directive.kind === "add_test_case" ? "add_test" : "add_feature",
    context,
    output_kind: "diff",
    template_directive: sub.directive,
  };
  const resp = await engine.nex1InvokeAdapter(registry, req);
  if (!resp.ok) {
    return { ok: false, code: resp.code, reason: resp.reason };
  }
  // Apply the whole-file diff back to a text
  const applied = engine.applyWholeFileDiff(resp.result.proposed_diff);
  const nextText = applied.get(sub.fixture_path);
  if (!nextText) return { ok: false, code: "apply-empty", reason: "diff applied to empty map" };
  const passes = sub.expected_content_regex.test(nextText);
  return { ok: true, next: nextText, adapter_id: resp.result.adapter_id, semantic_pass: passes };
}

async function runPhase(label, includeAst) {
  console.log(`\n────────── PHASE ${label} · ast-semantic ${includeAst ? "REGISTERED" : "REMOVED"} ──────────`);
  const registry = new engine.Nex1ReasoningRegistry();  // starts with template-only
  if (includeAst) registry.register(engine.AstSemanticAdapter);
  console.log(`  registered adapters: [${registry.listRegistered().join(", ")}]`);
  const outcomes = [];
  for (const sub of subTasks) {
    process.stdout.write(`  · ${sub.id.padEnd(28)} `);
    const r = await runFixtureLoop(registry, sub);
    if (!r.ok) {
      console.log(`FAIL · ${r.code} · ${r.reason?.slice(0, 60)}`);
      outcomes.push({ id: sub.id, ok: false, reason: r.reason, code: r.code });
    } else {
      console.log(`${r.semantic_pass ? "PASS" : "FAIL"} · adapter=${r.adapter_id} · semantic=${r.semantic_pass}`);
      outcomes.push({ id: sub.id, ok: r.semantic_pass, adapter_id: r.adapter_id });
    }
  }
  const score = outcomes.filter((o) => o.ok).length;
  console.log(`  PHASE ${label} score: ${score}/${subTasks.length}`);
  return { score, outcomes };
}

// ─── Run the experiment ─────────────────────────────────────────────

console.log("NEX1 · SPRINT 2 RETENTION EXPERIMENT");
console.log("─".repeat(72));
console.log("Purpose:  measure whether the AST adapter internalises capability into NEX1,");
console.log("          or whether NEX1 depends on the adapter for semantic modification.");
console.log("Rule:     do NOT tune the experiment to make NEX1 pass.");
console.log("Record:   both WITH-teacher and WITHOUT-teacher scores.");
console.log("─".repeat(72));

const withAdapter = await runPhase("WITH-TEACHER", true);
const withoutAdapter = await runPhase("WITHOUT-TEACHER", false);

// ─── Retention score ────────────────────────────────────────────────
const X = withAdapter.score;
const Y = withoutAdapter.score;
const retention = X === 0 ? null : Y / X;
console.log("\n════════════════════ RESULT ════════════════════");
console.log(`  WITH teacher    (ast-semantic + template-only):  ${X} / ${subTasks.length}`);
console.log(`  WITHOUT teacher (template-only ONLY):            ${Y} / ${subTasks.length}`);
console.log(`  Retention score = Y / X:                         ${retention === null ? "n/a (X=0)" : retention.toFixed(2)}`);
console.log("");
console.log("Interpretation (per founder discipline · not proof of internalisation):");
if (X === 0) {
  console.log("  · The AST adapter did not solve the tasks · Sprint 2 build is not yet complete.");
} else if (retention === 0) {
  console.log("  · NEX1 retained ZERO capability without the adapter.");
  console.log("  · The AST adapter is doing all the semantic reasoning work.");
  console.log("  · This is honest evidence · not proof NEX1 has internalised the capability.");
  console.log("  · Sprint 2 GATE 2.4 LIVE cannot be recommended on this basis alone.");
} else if (retention < 0.5) {
  console.log("  · NEX1 retains partial capability without the adapter.");
  console.log("  · The adapter contributes materially · NEX1 has not fully internalised.");
} else if (retention < 1.0) {
  console.log("  · NEX1 retains most capability without the adapter.");
  console.log("  · The adapter is a strong teacher · NEX1 shows evidence of learning.");
} else {
  console.log("  · NEX1 retains full capability without the adapter · unexpected · investigate.");
}
console.log("═".repeat(48));

// Persist the experiment record
const recordDir = resolve(REPO_ROOT, "data/nex1-code-engine/sprint-2-retention");
mkdirSync(recordDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const recordPath = resolve(recordDir, `${stamp}.json`);
writeFileSync(recordPath, JSON.stringify({
  at: new Date().toISOString(),
  with_teacher: withAdapter,
  without_teacher: withoutAdapter,
  retention_score: retention,
  x: X, y: Y,
  n_sub_tasks: subTasks.length,
  discipline_notes: [
    "Retention Score is a signal of retention, not proof of internalised intelligence.",
    "Adapter never became NEX1. Adapter scope stayed 'code_proposal_only'.",
    "Every attempt attempted_by=nex1 · adapter_id recorded separately.",
  ],
}, null, 2), "utf8");
console.log(`\nRecord written: ${recordPath}`);
process.exit(0);
