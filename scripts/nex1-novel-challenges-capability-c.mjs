#!/usr/bin/env node
// scripts/nex1-novel-challenges-capability-c.mjs
//
// NEX1 · CAPABILITY C · TYPE-AWARE REPAIR-VALUE REASONING · adversarial validation.
//
// Founder challenge set (2026-09-12):
//   Alpha  · priority : number         (name-neutral · type-only)
//   Beta   · label    : string          (name-neutral · type-only)
//   Gamma  · active   : string          (name-neutral · type-only)
//   Delta  · name     : boolean         (ADVERSARIAL · name heuristic → "" · type → false)
//   Epsilon· count    : string          (ADVERSARIAL · name heuristic → 0  · type → "")
//   Zeta   · items    : number[]        (array)
//   Eta    · config   : EtaConfig       (COMPLEX CUSTOM · NEX1 must REFUSE)
//
// Every challenge uses the type-aware composer. Type information outranks
// property-name heuristics. For complex/custom types, NEX1 refuses to
// invent a value.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_NCC_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-novel-challenges-capability-c.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_NCC_INNER: "1" } },
  );
  process.exit(r.status ?? 1);
}

function sha256(t) { return createHash("sha256").update(t).digest("hex"); }
function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: "pipe", shell: true, encoding: "utf8", cwd: REPO_ROOT, ...opts });
}

const enginePath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/index.ts")).href;
const engine = await import(enginePath);

const CHALLENGES = [
  { label: "Alpha  · priority : number",   fixture: "data/nex1-code-engine/challenge-c/alpha-source.ts",   interface: "Alpha",   field_name: "priority", field_type: "number",    expected_value: "0",     expected_kind: "primitive" },
  { label: "Beta   · label    : string",   fixture: "data/nex1-code-engine/challenge-c/beta-source.ts",    interface: "Beta",    field_name: "label",    field_type: "string",    expected_value: '""',    expected_kind: "primitive" },
  { label: "Gamma  · active   : string",   fixture: "data/nex1-code-engine/challenge-c/gamma-source.ts",   interface: "Gamma",   field_name: "active",   field_type: "string",    expected_value: '""',    expected_kind: "primitive" },
  { label: "Delta  · name     : boolean  (ADV)", fixture: "data/nex1-code-engine/challenge-c/delta-source.ts",   interface: "Delta",   field_name: "name",     field_type: "boolean",   expected_value: "false", expected_kind: "primitive" },
  { label: "Epsilon· count    : string   (ADV)", fixture: "data/nex1-code-engine/challenge-c/epsilon-source.ts", interface: "Epsilon", field_name: "count",    field_type: "string",    expected_value: '""',    expected_kind: "primitive" },
  { label: "Zeta   · items    : number[]",  fixture: "data/nex1-code-engine/challenge-c/zeta-source.ts",    interface: "Zeta",    field_name: "items",    field_type: "number[]",  expected_value: "[]",    expected_kind: "array" },
  { label: "Eta    · config   : EtaConfig (REFUSE)", fixture: "data/nex1-code-engine/challenge-c/eta-source.ts",    interface: "Eta",     field_name: "config",   field_type: "EtaConfig", expected_value: null,    expected_kind: "complex_refused" },
];

console.log("NEX1 · CAPABILITY C · TYPE-AWARE REPAIR-VALUE REASONING · adversarial validation");
console.log("─".repeat(80));

const globalEvidence = {
  at: new Date().toISOString(),
  challenge_set: "capability-c · 7-fixture adversarial",
  attribution: {
    teaching_infrastructure: "taught_by=master_ai_engineer (capability-c-type-aware-repair.ts)",
    novel_challenge_execution: "attempted_by=nex1 · teaching_assistance=true",
    fixtures_and_scripts: "authored_by=examiner",
  },
  challenges: [],
};

const registry = new engine.Nex1ReasoningRegistry();
registry.register(engine.AstSemanticAdapter);

async function applyDirective(target, directive) {
  const abs = resolve(REPO_ROOT, target);
  const content = readFileSync(abs, "utf8");
  const req = {
    task_id: `ncc-${directive.field_name ?? directive.property_name ?? "repair"}`,
    attempt_id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    intent: "add_feature",
    context: {
      task_prompt: "capability-c validation",
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

async function runScopedTypecheck(scopedPath) {
  const tsc = run("npx", ["tsc", "--noEmit", "--skipLibCheck", "--noErrorTruncation", "--pretty", "false"], {
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" },
  });
  const out = (tsc.stdout ?? "") + "\n" + (tsc.stderr ?? "");
  const diagnostics = engine.parseTscOutput(out);
  const scoped = diagnostics.filter((d) => d.file.replace(/\\/g, "/").endsWith(scopedPath) || d.file.endsWith(scopedPath));
  return { exit: tsc.status, scoped };
}

let successCount = 0;
let refusalCorrectCount = 0;
let totalPassable = 0;

for (const ch of CHALLENGES) {
  console.log(`\n── ${ch.label} ──`);
  const abs = resolve(REPO_ROOT, ch.fixture);
  const original = readFileSync(abs, "utf8");
  const originalHash = sha256(original);
  const isRefuseCase = ch.expected_kind === "complex_refused";
  if (!isRefuseCase) totalPassable++;

  const record = {
    label: ch.label,
    fixture: ch.fixture,
    original_hash: originalHash,
    stimulus: { field_name: ch.field_name, field_type: ch.field_type, expected_value: ch.expected_value, expected_kind: ch.expected_kind },
    stimulus_applied: false,
    type_aware_result: null,
    repair_applied: false,
    repair_value: null,
    tsc_errors_pre_repair: -1,
    tsc_errors_post_repair: -1,
    fixture_byte_identical: null,
    verdict: null,
  };

  try {
    process.stdout.write(`  · stimulus (${ch.field_name}:${ch.field_type}) `);
    const s = await applyDirective(ch.fixture, {
      kind: "add_interface_field",
      target_interface: ch.interface,
      field_name: ch.field_name,
      field_type: ch.field_type,
    });
    if (!s.ok) {
      console.log(`FAIL · ${s.reason?.slice(0, 60)}`);
      record.verdict = "stimulus_failed";
      globalEvidence.challenges.push(record);
      continue;
    }
    console.log(`APPLIED · Δ+${s.delta}B`);
    record.stimulus_applied = true;

    const tsc1 = await runScopedTypecheck(ch.fixture);
    record.tsc_errors_pre_repair = tsc1.scoped.length;
    console.log(`  · pre-repair scoped tsc errors: ${tsc1.scoped.length}`);

    const findings = engine.extractMissingPropertyFindings(tsc1.scoped);
    if (findings.length === 0) {
      console.log(`  · WARN · no findings extracted from stimulus consequence`);
      record.verdict = "no_findings";
      globalEvidence.challenges.push(record);
      continue;
    }
    const finding = findings[0];
    const prop = finding.missing_properties[0];

    // Capability C · type-aware composer with current file source
    const currentSource = readFileSync(abs, "utf8");
    const composeResult = engine.composeRepairDirectiveTypeAware(finding, prop, currentSource);
    record.type_aware_result = composeResult;

    if (!composeResult.ok) {
      console.log(`  · type-aware composer: ESCALATED · declared_type=${composeResult.declared_type} · reason=${composeResult.reason.slice(0, 80)}`);
      if (isRefuseCase) {
        record.verdict = "refused_correctly";
        refusalCorrectCount++;
      } else {
        record.verdict = "refused_incorrectly";
      }
      // Do not apply · NEX1 correctly refuses
    } else {
      const value = composeResult.directive.property_value;
      record.repair_value = value;
      console.log(`  · type-aware composer: OK · source=${composeResult.source} · value=${value}`);
      const rr = await applyDirective(ch.fixture, composeResult.directive);
      record.repair_applied = rr.ok;
      if (!rr.ok) {
        console.log(`  · repair FAIL · ${rr.reason?.slice(0, 60)}`);
        record.verdict = "repair_apply_failed";
      } else {
        console.log(`  · repair APPLIED · Δ+${rr.delta}B`);
        const tsc2 = await runScopedTypecheck(ch.fixture);
        record.tsc_errors_post_repair = tsc2.scoped.length;
        console.log(`  · post-repair scoped tsc errors: ${tsc2.scoped.length}`);
        if (tsc2.scoped.length === 0) {
          // Additionally verify the value matches expectation
          if (value === ch.expected_value) {
            record.verdict = "closed_type_correct";
            successCount++;
          } else {
            record.verdict = "closed_but_wrong_value";
            console.log(`  · WARN · closed but value ${value} !== expected ${ch.expected_value}`);
          }
        } else {
          record.verdict = "still_errors_after_repair";
        }
      }
    }
  } finally {
    writeFileSync(abs, original, "utf8");
    const finalHash = sha256(readFileSync(abs, "utf8"));
    record.fixture_byte_identical = originalHash === finalHash;
    console.log(`  · fixture restored: ${record.fixture_byte_identical ? "✓" : "✗"}`);
  }
  globalEvidence.challenges.push(record);
}

const dir = resolve(REPO_ROOT, "data/nex1-code-engine/capability-c-validation");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidencePath = resolve(dir, `evidence-${stamp}.json`);
writeFileSync(evidencePath, JSON.stringify(globalEvidence, null, 2), "utf8");
console.log(`\nEvidence: ${evidencePath}`);

const allRestored = globalEvidence.challenges.every((c) => c.fixture_byte_identical);
const refuseCases = CHALLENGES.filter((c) => c.expected_kind === "complex_refused").length;

console.log("\n════════════ CAPABILITY C ADVERSARIAL VERDICT ════════════");
console.log(`  primitive/array cases closed type-correctly: ${successCount} / ${totalPassable}`);
console.log(`  complex cases correctly refused:              ${refusalCorrectCount} / ${refuseCases}`);
console.log(`  all fixtures byte-identical:                  ${allRestored}`);
console.log("");
const clean = successCount === totalPassable && refusalCorrectCount === refuseCases && allRestored;
if (clean) {
  console.log("  RESULT · Capability C ADVERSARIAL PASS · type-aware repair-value reasoning");
  console.log("  generalises across name-neutral, adversarial, and array cases · and");
  console.log("  correctly REFUSES to invent a value for a complex custom type.");
  console.log("  Recorded as TAUGHT INFRASTRUCTURE (taught_by=master_ai_engineer).");
  console.log("  NEX1 executed on unseen fixtures · authorship NOT counted as independent.");
} else {
  console.log("  RESULT · Capability C DID NOT FULLY PASS · honest evidence recorded.");
}
console.log("═".repeat(60));
process.exit(clean ? 0 : 1);
