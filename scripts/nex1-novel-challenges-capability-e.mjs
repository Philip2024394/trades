#!/usr/bin/env node
// scripts/nex1-novel-challenges-capability-e.mjs
//
// NEX1 · CAPABILITY E · MULTI-FILE RIPPLE PROPAGATION · adversarial validation.
//
// Founder challenge (2026-09-12):
//   One shared-types.ts declares 5 interfaces (Alpha/Beta/Gamma/Delta/Epsilon).
//   Five caller files each construct one of those shapes via .map(...).
//   Stimuli add 5 required fields (one per interface, mixed types + complex).
//   NEX1 must:
//     · detect all downstream ripples across all caller files
//     · locate each repair site
//     · consult the declared type
//     · select type-valid repairs where safe
//     · REFUSE to fabricate for the complex custom type
//     · leave all fixtures byte-identical
//
// Honest first pass: uses the CURRENT teaching-assisted mechanisms as-is
// (Capability A · location, C · type-aware, D · introspection). No new
// capability is authored before observing what fails. If the current
// mechanisms cannot resolve types across files, the failure mode is the
// evidence that identifies the next teaching target.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_NCE_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-novel-challenges-capability-e.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_NCE_INNER: "1" } },
  );
  process.exit(r.status ?? 1);
}

function sha256(t) { return createHash("sha256").update(t).digest("hex"); }
function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: "pipe", shell: true, encoding: "utf8", cwd: REPO_ROOT, ...opts });
}

const enginePath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/index.ts")).href;
const engine = await import(enginePath);

const SHARED = "data/nex1-code-engine/challenge-e/shared-types.ts";
const CALLERS = [
  "data/nex1-code-engine/challenge-e/callers/alpha-caller.ts",
  "data/nex1-code-engine/challenge-e/callers/beta-caller.ts",
  "data/nex1-code-engine/challenge-e/callers/gamma-caller.ts",
  "data/nex1-code-engine/challenge-e/callers/delta-caller.ts",
  "data/nex1-code-engine/challenge-e/callers/epsilon-caller.ts",
];
const ALL_FILES = [SHARED, ...CALLERS];

const STIMULI = [
  { interface: "AlphaShape",   field_name: "priority", field_type: "number" },
  { interface: "BetaShape",    field_name: "category", field_type: "string" },
  { interface: "GammaShape",   field_name: "enabled",  field_type: "boolean" },
  { interface: "DeltaShape",   field_name: "tags",     field_type: "string[]" },
  { interface: "EpsilonShape", field_name: "config",   field_type: "EpsilonConfig" },
];

console.log("NEX1 · CAPABILITY E · MULTI-FILE RIPPLE PROPAGATION (adversarial)");
console.log("─".repeat(72));

const snapshots = new Map();
const originalHashes = {};
for (const p of ALL_FILES) {
  const content = readFileSync(resolve(REPO_ROOT, p), "utf8");
  snapshots.set(p, content);
  originalHashes[p] = sha256(content);
}
console.log("Step 0 · Snapshots taken across shared-types + 5 callers");

function restoreAll() {
  for (const [p, content] of snapshots) writeFileSync(resolve(REPO_ROOT, p), content, "utf8");
}
process.on("uncaughtException", (e) => { console.error("UNCAUGHT · restoring", e); restoreAll(); process.exit(99); });
process.on("SIGINT", () => { console.error("SIGINT · restoring"); restoreAll(); process.exit(130); });

const evidence = {
  at: new Date().toISOString(),
  challenge: "capability-e · multi-file ripple propagation",
  attribution: {
    teaching_infrastructure: "A=claude_reviewer · C,D=master_ai_engineer",
    novel_challenge_execution: "attempted_by=nex1 · teaching_assistance=true",
    fixtures_and_scripts: "authored_by=examiner",
  },
  stimuli_applied: [],
  ripple_detection: null,
  repair_attempts: [],
  final_tsc_scoped_errors: null,
  fixtures_byte_identical: null,
  gap_findings: [],
};

const registry = new engine.Nex1ReasoningRegistry();
registry.register(engine.AstSemanticAdapter);

async function applyDirective(target, directive) {
  const abs = resolve(REPO_ROOT, target);
  const content = readFileSync(abs, "utf8");
  const req = {
    task_id: `nce-${directive.field_name ?? directive.property_name ?? "repair"}`,
    attempt_id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    intent: "add_feature",
    context: {
      task_prompt: "capability-e multi-file validation",
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

async function runScopedTypecheck() {
  const tsc = run("npx", ["tsc", "--noEmit", "--skipLibCheck", "--noErrorTruncation", "--pretty", "false"], {
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" },
  });
  const out = (tsc.stdout ?? "") + "\n" + (tsc.stderr ?? "");
  const diagnostics = engine.parseTscOutput(out);
  const scoped = diagnostics.filter((d) => ALL_FILES.some((t) => d.file.replace(/\\/g, "/").endsWith(t) || d.file.endsWith(t)));
  return { exit: tsc.status, all: diagnostics, scoped };
}

try {
  // ── Step 1 · apply 5 interface-field stimuli to shared-types.ts ──
  console.log("\nStep 1 · Applying 5 stimuli to shared-types.ts ...");
  for (const st of STIMULI) {
    process.stdout.write(`  · ${st.interface}.${st.field_name}: ${st.field_type.padEnd(15)} `);
    const s = await applyDirective(SHARED, {
      kind: "add_interface_field",
      target_interface: st.interface,
      field_name: st.field_name,
      field_type: st.field_type,
    });
    console.log(s.ok ? `APPLIED · Δ+${s.delta}B` : `FAIL · ${s.reason?.slice(0, 60)}`);
    evidence.stimuli_applied.push({ ...st, ok: s.ok, delta_bytes: s.ok ? s.delta : null });
  }

  // ── Step 2 · discover downstream ripples ──
  console.log("\nStep 2 · Running scoped tsc to discover ripples ...");
  const tsc1 = await runScopedTypecheck();
  console.log(`  · scoped errors: ${tsc1.scoped.length}`);
  const perFileCounts = {};
  for (const d of tsc1.scoped) {
    const key = d.file.replace(/\\/g, "/").split("/").slice(-2).join("/");
    perFileCounts[key] = (perFileCounts[key] ?? 0) + 1;
  }
  for (const [k, v] of Object.entries(perFileCounts)) console.log(`    ${k}: ${v}`);
  evidence.ripple_detection = { scoped_errors: tsc1.scoped.length, per_file: perFileCounts };

  const findings = engine.extractMissingPropertyFindings(tsc1.scoped);
  console.log(`  · findings extracted: ${findings.length}`);

  // ── Step 3 · repair loop with type-aware composer · MULTI-SOURCE input ──
  // Cross-file (taught_by=master_ai_engineer · 2026-09-12): pass both the
  // caller file and shared-types.ts so NEX1 can find the interface
  // declaration wherever it lives.
  console.log("\nStep 3 · Attempting per-finding repair via composeRepairDirectiveTypeAware (multi-source) ...");
  const sharedAbs = resolve(REPO_ROOT, SHARED);
  const sharedContent = readFileSync(sharedAbs, "utf8");
  for (const finding of findings) {
    for (const prop of finding.missing_properties) {
      const callerAbs = resolve(REPO_ROOT, finding.file);
      const callerSource = readFileSync(callerAbs, "utf8");
      const sources = [
        { path: finding.file, content: callerSource },
        { path: SHARED, content: sharedContent },
      ];
      const composeResult = engine.composeRepairDirectiveTypeAware(finding, prop, sources);
      const displayFile = finding.file.replace(/\\/g, "/").split("/").slice(-2).join("/");
      if (!composeResult.ok) {
        console.log(`  · ${displayFile}:${finding.line} + ${prop} · ESCALATED · declared_type=${composeResult.declared_type ?? "(null)"} · ${composeResult.reason.slice(0, 60)}`);
        evidence.repair_attempts.push({
          file: finding.file, line: finding.line, property: prop,
          composer_result: "escalated",
          declared_type: composeResult.declared_type,
          reason: composeResult.reason,
        });
      } else {
        console.log(`  · ${displayFile}:${finding.line} + ${prop} · value=${composeResult.directive.property_value}`);
        const r = await applyDirective(finding.file, composeResult.directive);
        evidence.repair_attempts.push({
          file: finding.file, line: finding.line, property: prop,
          composer_result: composeResult.source,
          repair_value: composeResult.directive.property_value,
          applied: r.ok,
          delta_bytes: r.ok ? r.delta : null,
        });
        console.log(`    ${r.ok ? "APPLIED · Δ+" + r.delta + "B" : "FAIL · " + r.reason?.slice(0, 60)}`);
      }
    }
  }

  // ── Step 4 · post-repair scoped tsc ──
  console.log("\nStep 4 · Post-repair scoped tsc ...");
  const tsc2 = await runScopedTypecheck();
  console.log(`  · scoped errors: ${tsc2.scoped.length}`);
  const post = {};
  for (const d of tsc2.scoped) {
    const key = d.file.replace(/\\/g, "/").split("/").slice(-2).join("/");
    post[key] = (post[key] ?? 0) + 1;
  }
  for (const [k, v] of Object.entries(post)) console.log(`    ${k}: ${v}`);
  evidence.final_tsc_scoped_errors = { count: tsc2.scoped.length, per_file: post };

  // ── Step 5 · Capability D introspection on any remaining errors ──
  console.log("\nStep 5 · Capability D introspection on remaining errors ...");
  const attemptedRepairs = evidence.repair_attempts
    .filter((r) => r.applied)
    .map((r) => ({ property_name: r.property, property_value: r.repair_value }));
  const sharedForD = readFileSync(resolve(REPO_ROOT, SHARED), "utf8");
  for (const d of tsc2.scoped) {
    const callerAbs = resolve(REPO_ROOT, d.file);
    let callerSource = "";
    try { callerSource = readFileSync(callerAbs, "utf8"); } catch { /* diagnostic may reference the shared file */ }
    const introspectionSources = [
      { path: d.file, content: callerSource },
      { path: SHARED, content: sharedForD },
    ];
    const desc = engine.extractGapDescriptor(d, attemptedRepairs, introspectionSources);
    const displayFile = d.file.replace(/\\/g, "/").split("/").slice(-2).join("/");
    console.log(`  · ${displayFile}:${d.line} · ${d.code} · gap=${desc.gap_kind} · declared_type=${desc.declared_field_type ?? "(null)"}`);
    evidence.gap_findings.push({
      file: d.file, line: d.line, code: d.code,
      gap_kind: desc.gap_kind,
      declared_field_type: desc.declared_field_type,
      missing_information: desc.missing_information,
    });
  }
} finally {
  console.log("\nStep 6 · Restoring all fixtures ...");
  restoreAll();
  const finalHashes = {};
  for (const p of ALL_FILES) finalHashes[p] = sha256(readFileSync(resolve(REPO_ROOT, p), "utf8"));
  const byteIdentical = ALL_FILES.every((p) => originalHashes[p] === finalHashes[p]);
  for (const p of ALL_FILES) {
    const mark = originalHashes[p] === finalHashes[p] ? "✓" : "✗";
    console.log(`  ${p.replace(/^data\/nex1-code-engine\/challenge-e\//, "")}: ${originalHashes[p].slice(0, 12)} → ${finalHashes[p].slice(0, 12)}  ${mark}`);
  }
  evidence.fixtures_byte_identical = byteIdentical;

  const dir = resolve(REPO_ROOT, "data/nex1-code-engine/capability-e-validation");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const evidencePath = resolve(dir, `evidence-${stamp}.json`);
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf8");
  console.log(`\nEvidence: ${evidencePath}`);

  const totalFindings = evidence.repair_attempts.length;
  const applied = evidence.repair_attempts.filter((r) => r.applied).length;
  const escalated = evidence.repair_attempts.filter((r) => r.composer_result === "escalated").length;
  const clean = evidence.final_tsc_scoped_errors?.count === 1 // expected: 1 remaining (the complex refused case)
    && byteIdentical;

  console.log("\n════════════ CAPABILITY E MULTI-FILE VERDICT ════════════");
  console.log(`  stimuli applied:                ${evidence.stimuli_applied.filter((s) => s.ok).length} / ${STIMULI.length}`);
  console.log(`  ripples detected:               ${totalFindings}`);
  console.log(`  repairs applied:                ${applied}`);
  console.log(`  escalations (refused):          ${escalated}`);
  console.log(`  post-repair scoped errors:      ${evidence.final_tsc_scoped_errors?.count ?? "?"}`);
  console.log(`  all fixtures byte-identical:    ${byteIdentical}`);
  console.log("");
  if (clean) {
    console.log("  RESULT · Capability E PASSES · A+C+D composed correctly across 5 files.");
  } else {
    console.log("  RESULT · Capability E NOT CLEAN · honest failure mode captured. Inspect");
    console.log("  the evidence file to identify the specific missing capability before");
    console.log("  proposing any teaching intervention.");
  }
  console.log("═".repeat(59));
  process.exit(clean ? 0 : 1);
}
