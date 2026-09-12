#!/usr/bin/env node
// scripts/nex1-novel-e-generalisation.mjs
//
// NEX1 · CAPABILITY E · NOVEL GENERALISATION CHALLENGE · zero teacher edits.
//
// Fresh symbols, fresh interface names, fresh caller filenames, fresh
// property names, fresh type combinations (including a readonly array).
// The taught cross-file mechanism (multi-source resolveTypeAwareRepairValue)
// is executed against a completely unseen fixture set. No teacher writes
// or modifies engine code during this run. The script authors the
// examiner fixture — NEX1 owns the code decisions.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_NEG_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-novel-e-generalisation.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_NEG_INNER: "1" } },
  );
  process.exit(r.status ?? 1);
}

function sha256(t) { return createHash("sha256").update(t).digest("hex"); }
function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: "pipe", shell: true, encoding: "utf8", cwd: REPO_ROOT, ...opts });
}

const enginePath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/index.ts")).href;
const engine = await import(enginePath);

const SHARED = "data/nex1-code-engine/novel-e/schema.ts";
const CALLERS = [
  "data/nex1-code-engine/novel-e/reservation-builder.ts",
  "data/nex1-code-engine/novel-e/vehicle-fleet.ts",
  "data/nex1-code-engine/novel-e/payment-log.ts",
  "data/nex1-code-engine/novel-e/location-index.ts",
  "data/nex1-code-engine/novel-e/wildcard-registry.ts",
];
const ALL_FILES = [SHARED, ...CALLERS];

// Novel stimulus set · none match the Capability E training set:
//   - different interface names
//   - different property names
//   - readonly array (new adversarial pattern)
//   - complex nested type (ReservationMeta lives in schema.ts alongside)
const STIMULI = [
  { interface: "Reservation",    field_name: "guests",   field_type: "number",           expect_kind: "primitive_or_array" },
  { interface: "Vehicle",        field_name: "model",    field_type: "string",           expect_kind: "primitive_or_array" },
  { interface: "Payment",        field_name: "refunded", field_type: "boolean",          expect_kind: "primitive_or_array" },
  { interface: "LocationRecord", field_name: "tags",     field_type: "readonly string[]",expect_kind: "primitive_or_array" },
  { interface: "WildcardRow",    field_name: "meta",     field_type: "ReservationMeta",  expect_kind: "escalate" },
];

console.log("NEX1 · CAPABILITY E · NOVEL GENERALISATION CHALLENGE");
console.log("─".repeat(72));

const snapshots = new Map();
const originalHashes = {};
for (const p of ALL_FILES) {
  const content = readFileSync(resolve(REPO_ROOT, p), "utf8");
  snapshots.set(p, content);
  originalHashes[p] = sha256(content);
}

function restoreAll() {
  for (const [p, content] of snapshots) writeFileSync(resolve(REPO_ROOT, p), content, "utf8");
}
process.on("uncaughtException", (e) => { console.error("UNCAUGHT · restoring", e); restoreAll(); process.exit(99); });
process.on("SIGINT", () => { console.error("SIGINT · restoring"); restoreAll(); process.exit(130); });

const evidence = {
  at: new Date().toISOString(),
  challenge: "capability-e · novel generalisation · zero teacher edits during execution",
  attribution: {
    teaching_infrastructure_used: "capability-c-type-aware-repair.ts + capability-d-introspection.ts (multi-source · taught_by=master_ai_engineer · authored earlier)",
    novel_challenge_execution: "attempted_by=nex1 · teaching_assistance=true",
    fixtures_and_scripts: "authored_by=examiner",
    teacher_edits_during_this_run: "none",
  },
  stimuli_applied: [],
  repair_attempts: [],
  final_tsc_scoped_errors: null,
  fixtures_byte_identical: null,
};

const registry = new engine.Nex1ReasoningRegistry();
registry.register(engine.AstSemanticAdapter);

async function applyDirective(target, directive) {
  const abs = resolve(REPO_ROOT, target);
  const content = readFileSync(abs, "utf8");
  const req = {
    task_id: `neg-${directive.field_name ?? directive.property_name ?? "repair"}`,
    attempt_id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    intent: "add_feature",
    context: {
      task_prompt: "novel generalisation",
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
  return { exit: tsc.status, scoped };
}

try {
  console.log("Step 1 · Apply 5 novel stimuli to schema.ts ...");
  for (const st of STIMULI) {
    process.stdout.write(`  · ${st.interface}.${st.field_name}: ${st.field_type.padEnd(22)} `);
    const s = await applyDirective(SHARED, {
      kind: "add_interface_field",
      target_interface: st.interface,
      field_name: st.field_name,
      field_type: st.field_type,
    });
    console.log(s.ok ? `APPLIED · Δ+${s.delta}B` : `FAIL · ${s.reason?.slice(0, 60)}`);
    evidence.stimuli_applied.push({ ...st, ok: s.ok, delta_bytes: s.ok ? s.delta : null });
  }

  console.log("\nStep 2 · Discover cross-file ripples ...");
  const tsc1 = await runScopedTypecheck();
  console.log(`  · scoped errors: ${tsc1.scoped.length}`);
  const findings = engine.extractMissingPropertyFindings(tsc1.scoped);
  console.log(`  · findings: ${findings.length}`);

  console.log("\nStep 3 · Per-finding type-aware repair (multi-source · taught cross-file mechanism) ...");
  const sharedContent = readFileSync(resolve(REPO_ROOT, SHARED), "utf8");
  for (const finding of findings) {
    for (const prop of finding.missing_properties) {
      const callerAbs = resolve(REPO_ROOT, finding.file);
      const callerSource = readFileSync(callerAbs, "utf8");
      const sources = [
        { path: finding.file, content: callerSource },
        { path: SHARED, content: sharedContent },
      ];
      const composeResult = engine.composeRepairDirectiveTypeAware(finding, prop, sources);
      const displayFile = finding.file.replace(/\\/g, "/").split("/").pop();
      if (!composeResult.ok) {
        console.log(`  · ${displayFile}:${finding.line} + ${prop} · ESCALATED · declared_type=${composeResult.declared_type} · ${composeResult.reason.slice(0, 50)}`);
        evidence.repair_attempts.push({ file: finding.file, line: finding.line, property: prop, result: "escalated", declared_type: composeResult.declared_type, reason: composeResult.reason });
      } else {
        console.log(`  · ${displayFile}:${finding.line} + ${prop} = ${composeResult.directive.property_value}`);
        const r = await applyDirective(finding.file, composeResult.directive);
        console.log(`    ${r.ok ? "APPLIED · Δ+" + r.delta + "B" : "FAIL · " + r.reason?.slice(0, 60)}`);
        evidence.repair_attempts.push({
          file: finding.file, line: finding.line, property: prop,
          result: "repaired", value: composeResult.directive.property_value,
          rationale: composeResult.rationale,
          applied: r.ok, delta_bytes: r.ok ? r.delta : null,
        });
      }
    }
  }

  console.log("\nStep 4 · Post-repair scoped tsc ...");
  const tsc2 = await runScopedTypecheck();
  console.log(`  · scoped errors: ${tsc2.scoped.length}`);
  const post = {};
  for (const d of tsc2.scoped) {
    const key = d.file.replace(/\\/g, "/").split("/").pop();
    post[key] = (post[key] ?? 0) + 1;
  }
  for (const [k, v] of Object.entries(post)) console.log(`    ${k}: ${v}`);
  evidence.final_tsc_scoped_errors = { count: tsc2.scoped.length, per_file: post };
} finally {
  console.log("\nStep 5 · Restoring all fixtures ...");
  restoreAll();
  const finalHashes = {};
  for (const p of ALL_FILES) finalHashes[p] = sha256(readFileSync(resolve(REPO_ROOT, p), "utf8"));
  const byteIdentical = ALL_FILES.every((p) => originalHashes[p] === finalHashes[p]);
  for (const p of ALL_FILES) {
    const mark = originalHashes[p] === finalHashes[p] ? "✓" : "✗";
    console.log(`  ${p.split("/").pop()}: ${mark}`);
  }
  evidence.fixtures_byte_identical = byteIdentical;

  const dir = resolve(REPO_ROOT, "data/nex1-code-engine/capability-e-validation");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const evidencePath = resolve(dir, `novel-generalisation-${stamp}.json`);
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf8");
  console.log(`\nEvidence: ${evidencePath}`);

  // Correctness criteria: 4 primitive/array cases must close · 1 escalation expected · fixtures restored
  const escalatedCount = evidence.repair_attempts.filter((r) => r.result === "escalated").length;
  const repairedCount = evidence.repair_attempts.filter((r) => r.result === "repaired" && r.applied).length;
  const clean = evidence.final_tsc_scoped_errors?.count === 1 // the intentional complex-type escalation remains
    && escalatedCount === 1
    && repairedCount === 4
    && byteIdentical;
  console.log("\n════════════ NOVEL GENERALISATION VERDICT ════════════");
  console.log(`  primitive/array repairs applied:  ${repairedCount} / 4`);
  console.log(`  escalations (complex refuse):     ${escalatedCount} / 1`);
  console.log(`  final scoped errors:              ${evidence.final_tsc_scoped_errors?.count ?? "?"}`);
  console.log(`  fixtures byte-identical:          ${byteIdentical}`);
  if (clean) {
    console.log("");
    console.log("  RESULT · TAUGHT CROSS-FILE MECHANISM GENERALISES · closed every safe");
    console.log("  ripple across 5 unseen callers with novel symbols/types/filenames, and");
    console.log("  correctly refused to fabricate for the complex custom type. Attribution");
    console.log("  remains: taught_by=master_ai_engineer for the mechanism · attempted_by=");
    console.log("  nex1 · teaching_assistance=true for this execution. NOT independent authorship.");
  } else {
    console.log("");
    console.log("  RESULT · Novel generalisation DID NOT fully pass. Honest evidence recorded.");
  }
  console.log("═".repeat(56));
  process.exit(clean ? 0 : 1);
}
