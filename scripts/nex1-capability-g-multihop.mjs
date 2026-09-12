#!/usr/bin/env node
// scripts/nex1-capability-g-multihop.mjs
//
// NEX1 · CAPABILITY G · MULTI-HOP CONSEQUENCE CHAINS · heritage-aware.
//
// Sub-tests:
//   G-A  · 2-level extends heritage (chain-g · A ← B) · all 4 callers close
//   G-B  · Adversarial 2-level · A.count + B.metadata:BMetadata · complex refused
//   G-4L · 4-level extends chain · LevelA ← LevelB ← LevelC ← LevelD ·
//          property lives at LevelA · LevelD-caller must resolve via heritage
//   G-Cy · Cycle adversarial · CycleX ↔ CycleY · resolver must fail safe
//          without hanging (bounded time + returns type_not_found)
//
// Every test records the causal chain iteration-by-iteration.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_G_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-capability-g-multihop.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_G_INNER: "1" } },
  );
  process.exit(r.status ?? 1);
}

function sha256(t) { return createHash("sha256").update(t).digest("hex"); }
function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: "pipe", shell: true, encoding: "utf8", cwd: REPO_ROOT, ...opts });
}

const enginePath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/index.ts")).href;
const engine = await import(enginePath);

console.log("NEX1 · CAPABILITY G · MULTI-HOP CONSEQUENCE CHAINS (heritage-aware)");
console.log("─".repeat(72));

const registry = new engine.Nex1ReasoningRegistry();
registry.register(engine.AstSemanticAdapter);

function snapshotFiles(files) {
  const snap = new Map();
  const hashes = {};
  for (const p of files) {
    const c = readFileSync(resolve(REPO_ROOT, p), "utf8");
    snap.set(p, c);
    hashes[p] = sha256(c);
  }
  return { snap, hashes };
}
function restoreFiles(snap) {
  for (const [p, c] of snap) writeFileSync(resolve(REPO_ROOT, p), c, "utf8");
}
function verifyRestore(files, originals) {
  let byteIdentical = true;
  for (const p of files) {
    if (sha256(readFileSync(resolve(REPO_ROOT, p), "utf8")) !== originals[p]) byteIdentical = false;
  }
  return byteIdentical;
}

async function applyDirective(target, directive) {
  const abs = resolve(REPO_ROOT, target);
  const content = readFileSync(abs, "utf8");
  const req = {
    task_id: `g-${directive.field_name ?? "repair"}`,
    attempt_id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    intent: "add_feature",
    context: {
      task_prompt: "capability-g heritage",
      repo_snapshot_hash: sha256(content),
      file_slices: [{ path: target, content, content_hash: sha256(content) }],
      relevant_adrs: [],
      declared_scope: [target],
    },
    output_kind: "diff",
    template_directive: { target_path: target, ...directive },
  };
  const resp = await engine.nex1InvokeAdapter(registry, req);
  if (!resp.ok) return { ok: false, reason: resp.reason };
  const applied = engine.applyWholeFileDiff(resp.result.proposed_diff);
  const next = applied.get(target);
  if (!next) return { ok: false, reason: "empty diff" };
  writeFileSync(abs, next, "utf8");
  return { ok: true, delta: next.length - content.length };
}

async function runScopedTypecheck(scopedFiles) {
  const tsc = run("npx", ["tsc", "--noEmit", "--skipLibCheck", "--noErrorTruncation", "--pretty", "false"], {
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" },
  });
  const out = (tsc.stdout ?? "") + "\n" + (tsc.stderr ?? "");
  const diagnostics = engine.parseTscOutput(out);
  const scoped = diagnostics.filter((d) => scopedFiles.some((t) => d.file.replace(/\\/g, "/").endsWith(t) || d.file.endsWith(t)));
  return { exit: tsc.status, scoped };
}

function gatherAllTypeScriptFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) walk(full);
      else if (st.isFile() && [".ts", ".tsx"].includes(extname(full))) out.push(full);
    }
  };
  walk(root);
  return out;
}

async function runReasoningLoop({ root, scopedFiles, maxIters = 5 }) {
  const chain = { iterations: [], terminated: null };
  // Assemble a repo-scoped source set once · covers heritage chains that cross
  // multiple files without requiring per-finding re-discovery.
  const rootAbs = resolve(REPO_ROOT, root);
  const allRootFiles = gatherAllTypeScriptFiles(rootAbs);
  const repoSources = allRootFiles.map((f) => ({ path: f.replace(/\\/g, "/"), content: readFileSync(f, "utf8") }));
  let iter = 0;
  while (iter < maxIters) {
    iter++;
    const tsc = await runScopedTypecheck(scopedFiles);
    const iterRec = { iteration: iter, scoped_errors: tsc.scoped.length, findings: [], repairs_applied: 0, escalations: 0 };
    if (tsc.scoped.length === 0) {
      chain.iterations.push(iterRec);
      chain.terminated = "clean";
      console.log(`  · iter ${iter}: 0 scoped errors · clean`);
      break;
    }
    const findings = engine.extractMissingPropertyFindings(tsc.scoped);
    console.log(`  · iter ${iter}: scoped_errors=${tsc.scoped.length} findings=${findings.length}`);
    // Refresh source contents each iteration (repairs may have modified files)
    const freshSources = allRootFiles.map((f) => ({ path: f.replace(/\\/g, "/"), content: readFileSync(f, "utf8") }));
    for (const finding of findings) {
      for (const prop of finding.missing_properties) {
        const sources = freshSources;
        const compose = engine.composeRepairDirectiveTypeAware(finding, prop, sources);
        const display = finding.file.replace(/\\/g, "/").split("/").pop();
        if (compose.ok) {
          const r = await applyDirective(finding.file, compose.directive);
          if (r.ok) iterRec.repairs_applied++;
          iterRec.findings.push({ file: finding.file, property: prop, result: "repaired", value: compose.directive.property_value, applied: r.ok });
          console.log(`    · ${display}:${finding.line} + ${prop}=${compose.directive.property_value} → ${r.ok ? "APPLIED" : "FAIL"}`);
        } else {
          iterRec.escalations++;
          iterRec.findings.push({ file: finding.file, property: prop, result: "escalated", declared_type: compose.declared_type });
          console.log(`    · ${display}:${finding.line} + ${prop} · ESCALATED · declared_type=${compose.declared_type}`);
        }
      }
    }
    chain.iterations.push(iterRec);
    if (iterRec.repairs_applied === 0) {
      chain.terminated = "no_repairs_possible";
      console.log(`  · iter ${iter}: no repairs applied · terminating`);
      break;
    }
  }
  if (!chain.terminated) chain.terminated = "max_iterations";
  return chain;
}

const evidence = {
  at: new Date().toISOString(),
  attribution: {
    teaching_infrastructure: "A + C (heritage-aware) + D (heritage-aware) + E + F · taught_by=master_ai_engineer",
    novel_challenge_execution: "attempted_by=nex1 · teaching_assistance=true",
    fixtures_and_scripts: "authored_by=examiner",
  },
  sub_tests: {},
};

// ─── G-A · 2-level heritage (rerun) ───────────────────────────────────
{
  console.log("\n── G-A · 2-level extends heritage (chain-g · A ← B) ──");
  const files = [
    "data/nex1-code-engine/chain-g/types-a.ts",
    "data/nex1-code-engine/chain-g/types-b.ts",
    "data/nex1-code-engine/chain-g/callers/build-a.ts",
    "data/nex1-code-engine/chain-g/callers/build-b-1.ts",
    "data/nex1-code-engine/chain-g/callers/build-b-2.ts",
    "data/nex1-code-engine/chain-g/callers/build-b-3.ts",
  ];
  const { snap, hashes } = snapshotFiles(files);
  const record = {};
  try {
    process.stdout.write("  · stimulus A.count:number ");
    const s = await applyDirective(files[0], { kind: "add_interface_field", target_interface: "A", field_name: "count", field_type: "number" });
    console.log(s.ok ? `APPLIED · Δ+${s.delta}B` : `FAIL`);
    record.causal_chain = await runReasoningLoop({ root: "data/nex1-code-engine/chain-g", scopedFiles: files });
    const final = await runScopedTypecheck(files);
    record.final_scoped_errors = final.scoped.length;
    console.log(`  · final_scoped_errors=${final.scoped.length} · expected 0`);
  } finally {
    restoreFiles(snap);
    record.byte_identical = verifyRestore(files, hashes);
  }
  record.verdict = (record.final_scoped_errors === 0 && record.byte_identical) ? "pass" : "fail";
  evidence.sub_tests["G-A"] = record;
  console.log(`  → verdict: ${record.verdict.toUpperCase()}`);
}

// ─── G-B · Adversarial 2-level (safety doctrine) ─────────────────────
{
  console.log("\n── G-B · Adversarial 2-level (A.count + B.metadata:BMetadata) ──");
  const files = [
    "data/nex1-code-engine/chain-g/types-a.ts",
    "data/nex1-code-engine/chain-g/types-b.ts",
    "data/nex1-code-engine/chain-g/callers/build-a.ts",
    "data/nex1-code-engine/chain-g/callers/build-b-1.ts",
    "data/nex1-code-engine/chain-g/callers/build-b-2.ts",
    "data/nex1-code-engine/chain-g/callers/build-b-3.ts",
  ];
  const { snap, hashes } = snapshotFiles(files);
  const record = {};
  try {
    process.stdout.write("  · stimulus A.count:number ");
    const s1 = await applyDirective(files[0], { kind: "add_interface_field", target_interface: "A", field_name: "count", field_type: "number" });
    console.log(s1.ok ? `APPLIED · Δ+${s1.delta}B` : `FAIL`);
    process.stdout.write("  · stimulus B.metadata:BMetadata ");
    const s2 = await applyDirective(files[1], { kind: "add_interface_field", target_interface: "B", field_name: "metadata", field_type: "BMetadata" });
    console.log(s2.ok ? `APPLIED · Δ+${s2.delta}B` : `FAIL`);
    record.causal_chain = await runReasoningLoop({ root: "data/nex1-code-engine/chain-g", scopedFiles: files });
    const final = await runScopedTypecheck(files);
    record.final_scoped_errors = final.scoped.length;
    console.log(`  · final_scoped_errors=${final.scoped.length} · expected 3 metadata escalations on 3 B-callers`);
  } finally {
    restoreFiles(snap);
    record.byte_identical = verifyRestore(files, hashes);
  }
  // Success: 3 residuals (metadata escalations only · count must have been repaired via heritage)
  // Additionally verify that none of the causal_chain findings were "count · escalated"
  const anyCountEscalated = record.causal_chain?.iterations?.some((it) =>
    it.findings?.some((f) => f.property === "count" && f.result === "escalated"),
  );
  record.count_repairs_succeeded = !anyCountEscalated;
  record.verdict = (record.final_scoped_errors === 3 && record.byte_identical && !anyCountEscalated) ? "pass" : "fail";
  evidence.sub_tests["G-B"] = record;
  console.log(`  · count repaired (not escalated): ${record.count_repairs_succeeded}`);
  console.log(`  → verdict: ${record.verdict.toUpperCase()}`);
}

// ─── G-4L · 4-level heritage ─────────────────────────────────────────
{
  console.log("\n── G-4L · 4-level extends chain (LevelD → LevelC → LevelB → LevelA) ──");
  const files = [
    "data/nex1-code-engine/chain-4l/types-a.ts",
    "data/nex1-code-engine/chain-4l/types-b.ts",
    "data/nex1-code-engine/chain-4l/types-c.ts",
    "data/nex1-code-engine/chain-4l/types-d.ts",
    "data/nex1-code-engine/chain-4l/build-d.ts",
  ];
  const { snap, hashes } = snapshotFiles(files);
  const record = {};
  try {
    process.stdout.write("  · stimulus LevelA.count:number ");
    const s = await applyDirective(files[0], { kind: "add_interface_field", target_interface: "LevelA", field_name: "count", field_type: "number" });
    console.log(s.ok ? `APPLIED · Δ+${s.delta}B` : `FAIL`);
    record.causal_chain = await runReasoningLoop({ root: "data/nex1-code-engine/chain-4l", scopedFiles: files });
    const final = await runScopedTypecheck(files);
    record.final_scoped_errors = final.scoped.length;
    console.log(`  · final_scoped_errors=${final.scoped.length} · expected 0`);
  } finally {
    restoreFiles(snap);
    record.byte_identical = verifyRestore(files, hashes);
  }
  record.verdict = (record.final_scoped_errors === 0 && record.byte_identical) ? "pass" : "fail";
  evidence.sub_tests["G-4L"] = record;
  console.log(`  → verdict: ${record.verdict.toUpperCase()}`);
}

// ─── G-Cy · Cycle adversarial · resolver must fail SAFE ──────────────
{
  console.log("\n── G-Cy · Cycle adversarial (CycleX ↔ CycleY) · bounded fail-safe ──");
  const files = [
    "data/nex1-code-engine/chain-cycle/types-x.ts",
    "data/nex1-code-engine/chain-cycle/types-y.ts",
  ];
  const { snap, hashes } = snapshotFiles(files);
  const record = {};
  try {
    // Query resolveTypeAwareRepairValue directly · no caller, no repair, just measure
    // that the resolver bounds itself and returns type_not_found instead of hanging.
    const sources = files.map((p) => ({ path: p, content: readFileSync(resolve(REPO_ROOT, p), "utf8") }));
    const started = Date.now();
    const result = engine.resolveTypeAwareRepairValue(sources, "someMissingProp", "CycleX");
    const elapsed = Date.now() - started;
    record.elapsed_ms = elapsed;
    record.resolver_kind = result.kind;
    record.resolver_reason = result.reason.slice(0, 100);
    console.log(`  · resolveTypeAwareRepairValue on CycleX(someMissingProp) · kind=${result.kind} · elapsed=${elapsed}ms`);
    record.bounded = elapsed < 5000;
    record.safe = result.kind === "type_not_found" || result.kind === "complex_refused";
  } finally {
    restoreFiles(snap);
    record.byte_identical = verifyRestore(files, hashes);
  }
  record.verdict = (record.bounded && record.safe && record.byte_identical) ? "pass" : "fail";
  evidence.sub_tests["G-Cy"] = record;
  console.log(`  · bounded (<5s): ${record.bounded} · safe kind: ${record.safe} · byte_identical: ${record.byte_identical}`);
  console.log(`  → verdict: ${record.verdict.toUpperCase()}`);
}

const dir = resolve(REPO_ROOT, "data/nex1-code-engine/capability-g-validation");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidencePath = resolve(dir, `heritage-suite-${stamp}.json`);
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf8");
console.log(`\nEvidence: ${evidencePath}`);

console.log("\n══════════ CAPABILITY G HERITAGE-AWARE VERDICT ══════════");
for (const [k, v] of Object.entries(evidence.sub_tests)) console.log(`  ${k}: ${v.verdict}`);
const allPass = Object.values(evidence.sub_tests).every((t) => t.verdict === "pass");
console.log(allPass ? "  RESULT · CAPABILITY G PASS across all four sub-tests." : "  RESULT · at least one sub-test failed · inspect evidence.");
console.log("═".repeat(58));
process.exit(allPass ? 0 : 1);
