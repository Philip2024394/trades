#!/usr/bin/env node
// scripts/nex1-novel-challenge-capability-a.mjs
//
// NEX1 Capability A · NOVEL CHALLENGE · deterministic · zero model.
//
// Independence measurement (2026-09-12):
//   After the teacher-authored Capability A bootstrap in ast-semantic.ts
//   (findEnclosingObjectLiteralAdjacent), verify whether NEX1 can now
//   autonomously close a NEW interface-change ripple without any further
//   teacher intervention. Different file, different interface, different
//   constructor helper. Same underlying capability class.
//
// No teacher may write or modify the reasoner/adapter/engine during
// this run. The script writes only into the fixture file that IS the
// challenge target, and restores it byte-identical at exit.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_NC_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-novel-challenge-capability-a.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_NC_INNER: "1" } },
  );
  process.exit(r.status ?? 1);
}

function sha256(t) { return createHash("sha256").update(t).digest("hex"); }
function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: "pipe", shell: true, encoding: "utf8", cwd: REPO_ROOT, ...opts });
}

const enginePath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/index.ts")).href;
const engine = await import(enginePath);

const FIXTURE_PATH = "data/nex1-code-engine/novel-challenge/widget-source.ts";
const TARGETS = [FIXTURE_PATH];

// The novel-challenge stimulus: add a required `priority: number` field to
// interface Widget. This forces makeWidgets() -> Widget[] to break because
// its map(...) callback returns `({ id, label })` without `priority`.
// tsc emits TS2322 at the ArrowFunction/ParenthesizedExpression position,
// which lands 1 char before the ObjectLiteralExpression's `{` — exactly the
// scenario Capability A was taught to handle.
const CHALLENGE_STIMULUS = {
  id: "add-required-field-to-widget",
  target: FIXTURE_PATH,
  directive: {
    kind: "add_interface_field",
    target_path: FIXTURE_PATH,
    target_interface: "Widget",
    field_name: "priority",
    field_type: "number",
  },
};

console.log("NEX1 · CAPABILITY A · NOVEL CHALLENGE (deterministic · zero LLM)");
console.log("─".repeat(72));

const snapshots = new Map();
const originalHashes = {};
for (const p of TARGETS) {
  const content = readFileSync(resolve(REPO_ROOT, p), "utf8");
  snapshots.set(p, content);
  originalHashes[p] = sha256(content);
}
console.log("Step 0 · Snapshot taken:");
for (const p of TARGETS) console.log(`  ${p}: ${originalHashes[p].slice(0, 12)}…`);

function restoreAll() {
  for (const [p, content] of snapshots) writeFileSync(resolve(REPO_ROOT, p), content, "utf8");
}
process.on("uncaughtException", (e) => { console.error("UNCAUGHT · restoring", e); restoreAll(); process.exit(99); });
process.on("SIGINT", () => { console.error("SIGINT · restoring"); restoreAll(); process.exit(130); });

const evidence = {
  at: new Date().toISOString(),
  challenge: "Capability A · novel · widget interface",
  attribution: "nex1 · post-teaching · independence measurement",
  stimulus: [],
  repair_iterations: [],
  final_scoped_errors: 0,
  fixture_byte_identical: null,
};

const registry = new engine.Nex1ReasoningRegistry();
registry.register(engine.AstSemanticAdapter);
console.log(`\nStep 1 · registered adapters: [${registry.listRegistered().join(", ")}]`);

async function applyDirective(sub) {
  const abs = resolve(REPO_ROOT, sub.target);
  const content = readFileSync(abs, "utf8");
  const req = {
    task_id: `nc-${sub.id ?? "repair"}`,
    attempt_id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    intent: "add_feature",
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
  console.log("\nStep 2 · Apply stimulus (add required field to interface) ...");
  process.stdout.write(`  · ${CHALLENGE_STIMULUS.id.padEnd(36)} `);
  const r = await applyDirective(CHALLENGE_STIMULUS);
  if (!r.ok) {
    console.log(`FAIL · ${r.reason?.slice(0, 60)}`);
    evidence.stimulus.push({ id: CHALLENGE_STIMULUS.id, ok: false, reason: r.reason });
  } else {
    console.log(`APPLIED · Δ${r.delta >= 0 ? "+" : ""}${r.delta}B`);
    evidence.stimulus.push({ id: CHALLENGE_STIMULUS.id, ok: true, delta_bytes: r.delta });
  }

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
    const findings = engine.extractMissingPropertyFindings(tsc.scoped);
    console.log(`    · findings: ${findings.length}`);
    if (findings.length === 0) {
      for (const d of tsc.scoped.slice(0, 3)) console.log(`      ${d.file}(${d.line},${d.column}) ${d.code}: ${d.message.slice(0, 80)}`);
      evidence.repair_iterations.push({
        iteration, scoped_errors: tsc.scoped.length, repairs_applied: 0,
        unrepaired_sample: tsc.scoped.slice(0, 3).map((d) => ({ file: d.file, line: d.line, code: d.code, message: d.message.slice(0, 140) })),
      });
      break;
    }
    let repairsAppliedThisIter = 0;
    const iterRecord = { iteration, scoped_errors: tsc.scoped.length, findings: [] };
    for (const finding of findings) {
      for (const prop of finding.missing_properties) {
        const directive = engine.composeRepairDirective(finding, prop);
        process.stdout.write(`    · repair: ${finding.file.replace(/\\/g, "/").split("/").pop()}:${finding.line} + ${prop} `);
        const r2 = await applyDirective({ id: `repair-${finding.line}-${prop}`, target: directive.target_path, directive });
        if (r2.ok) {
          repairsAppliedThisIter++;
          console.log(`APPLIED · Δ${r2.delta >= 0 ? "+" : ""}${r2.delta}B`);
          iterRecord.findings.push({ file: finding.file, line: finding.line, property: prop, ok: true });
        } else {
          console.log(`FAIL · ${r2.reason?.slice(0, 60)}`);
          iterRecord.findings.push({ file: finding.file, line: finding.line, property: prop, ok: false, reason: r2.reason });
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

  const finalTsc = await runScopedTypecheck();
  evidence.final_scoped_errors = finalTsc.scoped.length;
  console.log(`\n  final scoped errors: ${finalTsc.scoped.length}`);
  if (finalTsc.scoped.length > 0) {
    for (const d of finalTsc.scoped.slice(0, 3)) console.log(`    ${d.file}(${d.line}) ${d.code}: ${d.message.slice(0, 90)}`);
  }
} finally {
  console.log("\nStep 4 · Restoring fixture snapshot ...");
  restoreAll();
  const finalHashes = {};
  for (const p of TARGETS) finalHashes[p] = sha256(readFileSync(resolve(REPO_ROOT, p), "utf8"));
  const byteIdentical = TARGETS.every((p) => originalHashes[p] === finalHashes[p]);
  for (const p of TARGETS) {
    const mark = originalHashes[p] === finalHashes[p] ? "✓" : "✗";
    console.log(`  ${p}: ${originalHashes[p].slice(0, 12)} → ${finalHashes[p].slice(0, 12)}  ${mark}`);
  }
  evidence.fixture_byte_identical = byteIdentical;

  const dir = resolve(REPO_ROOT, "data/nex1-code-engine/novel-challenge");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const evidencePath = resolve(dir, `evidence-${stamp}.json`);
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf8");
  console.log(`\nEvidence: ${evidencePath}`);

  const clean = evidence.final_scoped_errors === 0 && byteIdentical;
  console.log("\n════════════════ NOVEL CHALLENGE VERDICT ════════════════");
  console.log(`  stimulus applied:              ${evidence.stimulus.filter((x) => x.ok).length} / 1`);
  console.log(`  repair iterations run:         ${evidence.repair_iterations.length}`);
  console.log(`  final scoped tsc errors:       ${evidence.final_scoped_errors}`);
  console.log(`  fixture byte-identical:        ${byteIdentical}`);
  console.log("");
  if (clean) {
    console.log("  RESULT · INDEPENDENT CAPABILITY DEMONSTRATED · NEX1 closed a fresh");
    console.log("  interface-change ripple on a different symbol/file autonomously.");
    console.log("  Taught mechanism executed; no teacher edits during this run.");
  } else {
    console.log("  RESULT · INDEPENDENT CAPABILITY NOT DEMONSTRATED · the taught");
    console.log("  mechanism did not generalise on this novel target. Honest record.");
  }
  console.log("═".repeat(58));
  process.exit(clean ? 0 : 1);
}
