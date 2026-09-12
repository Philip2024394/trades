#!/usr/bin/env node
// scripts/nex1-novel-challenges-capability-d.mjs
//
// NEX1 · CAPABILITY D · MULTI-CHALLENGE VALIDATION · deterministic · zero model.
//
// Purpose (2026-09-12): Test whether the teacher-authored Capability D
// introspection module (taught_by=master_ai_engineer) produces accurate
// structured gap descriptors on multiple unseen field-type challenges:
//   · Widget.priority : number
//   · Product.category : string
//   · Toggle.enabled : boolean
//   · User.age : number  (different symbol shape)
//
// Each challenge: apply required-field stimulus, run consequence-reasoning,
// on failure invoke extractGapDescriptor, record the descriptor, restore
// fixture byte-identical. All work tagged as teaching infrastructure.
//
// The MEASUREMENT: does the taught D mechanism identify the correct gap
// (type_mismatch_after_repair) and correctly extract the declared type
// across all four challenges? If yes, D generalises. If not, D is
// case-specific to the widget fixture.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_NCD_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-novel-challenges-capability-d.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_NCD_INNER: "1" } },
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
  {
    label: "widget · priority : number",
    fixture: "data/nex1-code-engine/novel-challenge/widget-source.ts",
    stimulus: { kind: "add_interface_field", target_interface: "Widget", field_name: "priority", field_type: "number" },
  },
  {
    label: "product · category : string",
    fixture: "data/nex1-code-engine/novel-challenges-d/product-source.ts",
    stimulus: { kind: "add_interface_field", target_interface: "Product", field_name: "category", field_type: "string" },
  },
  {
    label: "toggle · enabled : boolean",
    fixture: "data/nex1-code-engine/novel-challenges-d/toggle-source.ts",
    stimulus: { kind: "add_interface_field", target_interface: "Toggle", field_name: "enabled", field_type: "boolean" },
  },
  {
    label: "user · age : number",
    fixture: "data/nex1-code-engine/novel-challenges-d/user-source.ts",
    stimulus: { kind: "add_interface_field", target_interface: "User", field_name: "age", field_type: "number" },
  },
];

console.log("NEX1 · CAPABILITY D · MULTI-CHALLENGE VALIDATION (deterministic · zero LLM)");
console.log("─".repeat(72));

const globalEvidence = {
  at: new Date().toISOString(),
  probe: "capability-d · multi-challenge · generalisation",
  attribution: {
    teaching_infrastructure: "taught_by=master_ai_engineer",
    novel_challenge_execution: "attempted_by=nex1 · teaching_assistance=true",
    fixtures_and_scripts: "authored_by=examiner",
  },
  challenges: [],
};

const registry = new engine.Nex1ReasoningRegistry();
registry.register(engine.AstSemanticAdapter);
console.log(`\nregistered adapters: [${registry.listRegistered().join(", ")}]\n`);

async function applyDirective(target, directive) {
  const abs = resolve(REPO_ROOT, target);
  const content = readFileSync(abs, "utf8");
  const req = {
    task_id: `ncd-${directive.field_name ?? "repair"}`,
    attempt_id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    intent: "add_feature",
    context: {
      task_prompt: "capability-d validation",
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

let overallPass = true;

for (const ch of CHALLENGES) {
  console.log(`── Challenge: ${ch.label} ──`);
  const abs = resolve(REPO_ROOT, ch.fixture);
  const original = readFileSync(abs, "utf8");
  const originalHash = sha256(original);

  const record = {
    label: ch.label,
    fixture: ch.fixture,
    original_hash: originalHash,
    stimulus_applied: false,
    initial_repair_applied: false,
    attempted_repairs: [],
    final_scoped_errors: 0,
    gap_descriptor: null,
    fixture_byte_identical: null,
    d_correct: null,
  };

  try {
    process.stdout.write(`  · stimulus (${ch.stimulus.field_name}:${ch.stimulus.field_type}) `);
    const s = await applyDirective(ch.fixture, ch.stimulus);
    if (!s.ok) {
      console.log(`FAIL · ${s.reason?.slice(0, 60)}`);
      record.stimulus_applied = false;
    } else {
      console.log(`APPLIED · Δ+${s.delta}B`);
      record.stimulus_applied = true;
    }

    // Repair loop · single iteration (Capability A repair)
    const tsc1 = await runScopedTypecheck(ch.fixture);
    console.log(`  · post-stimulus scoped tsc errors: ${tsc1.scoped.length}`);
    const findings = engine.extractMissingPropertyFindings(tsc1.scoped);
    console.log(`  · findings: ${findings.length}`);
    for (const finding of findings) {
      for (const prop of finding.missing_properties) {
        const directive = engine.composeRepairDirective(finding, prop);
        const val = directive.property_value;
        process.stdout.write(`  · repair-a: line ${finding.line} + ${prop}=${val} `);
        const r = await applyDirective(ch.fixture, directive);
        console.log(r.ok ? `APPLIED · Δ+${r.delta}B` : `FAIL · ${r.reason?.slice(0, 60)}`);
        record.attempted_repairs.push({ property_name: prop, property_value: val, ok: r.ok });
        if (r.ok) record.initial_repair_applied = true;
      }
    }

    // Post-repair scoped tsc
    const tsc2 = await runScopedTypecheck(ch.fixture);
    console.log(`  · post-repair scoped tsc errors: ${tsc2.scoped.length}`);
    record.final_scoped_errors = tsc2.scoped.length;

    // Invoke Capability D introspection
    if (tsc2.scoped.length > 0) {
      const currentSource = readFileSync(abs, "utf8");
      const descriptor = engine.extractGapDescriptor(
        tsc2.scoped[0],
        record.attempted_repairs.filter((r) => r.ok).map((r) => ({ property_name: r.property_name, property_value: r.property_value })),
        currentSource,
      );
      record.gap_descriptor = descriptor;
      console.log(`  · gap_descriptor.kind = ${descriptor.gap_kind}`);
      console.log(`    declared_field_type = ${descriptor.declared_field_type ?? "(null)"}`);
      console.log(`    expected_type       = ${descriptor.expected_type ?? "(null)"}`);
      console.log(`    proposed_mechanism  = ${descriptor.proposed_mechanism.slice(0, 80)}...`);

      // Evaluate correctness: D is "correct" if
      //   (a) gap_kind === "type_mismatch_after_repair"
      //   (b) declared_field_type matches the stimulus.field_type
      const dCorrect =
        descriptor.gap_kind === "type_mismatch_after_repair" &&
        descriptor.declared_field_type === ch.stimulus.field_type;
      record.d_correct = dCorrect;
      console.log(`  · D produced correct descriptor: ${dCorrect ? "✅" : "❌"}`);
      if (!dCorrect) overallPass = false;
    } else {
      record.d_correct = null;
      console.log(`  · (no scoped error post-repair · D not invoked)`);
    }
  } finally {
    writeFileSync(abs, original, "utf8");
    const finalHash = sha256(readFileSync(abs, "utf8"));
    record.fixture_byte_identical = originalHash === finalHash;
    console.log(`  · fixture restored: ${record.fixture_byte_identical ? "✓" : "✗"}\n`);
  }

  globalEvidence.challenges.push(record);
}

const dir = resolve(REPO_ROOT, "data/nex1-code-engine/capability-d-validation");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidencePath = resolve(dir, `evidence-${stamp}.json`);
writeFileSync(evidencePath, JSON.stringify(globalEvidence, null, 2), "utf8");
console.log(`Evidence: ${evidencePath}`);

const correctCount = globalEvidence.challenges.filter((c) => c.d_correct === true).length;
const totalChallenges = globalEvidence.challenges.length;
const allRestored = globalEvidence.challenges.every((c) => c.fixture_byte_identical);

console.log("\n════════════ CAPABILITY D VALIDATION VERDICT ════════════");
console.log(`  correct descriptors:   ${correctCount} / ${totalChallenges}`);
console.log(`  all fixtures restored: ${allRestored}`);
console.log("");
if (correctCount === totalChallenges && allRestored) {
  console.log("  RESULT · Capability D GENERALISES · taught mechanism produced accurate");
  console.log("  structured gap descriptors on all novel field-type challenges. Recorded");
  console.log("  as TAUGHT INFRASTRUCTURE (taught_by=master_ai_engineer). NEX1 executed");
  console.log("  the introspection on unseen fixtures; authorship of the mechanism is");
  console.log("  NOT counted as NEX1 independent authorship.");
} else {
  console.log("  RESULT · Capability D DID NOT GENERALISE fully. Honest evidence recorded.");
}
console.log("═".repeat(59));
process.exit(correctCount === totalChallenges && allRestored ? 0 : 1);
