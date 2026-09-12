#!/usr/bin/env node
// scripts/nex1-capability-j-runtime-diagnosis.mjs
//
// NEX1 · CAPABILITY J.1 · RUNTIME FAILURE DIAGNOSIS · ten-test suite.
//
// Real-failure block (5 tests): run vitest on intentionally-failing fixtures
//   J1 · assertion_mismatch
//   J2 · thrown_error
//   J3 · timeout
//   J4 · unhandled_rejection
//   J5 · snapshot_mismatch
//
// Adversarial block (5 tests): pass synthetic input to the extractor
//   J6 · empty output → refused (empty_output)
//   J7 · ANSI-only garbage → refused (malformed_output)
//   J8 · random text → refused (malformed_output)
//   J9 · vitest infrastructure crash signature → refused (vitest_infrastructure_error)
//   J10 · permission error signature → refused (permission_error)
//
// The extractor never mutates any file. There are no fixtures to snapshot
// beyond the failing test files (which are examiner-authored and never
// modified during the run).

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_J_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-capability-j-runtime-diagnosis.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_J_INNER: "1" } },
  );
  process.exit(r.status ?? 1);
}

const enginePath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-agent/code-engine/index.ts")).href;
const engine = await import(enginePath);

function runVitestOnFile(testFile) {
  const vt = spawnSync("npx", ["vitest", "run", "--config=vitest.config.capability-j.mts", testFile, "--reporter=default"], {
    stdio: "pipe", shell: true, encoding: "utf8", cwd: REPO_ROOT,
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
  });
  return { exit: vt.status, output: (vt.stdout ?? "") + "\n" + (vt.stderr ?? "") };
}

console.log("NEX1 · CAPABILITY J.1 · RUNTIME FAILURE DIAGNOSIS · ten-test suite");
console.log("─".repeat(72));

const evidence = {
  at: new Date().toISOString(),
  attribution: {
    teaching_infrastructure: "capability-j-runtime-diagnosis.ts · taught_by=master_ai_engineer",
    novel_challenge_execution: "attempted_by=nex1 · teaching_assistance=true",
    fixtures_and_scripts: "authored_by=examiner",
  },
  sub_tests: {},
};

async function runRealFailure({ id, label, testFile, expectedKind, extraChecks }) {
  console.log(`\n── ${id} · ${label} ──`);
  const { exit, output } = runVitestOnFile(testFile);
  const result = engine.extractRuntimeFailures(output);
  const record = {
    vitest_exit: exit,
    output_bytes: output.length,
    extractor_kind: result.kind,
  };
  if (result.kind === "ok") {
    record.findings = result.findings;
    console.log(`  · vitest_exit=${exit} · extractor=ok · findings=${result.findings.length}`);
    for (const f of result.findings) {
      console.log(`    · ${f.kind} · ${f.test_file}${f.test_name ? " > " + f.test_name : ""} · error_class=${f.error_class ?? "-"}`);
    }
  } else {
    record.refusal = result;
    console.log(`  · vitest_exit=${exit} · extractor=refused (${result.refusal_class}) · ${result.reason.slice(0, 60)}`);
  }
  // expectedKind may be a single kind or an array of acceptable kinds
  const acceptable = Array.isArray(expectedKind) ? expectedKind : [expectedKind];
  const matchingFinding = result.kind === "ok" && result.findings.find((f) => acceptable.includes(f.kind));
  const extraOk = extraChecks ? extraChecks(matchingFinding, output) : true;
  record.verdict = matchingFinding && extraOk ? "pass" : "fail";
  console.log(`  → verdict: ${record.verdict.toUpperCase()}`);
  return record;
}

function runAdversarial({ id, label, synthetic, expectedRefusalClass }) {
  console.log(`\n── ${id} · ${label} ──`);
  const result = engine.extractRuntimeFailures(synthetic);
  const record = { extractor_kind: result.kind };
  if (result.kind === "refused") {
    record.refusal_class = result.refusal_class;
    record.reason = result.reason;
    console.log(`  · extractor=refused (${result.refusal_class}) · ${result.reason.slice(0, 80)}`);
  } else {
    record.findings = result.findings;
    console.log(`  · extractor=ok · findings=${result.findings.length} · UNEXPECTED (should have refused)`);
  }
  record.verdict = result.kind === "refused" && result.refusal_class === expectedRefusalClass ? "pass" : "fail";
  console.log(`  → verdict: ${record.verdict.toUpperCase()}`);
  return record;
}

// ─── Real failures ────────────────────────────────────────────────────
evidence.sub_tests["J1"] = await runRealFailure({
  id: "J1", label: "assertion_mismatch (expect(1).toBe(2))",
  testFile: "data/nex1-code-engine/challenge-j-tests/assertion-fail.ts",
  expectedKind: "assertion_mismatch",
});
evidence.sub_tests["J2"] = await runRealFailure({
  id: "J2", label: "thrown_error (Error 'intentional-boom')",
  testFile: "data/nex1-code-engine/challenge-j-tests/throw-fail.ts",
  expectedKind: "thrown_error",
  extraChecks: (f) => f?.error_message?.includes("intentional-boom") ?? false,
});
evidence.sub_tests["J3"] = await runRealFailure({
  id: "J3", label: "timeout (test hangs · testTimeout=2000ms)",
  testFile: "data/nex1-code-engine/challenge-j-tests/timeout-fail.ts",
  expectedKind: "timeout",
  extraChecks: (f) => (f?.timeout_ms ?? 0) >= 1000,
});
evidence.sub_tests["J4"] = await runRealFailure({
  id: "J4", label: "async rejection (Promise.reject) · vitest catches → thrown_error or unhandled_rejection",
  testFile: "data/nex1-code-engine/challenge-j-tests/rejection-fail.ts",
  expectedKind: ["thrown_error", "unhandled_rejection"],
  extraChecks: (f) => f?.error_class === "TypeError" && (f?.error_message ?? "").includes("intentional-reject"),
});
evidence.sub_tests["J5"] = await runRealFailure({
  id: "J5", label: "snapshot_mismatch (toMatchInlineSnapshot)",
  testFile: "data/nex1-code-engine/challenge-j-tests/snapshot-fail.ts",
  expectedKind: "snapshot_mismatch",
});

// ─── Adversarial refusals ─────────────────────────────────────────────
evidence.sub_tests["J6"] = runAdversarial({
  id: "J6", label: "empty output → refused (empty_output)",
  synthetic: "",
  expectedRefusalClass: "empty_output",
});
evidence.sub_tests["J7"] = runAdversarial({
  id: "J7", label: "ANSI-only garbage → refused (malformed_output)",
  synthetic: "[31m[1m[0m",
  expectedRefusalClass: "malformed_output",
});
evidence.sub_tests["J8"] = runAdversarial({
  id: "J8", label: "random text → refused (malformed_output)",
  synthetic: "lorem ipsum dolor sit amet\nconsectetur adipiscing elit\nsed do eiusmod tempor",
  expectedRefusalClass: "malformed_output",
});
evidence.sub_tests["J9"] = runAdversarial({
  id: "J9", label: "vitest infrastructure crash → refused",
  synthetic: "vitest process died unexpectedly with SIGKILL\nCannot find module 'vitest/foo'",
  expectedRefusalClass: "vitest_infrastructure_error",
});
evidence.sub_tests["J10"] = runAdversarial({
  id: "J10", label: "permission failure → refused (permission_error)",
  synthetic: "EACCES: permission denied, open '/etc/shadow'",
  expectedRefusalClass: "permission_error",
});

const dir = resolve(REPO_ROOT, "data/nex1-code-engine/capability-j-validation");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidencePath = resolve(dir, `suite-${stamp}.json`);
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf8");
console.log(`\nEvidence: ${evidencePath}`);

console.log("\n══════════ CAPABILITY J.1 VERDICT ══════════");
for (const [k, v] of Object.entries(evidence.sub_tests)) console.log(`  ${k}: ${v.verdict}`);
const allPass = Object.values(evidence.sub_tests).every((t) => t.verdict === "pass");
console.log(allPass ? "  RESULT · CAPABILITY J.1 PASS across all ten sub-tests." : "  RESULT · at least one sub-test failed · inspect evidence.");
console.log("═".repeat(44));
process.exit(allPass ? 0 : 1);
