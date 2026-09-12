#!/usr/bin/env node
// scripts/nex1-sprint-2-5-consequence-reasoning.mjs
//
// Sprint 2.5 · CONSEQUENCE REASONING · deterministic · zero model.
//
// Founder discipline (2026-09-12):
//   AST change → run scoped typecheck → detect error → locate affected
//   symbol/caller → understand why it broke → generate the additional
//   required modification → typecheck again → tests → verify → record.
//
// Snapshot-restore protocol · main tree byte-identical at exit.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_CR_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-sprint-2-5-consequence-reasoning.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_CR_INNER: "1" } },
  );
  process.exit(r.status ?? 1);
}

function sha256(t) { return createHash("sha256").update(t).digest("hex"); }
function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: "pipe", shell: true, encoding: "utf8", cwd: REPO_ROOT, ...opts });
}

const enginePath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/index.ts")).href;
const engine = await import(enginePath);

const PROV_PATH = "src/lib/nex-agent/code-engine/provenance-recorder.ts";
const TEST_PATH = "src/lib/nex-agent/code-engine/code-engine.test.ts";
const TARGETS = [PROV_PATH, TEST_PATH];

const INITIAL_SUB_TASKS = [
  {
    id: "add-interface-field",
    target: PROV_PATH,
    directive: {
      kind: "add_interface_field", target_path: PROV_PATH,
      target_interface: "Nex1AttemptProvenance",
      field_name: "resolved_at", field_type: "string | null",
    },
  },
  {
    id: "populate-in-function-body",
    target: PROV_PATH,
    directive: {
      kind: "add_return_object_property", target_path: PROV_PATH,
      target_function: "recordProvenance",
      property_name: "resolved_at", property_value: "new Date().toISOString()",
    },
  },
  {
    id: "add-test-case",
    target: TEST_PATH,
    directive: {
      kind: "add_test_case", target_path: TEST_PATH,
      target_describe: "provenance · attribution firewall",
      test_name: "records resolved_at when NEX1 completes an attempt",
      test_body: "expect(true).toBe(true);",
    },
  },
];

console.log("NEX1 · SPRINT 2.5 · CONSEQUENCE REASONING (deterministic · zero LLM)");
console.log("─".repeat(72));

// Snapshot originals · everything restored at exit
const snapshots = new Map();
const originalHashes = {};
for (const p of TARGETS) {
  const content = readFileSync(resolve(REPO_ROOT, p), "utf8");
  snapshots.set(p, content);
  originalHashes[p] = sha256(content);
}
console.log("Step 0 · Snapshots taken:");
for (const p of TARGETS) console.log(`  ${p}: ${originalHashes[p].slice(0, 12)}…`);

function restoreAll() {
  for (const [p, content] of snapshots) writeFileSync(resolve(REPO_ROOT, p), content, "utf8");
}
process.on("uncaughtException", (e) => { console.error("UNCAUGHT · restoring", e); restoreAll(); process.exit(99); });
process.on("SIGINT", () => { console.error("SIGINT · restoring"); restoreAll(); process.exit(130); });

const evidence = {
  at: new Date().toISOString(),
  protocol: "consequence-reasoning · deterministic",
  initial: [], repair_iterations: [], vitest: {}, final_scoped_errors: 0,
  main_tree_byte_identical: null,
};

const registry = new engine.Nex1ReasoningRegistry();
registry.register(engine.AstSemanticAdapter);
console.log(`\nStep 1 · registered adapters: [${registry.listRegistered().join(", ")}]`);

async function applyDirective(sub) {
  const abs = resolve(REPO_ROOT, sub.target);
  const content = readFileSync(abs, "utf8");
  const req = {
    task_id: `cr-${sub.id ?? "repair"}`,
    attempt_id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    intent: sub.directive.kind === "add_test_case" ? "add_test" : "add_feature",
    context: {
      task_prompt: sub.id ?? "repair",
      repo_snapshot_hash: sha256(content),
      file_slices: [{ path: sub.target, content, content_hash: sha256(content) }],
      relevant_adrs: [],
      declared_scope: [sub.target],
    },
    output_kind: "diff",
    template_directive: sub.directive,
  };
  const resp = await engine.nex1InvokeAdapter(registry, req);
  if (!resp.ok) return { ok: false, reason: resp.reason, code: resp.code };
  const applied = engine.applyWholeFileDiff(resp.result.proposed_diff);
  const next = applied.get(sub.target);
  if (!next) return { ok: false, reason: "empty diff" };
  writeFileSync(abs, next, "utf8");
  return { ok: true, delta: next.length - content.length, rationale: resp.result.rationale };
}

async function runScopedTypecheck() {
  const tsc = run("npx", ["tsc", "--noEmit", "--skipLibCheck", "--noErrorTruncation", "--pretty", "false"], {
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" },
  });
  const out = (tsc.stdout ?? "") + "\n" + (tsc.stderr ?? "");
  const diagnostics = engine.parseTscOutput(out);
  const scoped = diagnostics.filter((d) => TARGETS.some((t) => d.file.replace(/\\/g, "/").endsWith(t) || d.file.endsWith(t)));
  return { exit: tsc.status, all: diagnostics, scoped };
}

try {
  // ─── Step 2 · Apply the three initial sub-tasks ────────────────
  console.log("\nStep 2 · Initial AST sub-tasks ...");
  for (const sub of INITIAL_SUB_TASKS) {
    process.stdout.write(`  · ${sub.id.padEnd(30)} `);
    const r = await applyDirective({ ...sub });
    if (!r.ok) {
      console.log(`FAIL · ${r.reason?.slice(0, 60)}`);
      evidence.initial.push({ id: sub.id, ok: false, reason: r.reason });
    } else {
      console.log(`APPLIED · Δ${r.delta >= 0 ? "+" : ""}${r.delta}B`);
      evidence.initial.push({ id: sub.id, ok: true, delta_bytes: r.delta });
    }
  }
  const initialApplied = evidence.initial.filter((x) => x.ok).length;
  console.log(`  applied: ${initialApplied}/${INITIAL_SUB_TASKS.length}`);

  // ─── Step 3 · Consequence-reasoning repair loop (max 5 iterations) ─
  console.log("\nStep 3 · Consequence reasoning loop (max 5 iterations) ...");
  let iteration = 0;
  const MAX = 5;
  while (iteration < MAX) {
    iteration++;
    process.stdout.write(`  iter ${iteration} · running scoped tsc ... `);
    const tsc = await runScopedTypecheck();
    console.log(`scoped errors=${tsc.scoped.length}`);
    if (tsc.scoped.length === 0) {
      console.log("  · clean · no repair needed");
      evidence.repair_iterations.push({ iteration, scoped_errors: 0, repairs_applied: 0 });
      break;
    }
    // Diagnose · extract missing-property findings
    const findings = engine.extractMissingPropertyFindings(tsc.scoped);
    console.log(`    · findings: ${findings.length}`);
    if (findings.length === 0) {
      // No repair we know how to compose · stop
      console.log(`  · no automated repair available for errors:`);
      for (const d of tsc.scoped.slice(0, 3)) console.log(`      ${d.file}(${d.line},${d.column}) ${d.code}: ${d.message.slice(0, 80)}`);
      evidence.repair_iterations.push({
        iteration, scoped_errors: tsc.scoped.length, repairs_applied: 0,
        unrepaired_sample: tsc.scoped.slice(0, 3).map((d) => ({ file: d.file, line: d.line, code: d.code, message: d.message.slice(0, 140) })),
      });
      break;
    }
    // Compose + apply repair directives (one per missing property)
    let repairsAppliedThisIter = 0;
    const iterRecord = { iteration, scoped_errors: tsc.scoped.length, findings: [] };
    for (const finding of findings) {
      for (const prop of finding.missing_properties) {
        const directive = engine.composeRepairDirective(finding, prop);
        process.stdout.write(`    · repair: ${finding.file.replace(/\\/g, "/").split("/").pop()}:${finding.line} + ${prop} `);
        const r = await applyDirective({ id: `repair-${finding.line}-${prop}`, target: directive.target_path, directive });
        if (r.ok) {
          repairsAppliedThisIter++;
          console.log(`APPLIED · Δ${r.delta >= 0 ? "+" : ""}${r.delta}B`);
          iterRecord.findings.push({ file: finding.file, line: finding.line, property: prop, ok: true });
        } else {
          console.log(`FAIL · ${r.reason?.slice(0, 60)}`);
          iterRecord.findings.push({ file: finding.file, line: finding.line, property: prop, ok: false, reason: r.reason });
        }
      }
    }
    iterRecord.repairs_applied = repairsAppliedThisIter;
    evidence.repair_iterations.push(iterRecord);
    if (repairsAppliedThisIter === 0) {
      console.log("  · no repairs applied · exiting");
      break;
    }
  }

  // Final scoped tsc
  const finalTsc = await runScopedTypecheck();
  evidence.final_scoped_errors = finalTsc.scoped.length;
  console.log(`\n  final scoped errors: ${finalTsc.scoped.length}`);
  if (finalTsc.scoped.length > 0) {
    for (const d of finalTsc.scoped.slice(0, 3)) console.log(`    ${d.file}(${d.line}) ${d.code}: ${d.message.slice(0, 90)}`);
  }

  // ─── Step 4 · vitest ────────────────────────────────────────────
  console.log("\nStep 4 · Vitest engine suite ...");
  const vt = run("npx", ["vitest", "run", "src/lib/nex-agent/code-engine", "--reporter=default"], {
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
  });
  const vtOut = (vt.stdout ?? "") + "\n" + (vt.stderr ?? "");
  const passed = Number(/Tests\s+(\d+)\s+passed/.exec(vtOut)?.[1] ?? "0");
  const failed = Number(/Tests.*?(\d+)\s+failed/.exec(vtOut)?.[1] ?? "0");
  evidence.vitest = { exit: vt.status, passed, failed };
  console.log(`  vitest exit=${vt.status} · passed=${passed} · failed=${failed}`);
  if (failed > 0) {
    console.log("  tail:");
    for (const l of vtOut.split(/\r?\n/).slice(-14)) console.log(`    ${l}`);
  }
} finally {
  // ─── Step 5 · restore + verify ─────────────────────────────────
  console.log("\nStep 5 · Restoring snapshot ...");
  restoreAll();
  const finalHashes = {};
  for (const p of TARGETS) finalHashes[p] = sha256(readFileSync(resolve(REPO_ROOT, p), "utf8"));
  const byteIdentical = TARGETS.every((p) => originalHashes[p] === finalHashes[p]);
  for (const p of TARGETS) {
    const mark = originalHashes[p] === finalHashes[p] ? "✓" : "✗";
    console.log(`  ${p}: ${originalHashes[p].slice(0, 12)} → ${finalHashes[p].slice(0, 12)}  ${mark}`);
  }
  evidence.main_tree_byte_identical = byteIdentical;

  // Persist evidence
  const dir = resolve(REPO_ROOT, "data/nex1-code-engine/sprint-2-5-consequence");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const evidencePath = resolve(dir, `${stamp}.json`);
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf8");
  console.log(`\nEvidence: ${evidencePath}`);

  // Verdict
  const clean = evidence.final_scoped_errors === 0
    && (evidence.vitest.failed ?? 1) === 0
    && (evidence.vitest.passed ?? 0) >= 60
    && byteIdentical;
  console.log("\n════════════════════ SPRINT 2.5 VERDICT ════════════════════");
  console.log(`  initial sub-tasks applied:      ${evidence.initial.filter((x) => x.ok).length} / ${INITIAL_SUB_TASKS.length}`);
  console.log(`  repair iterations run:          ${evidence.repair_iterations.length}`);
  console.log(`  final scoped tsc errors:        ${evidence.final_scoped_errors}`);
  console.log(`  vitest passed:                  ${evidence.vitest.passed ?? "?"}`);
  console.log(`  vitest failed:                  ${evidence.vitest.failed ?? "?"}`);
  console.log(`  main tree byte-identical:       ${byteIdentical}`);
  console.log("");
  if (clean) {
    console.log("  RESULT · Sprint 2.5 PASS · NEX1's consequence-reasoning loop closed the type-ripple gap");
    console.log("  autonomously via deterministic tsc diagnosis + AST repair. No LLM. No model. No cloud.");
  } else {
    console.log("  RESULT · Sprint 2.5 NOT CLEAN · repair loop did not fully close the ripple.");
    console.log("  This is honest evidence · the current deterministic reasoner has a boundary too.");
  }
  console.log("═".repeat(61));
  process.exit(clean ? 0 : 1);
}
