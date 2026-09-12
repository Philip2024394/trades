#!/usr/bin/env node
// scripts/nex1-capability-f-suite.mjs
//
// NEX1 · CAPABILITY F · AUTONOMOUS REPOSITORY FILE DISCOVERY · four-test suite.
//
// Runs, in order:
//   T1 · Existing novel-E reuse (rediscover schema.ts autonomously)
//   T2 · Unseen mini-repo (nested dirs, irrelevant files must be excluded)
//   T3 · Adversarial duplicate symbol (two Vehicle interfaces · resolve via import)
//   T4 · Novel generalisation (fresh symbols/paths/nesting)
//
// Every test uses discoverRelevantSources(typeName, {root, ...}) with a
// scope-bounded directory root. The discovered source set is fed into
// composeRepairDirectiveTypeAware (multi-source · Capability C).
//
// Attribution: discovery mechanism is taught_by=master_ai_engineer.
// NEX1's execution is attempted_by=nex1 · teaching_assistance=true.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_F_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-capability-f-suite.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_F_INNER: "1" } },
  );
  process.exit(r.status ?? 1);
}

function sha256(t) { return createHash("sha256").update(t).digest("hex"); }
function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: "pipe", shell: true, encoding: "utf8", cwd: REPO_ROOT, ...opts });
}

const enginePath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/index.ts")).href;
const engine = await import(enginePath);

const suiteEvidence = {
  at: new Date().toISOString(),
  attribution: {
    teaching_infrastructure: "capability-f-discovery.ts + prior C+D+E mechanisms · taught_by=master_ai_engineer",
    novel_challenge_execution: "attempted_by=nex1 · teaching_assistance=true",
    fixtures_and_scripts: "authored_by=examiner",
  },
  tests: {},
};

const registry = new engine.Nex1ReasoningRegistry();
registry.register(engine.AstSemanticAdapter);

async function applyDirective(target, directive) {
  const abs = resolve(REPO_ROOT, target);
  const content = readFileSync(abs, "utf8");
  const req = {
    task_id: `f-${directive.field_name ?? directive.property_name ?? "repair"}`,
    attempt_id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    intent: "add_feature",
    context: {
      task_prompt: "capability-f discovery",
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
  const scoped = diagnostics.filter((d) =>
    scopedFiles.some((t) => d.file.replace(/\\/g, "/").endsWith(t) || d.file.endsWith(t)),
  );
  return { exit: tsc.status, scoped };
}

/**
 * @summary Take a snapshot of a file set. Returns { restore(), originalHashes }.
 */
function snapshotFiles(files) {
  const snap = new Map();
  const hashes = {};
  for (const p of files) {
    const content = readFileSync(resolve(REPO_ROOT, p), "utf8");
    snap.set(p, content);
    hashes[p] = sha256(content);
  }
  return {
    originalHashes: hashes,
    restore() {
      for (const [p, content] of snap) writeFileSync(resolve(REPO_ROOT, p), content, "utf8");
    },
    verify() {
      const finalHashes = {};
      let byteIdentical = true;
      for (const p of files) {
        finalHashes[p] = sha256(readFileSync(resolve(REPO_ROOT, p), "utf8"));
        if (finalHashes[p] !== hashes[p]) byteIdentical = false;
      }
      return { byteIdentical, finalHashes };
    },
  };
}

/**
 * @summary Given a list of stimuli against a shared root, run discovery → C repair
 * for each stimulus, return per-test result record.
 */
async function runDiscoveryCycle({ testName, root, sharedFile, stimuli, trackFiles: providedTrackFiles, expectedDeclaringPaths, expectedConsumingPaths, expectExcludedContain, expectAmbiguity }) {
  console.log(`\n── ${testName} ──`);
  // trackFiles = full repo-relative paths for snapshot/restore verification
  const trackFiles = Array.from(new Set([sharedFile, ...providedTrackFiles]));
  const snap = snapshotFiles(trackFiles);

  const record = {
    test: testName,
    root,
    discovery_calls: [],
    repair_attempts: [],
    initial_scoped_errors: -1,
    final_scoped_errors: -1,
    byte_identical: null,
    ambiguity_seen: null,
    verdict: null,
  };

  try {
    // Apply all stimuli to sharedFile
    for (const st of stimuli) {
      process.stdout.write(`  · stimulus ${st.interface}.${st.field_name}: ${st.field_type} `);
      const s = await applyDirective(sharedFile, {
        kind: "add_interface_field",
        target_interface: st.interface,
        field_name: st.field_name,
        field_type: st.field_type,
      });
      console.log(s.ok ? `APPLIED · Δ+${s.delta}B` : `FAIL · ${s.reason?.slice(0, 60)}`);
    }

    // Run tsc across the tracked files
    const tsc1 = await runScopedTypecheck(trackFiles);
    record.initial_scoped_errors = tsc1.scoped.length;
    console.log(`  · initial scoped tsc errors: ${tsc1.scoped.length}`);

    const findings = engine.extractMissingPropertyFindings(tsc1.scoped);
    console.log(`  · findings: ${findings.length}`);

    // For each finding · autonomously DISCOVER the working set for the finding's type
    for (const finding of findings) {
      const typeName = finding.type_name.replace(/\[\]/g, "").replace(/readonly\s+/g, "").trim();
      for (const prop of finding.missing_properties) {
        const discovery = engine.discoverRelevantSources(typeName, { root: resolve(REPO_ROOT, root) });
        record.discovery_calls.push({
          type_name: typeName,
          declaring_paths: discovery.declaring_files.map((f) => f.path),
          consuming_paths: discovery.consuming_files.map((f) => ({ path: f.path, matched: f.matched_declaration_path ?? null })),
          excluded_count: discovery.excluded_files.length,
          ambiguity: discovery.ambiguity,
          audit_size: discovery.audit.length,
        });
        record.ambiguity_seen = discovery.ambiguity;

        console.log(`  · discovery('${typeName}') → declaring=${discovery.declaring_files.length} consuming=${discovery.consuming_files.length} excluded=${discovery.excluded_files.length} ambiguity=${discovery.ambiguity}`);

        // Determine which declaring source to feed into C
        // For duplicate-symbol case, use the consumer's matched_declaration_path
        const consumer = discovery.consuming_files.find((f) => f.path.endsWith(finding.file) || finding.file.endsWith(f.path.split("/").pop()));
        let declSourceContent = null;
        let declSourcePath = null;
        if (consumer && consumer.matched_declaration_path) {
          const matchedDecl = discovery.declaring_files.find((f) => f.path === consumer.matched_declaration_path);
          if (matchedDecl) { declSourceContent = matchedDecl.content; declSourcePath = matchedDecl.path; }
        }
        if (declSourceContent === null && discovery.declaring_files.length === 1) {
          declSourceContent = discovery.declaring_files[0].content;
          declSourcePath = discovery.declaring_files[0].path;
        }
        if (declSourceContent === null && discovery.declaring_files.length > 1) {
          // Ambiguous without resolution
          record.repair_attempts.push({ file: finding.file, property: prop, result: "escalated_ambiguous", reason: "multiple declarations · unresolved import" });
          console.log(`    · ESCALATED · ambiguous declaration`);
          continue;
        }
        if (declSourceContent === null) {
          record.repair_attempts.push({ file: finding.file, property: prop, result: "escalated_no_decl", reason: "no declaring file discovered" });
          console.log(`    · ESCALATED · no declaring file discovered`);
          continue;
        }

        // Compose C repair with discovered sources
        const callerAbs = resolve(REPO_ROOT, finding.file);
        const callerSource = readFileSync(callerAbs, "utf8");
        const sources = [
          { path: finding.file, content: callerSource },
          { path: declSourcePath, content: declSourceContent },
        ];
        const composeResult = engine.composeRepairDirectiveTypeAware(finding, prop, sources);
        if (!composeResult.ok) {
          record.repair_attempts.push({ file: finding.file, property: prop, result: "escalated_complex", declared_type: composeResult.declared_type });
          console.log(`    · ESCALATED · declared_type=${composeResult.declared_type}`);
        } else {
          const r = await applyDirective(finding.file, composeResult.directive);
          record.repair_attempts.push({
            file: finding.file, property: prop, result: "repaired",
            value: composeResult.directive.property_value,
            declaration_used: declSourcePath,
            applied: r.ok,
          });
          console.log(`    · repair value=${composeResult.directive.property_value} from ${declSourcePath.split("/").slice(-2).join("/")} → ${r.ok ? "APPLIED" : "FAIL"}`);
        }
      }
    }

    const tsc2 = await runScopedTypecheck(trackFiles);
    record.final_scoped_errors = tsc2.scoped.length;
    console.log(`  · final scoped tsc errors: ${tsc2.scoped.length}`);

    // Verify expectations
    const firstDiscovery = record.discovery_calls[0];
    const declOk = expectedDeclaringPaths.every((p) => firstDiscovery?.declaring_paths.some((d) => d.endsWith(p) || p.endsWith(d)));
    const consumersOk = expectedConsumingPaths.every((p) => firstDiscovery?.consuming_paths.some((c) => c.path.endsWith(p) || p.endsWith(c.path)));
    const excludedOk = expectExcludedContain.every((p) => !firstDiscovery?.consuming_paths.some((c) => c.path.endsWith(p)) && !firstDiscovery?.declaring_paths.some((d) => d.endsWith(p)));
    const ambiguityOk = expectAmbiguity === undefined || record.ambiguity_seen === expectAmbiguity;
    record.declaring_ok = declOk;
    record.consumers_ok = consumersOk;
    record.excluded_ok = excludedOk;
    record.ambiguity_ok = ambiguityOk;
  } finally {
    snap.restore();
    const v = snap.verify();
    record.byte_identical = v.byteIdentical;
    for (const p of trackFiles) console.log(`  · ${p.split("/").pop()}: ${v.byteIdentical ? "✓" : "✗"}`);
  }

  return record;
}

// ─── T1 · Reuse existing novel-E (discover schema.ts autonomously) ────
{
  const record = await runDiscoveryCycle({
    testName: "T1 · Reuse novel-E · autonomous schema.ts discovery",
    root: "data/nex1-code-engine/novel-e",
    sharedFile: "data/nex1-code-engine/novel-e/schema.ts",
    trackFiles: [
      "data/nex1-code-engine/novel-e/reservation-builder.ts",
    ],
    stimuli: [{ interface: "Reservation", field_name: "guests", field_type: "number" }],
    expectedDeclaringPaths: ["novel-e/schema.ts"],
    expectedConsumingPaths: ["reservation-builder.ts"],
    expectExcludedContain: [],
    expectAmbiguity: "none",
  });
  record.verdict = (record.declaring_ok && record.consumers_ok && record.excluded_ok && record.ambiguity_ok && record.byte_identical && record.final_scoped_errors === 0) ? "pass" : "fail";
  suiteEvidence.tests.T1 = record;
  console.log(`  → verdict: ${record.verdict.toUpperCase()}`);
}

// ─── T2 · Unseen mini-repo · nested + irrelevant files ────────────────
{
  const record = await runDiscoveryCycle({
    testName: "T2 · Unseen mini-repo · nested + irrelevant files must be excluded",
    root: "data/nex1-code-engine/mini-repo-f",
    sharedFile: "data/nex1-code-engine/mini-repo-f/src/types/deep/user.ts",
    trackFiles: [
      "data/nex1-code-engine/mini-repo-f/src/callers/foo/build.ts",
      "data/nex1-code-engine/mini-repo-f/src/callers/bar/index.ts",
      "data/nex1-code-engine/mini-repo-f/src/utils/helpers.ts",
    ],
    stimuli: [{ interface: "User", field_name: "age", field_type: "number" }],
    expectedDeclaringPaths: ["types/deep/user.ts"],
    expectedConsumingPaths: ["callers/foo/build.ts", "callers/bar/index.ts"],
    expectExcludedContain: ["utils/helpers.ts"],
    expectAmbiguity: "none",
  });
  record.verdict = (record.declaring_ok && record.consumers_ok && record.excluded_ok && record.ambiguity_ok && record.byte_identical && record.final_scoped_errors === 0) ? "pass" : "fail";
  suiteEvidence.tests.T2 = record;
  console.log(`  → verdict: ${record.verdict.toUpperCase()}`);
}

// ─── T3 · Adversarial duplicate symbol ────────────────────────────────
{
  const record = await runDiscoveryCycle({
    testName: "T3 · Adversarial duplicate symbol · import-resolved",
    root: "data/nex1-code-engine/duplicate-f",
    sharedFile: "data/nex1-code-engine/duplicate-f/module-a/vehicle.ts",
    trackFiles: [
      "data/nex1-code-engine/duplicate-f/module-b/vehicle.ts",
      "data/nex1-code-engine/duplicate-f/consumer.ts",
    ],
    stimuli: [{ interface: "Vehicle", field_name: "colour", field_type: "string" }],
    expectedDeclaringPaths: ["module-a/vehicle.ts", "module-b/vehicle.ts"],
    expectedConsumingPaths: ["consumer.ts"],
    expectExcludedContain: [],
    expectAmbiguity: "duplicate_symbol_with_resolution",
  });
  const anyRepair = record.repair_attempts.find((r) => r.result === "repaired");
  const usedModuleA = anyRepair && anyRepair.declaration_used && anyRepair.declaration_used.includes("module-a");
  record.declaration_resolved_to_module_a = usedModuleA ?? false;
  record.verdict = (record.declaring_ok && record.consumers_ok && record.excluded_ok && record.ambiguity_ok && record.byte_identical && record.final_scoped_errors === 0 && usedModuleA) ? "pass" : "fail";
  suiteEvidence.tests.T3 = record;
  console.log(`  · repair used module-a: ${usedModuleA}`);
  console.log(`  → verdict: ${record.verdict.toUpperCase()}`);
}

// ─── T4 · Novel generalisation · fresh symbols/paths ──────────────────
{
  const record = await runDiscoveryCycle({
    testName: "T4 · Novel generalisation · fresh symbols/paths/nesting",
    root: "data/nex1-code-engine/novel-f",
    sharedFile: "data/nex1-code-engine/novel-f/lib/models/audit-entry.ts",
    trackFiles: [
      "data/nex1-code-engine/novel-f/services/audit-writer/writer.ts",
      "data/nex1-code-engine/novel-f/services/audit-writer/batch.ts",
      "data/nex1-code-engine/novel-f/services/unrelated/notifier.ts",
    ],
    stimuli: [{ interface: "AuditEntry", field_name: "attempts", field_type: "number" }],
    expectedDeclaringPaths: ["lib/models/audit-entry.ts"],
    expectedConsumingPaths: ["services/audit-writer/writer.ts", "services/audit-writer/batch.ts"],
    expectExcludedContain: ["services/unrelated/notifier.ts"],
    expectAmbiguity: "none",
  });
  record.verdict = (record.declaring_ok && record.consumers_ok && record.excluded_ok && record.ambiguity_ok && record.byte_identical && record.final_scoped_errors === 0) ? "pass" : "fail";
  suiteEvidence.tests.T4 = record;
  console.log(`  → verdict: ${record.verdict.toUpperCase()}`);
}

const dir = resolve(REPO_ROOT, "data/nex1-code-engine/capability-f-validation");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidencePath = resolve(dir, `suite-${stamp}.json`);
writeFileSync(evidencePath, JSON.stringify(suiteEvidence, null, 2), "utf8");

const verdicts = Object.entries(suiteEvidence.tests).map(([k, v]) => `${k}=${v.verdict}`).join(" · ");
console.log(`\nEvidence: ${evidencePath}`);
console.log("\n══════════ CAPABILITY F SUITE VERDICT ══════════");
console.log(`  ${verdicts}`);
const allPass = Object.values(suiteEvidence.tests).every((t) => t.verdict === "pass");
console.log(allPass ? "  RESULT · CAPABILITY F SUITE PASS · autonomous cross-file discovery generalises." : "  RESULT · at least one test failed · inspect evidence.");
console.log("═".repeat(50));
process.exit(allPass ? 0 : 1);
