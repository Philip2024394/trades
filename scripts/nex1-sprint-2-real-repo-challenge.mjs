#!/usr/bin/env node
// scripts/nex1-sprint-2-real-repo-challenge.mjs
//
// Sprint 2 · REAL-REPO CHALLENGE 3.B · WITHOUT PERSISTENCE.
//
// Founder rule (2026-09-12):
//   "Can NEX1 use the semantic adapter safely against its own real codebase,
//    rather than merely solving prepared fixture examples?"
//
// This script reads REAL repo files, invokes NEX1's authoring loop with the
// AST semantic adapter, evaluates the produced diff · but does NOT write
// anything to disk. The repo stays clean. Only the diffs are recorded to
// data/nex1-code-engine/sprint-2-real-repo/<stamp>.json for inspection.
//
// Constitutional constraints:
//   · Zero cloud call
//   · Zero vendor identity
//   · attempted_by=nex1 recorded for every attempt
//   · Adapter scope stays code_proposal_only
//   · Existing files remain byte-identical after the run

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();

if (!process.env.NEX1_REAL_REPO_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-sprint-2-real-repo-challenge.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_REAL_REPO_INNER: "1" } },
  );
  process.exit(r.status ?? 1);
}

const enginePath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/index.ts")).href;
const engine = await import(enginePath);

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function readRepoFile(rel) {
  const p = resolve(REPO_ROOT, rel);
  return { path: rel, content: readFileSync(p, "utf8"), sizeBefore: statSync(p).size };
}

const PROV_PATH = "src/lib/nex-agent/code-engine/provenance-recorder.ts";
const TEST_PATH = "src/lib/nex-agent/code-engine/code-engine.test.ts";

// ─── Real-repo sub-tasks · mirror Challenge 3.B ────────────────────

const subTasks = [
  {
    id: "add-interface-field",
    target: PROV_PATH,
    directive: {
      kind: "add_interface_field",
      target_path: PROV_PATH,
      target_interface: "Nex1AttemptProvenance",
      field_name: "resolved_at",
      field_type: "string | null",
      field_annotation: "Timestamp when NEX1's engine finished evaluating this attempt · null while still in flight.",
    },
    expected_regex: /resolved_at\s*:\s*string\s*\|\s*null/,
  },
  {
    id: "populate-in-function-body",
    target: PROV_PATH,
    directive: {
      kind: "add_return_object_property",
      target_path: PROV_PATH,
      target_function: "recordProvenance",
      property_name: "resolved_at",
      property_value: "new Date().toISOString()",
    },
    expected_regex: /resolved_at\s*:\s*new\s+Date\(\)\.toISOString\(\)/,
  },
  {
    id: "add-test-case",
    target: TEST_PATH,
    directive: {
      kind: "add_test_case",
      target_path: TEST_PATH,
      target_describe: "provenance · attribution firewall",
      test_name: "records resolved_at when NEX1 completes an attempt",
      test_body: 'expect(true).toBe(true);',
    },
    expected_regex: /it\(\s*"records resolved_at when NEX1 completes an attempt"/,
  },
];

// ─── Helper · invoke NEX1 authoring loop against a real file · no write ──

async function runSubTask(registry, sub) {
  const file = readRepoFile(sub.target);
  const context = {
    task_prompt: `Real-repo sub-task: ${sub.id}`,
    repo_snapshot_hash: sha256(file.content),
    file_slices: [{ path: sub.target, content: file.content, content_hash: sha256(file.content) }],
    relevant_adrs: [],
    declared_scope: [sub.target],
  };
  const req = {
    task_id: `real-repo-${sub.id}`,
    attempt_id: `attempt-${Date.now()}`,
    intent: sub.directive.kind === "add_test_case" ? "add_test" : "add_feature",
    context,
    output_kind: "diff",
    template_directive: sub.directive,
  };
  const resp = await engine.nex1InvokeAdapter(registry, req);
  if (!resp.ok) return { ok: false, code: resp.code, reason: resp.reason };

  // Apply diff in memory only · never to disk
  const applied = engine.applyWholeFileDiff(resp.result.proposed_diff);
  const nextText = applied.get(sub.target);
  if (!nextText) return { ok: false, code: "apply-empty", reason: "diff applied to empty map" };

  const semanticPass = sub.expected_regex.test(nextText);
  return {
    ok: true,
    adapter_id: resp.result.adapter_id,
    semantic_pass: semanticPass,
    rationale: resp.result.rationale,
    diff: resp.result.proposed_diff,
    diff_size_lines: resp.result.proposed_diff.split("\n").length,
    next_length_bytes: nextText.length,
    original_length_bytes: file.content.length,
    delta_bytes: nextText.length - file.content.length,
  };
}

// ─── Run ────────────────────────────────────────────────────────────

console.log("NEX1 · SPRINT 2 · REAL-REPO CHALLENGE 3.B · NO PERSISTENCE");
console.log("─".repeat(72));
console.log("Target files (READ ONLY):");
console.log(`  · ${PROV_PATH}`);
console.log(`  · ${TEST_PATH}`);
console.log("Rule: NEX1 must produce structurally-valid diffs against real code · no file mutation.");
console.log("─".repeat(72));

// Snapshot file sizes BEFORE run · we'll verify byte-identical AFTER
const provSizeBefore = statSync(resolve(REPO_ROOT, PROV_PATH)).size;
const testSizeBefore = statSync(resolve(REPO_ROOT, TEST_PATH)).size;
const provHashBefore = sha256(readFileSync(resolve(REPO_ROOT, PROV_PATH), "utf8"));
const testHashBefore = sha256(readFileSync(resolve(REPO_ROOT, TEST_PATH), "utf8"));

const registry = new engine.Nex1ReasoningRegistry();
registry.register(engine.AstSemanticAdapter);
console.log(`\nRegistered adapters: [${registry.listRegistered().join(", ")}]\n`);

const outcomes = [];
for (const sub of subTasks) {
  process.stdout.write(`· ${sub.id.padEnd(30)} `);
  const r = await runSubTask(registry, sub);
  if (!r.ok) {
    console.log(`FAIL · ${r.code} · ${r.reason?.slice(0, 60)}`);
    outcomes.push({ id: sub.id, target: sub.target, ok: false, code: r.code, reason: r.reason });
  } else {
    console.log(`${r.semantic_pass ? "PASS" : "FAIL"} · adapter=${r.adapter_id} · Δ${r.delta_bytes >= 0 ? "+" : ""}${r.delta_bytes}B`);
    console.log(`   ${r.rationale}`);
    outcomes.push({
      id: sub.id,
      target: sub.target,
      ok: r.semantic_pass,
      adapter_id: r.adapter_id,
      rationale: r.rationale,
      diff_size_lines: r.diff_size_lines,
      delta_bytes: r.delta_bytes,
    });
  }
}

// Verify byte-identical AFTER run
const provSizeAfter = statSync(resolve(REPO_ROOT, PROV_PATH)).size;
const testSizeAfter = statSync(resolve(REPO_ROOT, TEST_PATH)).size;
const provHashAfter = sha256(readFileSync(resolve(REPO_ROOT, PROV_PATH), "utf8"));
const testHashAfter = sha256(readFileSync(resolve(REPO_ROOT, TEST_PATH), "utf8"));
const noPersistence = provHashBefore === provHashAfter && testHashBefore === testHashAfter && provSizeBefore === provSizeAfter && testSizeBefore === testSizeAfter;

const score = outcomes.filter((o) => o.ok).length;
console.log("\n════════════════ RESULT ════════════════");
console.log(`  Score:                     ${score} / ${subTasks.length}`);
console.log(`  Files unchanged (hash):    ${noPersistence ? "YES · repo is byte-identical" : "NO · PERSISTENCE LEAK · investigate"}`);
console.log(`    ${PROV_PATH}: ${provHashBefore.slice(0, 12)} → ${provHashAfter.slice(0, 12)}  ${provHashBefore === provHashAfter ? "✓" : "✗"}`);
console.log(`    ${TEST_PATH}: ${testHashBefore.slice(0, 12)} → ${testHashAfter.slice(0, 12)}  ${testHashBefore === testHashAfter ? "✓" : "✗"}`);
console.log(`  attempted_by:              nex1 (adapter scope = code_proposal_only)`);
console.log("═".repeat(42));

if (score === subTasks.length && noPersistence) {
  console.log("\nGATE 2.3 · BIND recommendation basis:");
  console.log("  · NEX1 successfully modified real repo files at the diff level");
  console.log("  · Zero bytes changed on disk · experiment repeatable");
  console.log("  · Founder may authorise GATE 2.3 to register the AST adapter for development use");
} else if (score < subTasks.length) {
  console.log("\nDo NOT authorise GATE 2.3 yet · NEX1 could not handle the real repo cleanly.");
} else if (!noPersistence) {
  console.log("\nCRITICAL: files were modified · investigate before any further action.");
}

// Persist a record of the run
const recordDir = resolve(REPO_ROOT, "data/nex1-code-engine/sprint-2-real-repo");
mkdirSync(recordDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(resolve(recordDir, `${stamp}.json`), JSON.stringify({
  at: new Date().toISOString(),
  score: `${score}/${subTasks.length}`,
  files_unchanged: noPersistence,
  prov_hash_before: provHashBefore, prov_hash_after: provHashAfter,
  test_hash_before: testHashBefore, test_hash_after: testHashAfter,
  outcomes,
}, null, 2), "utf8");
console.log(`\nRecord: ${resolve(recordDir, `${stamp}.json`)}`);
process.exit(0);
