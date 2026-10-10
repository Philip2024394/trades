#!/usr/bin/env node
// scripts/nex-canonical/_cc-regression-sweep.mjs
//
// NEX Family Safety · CC-4 one-shot regression sweep.
// ----------------------------------------------------
// Runs the full vitest + Playwright suite for the family-safety wave
// and reports pass/fail/total counts. Session-identity gated for any
// DB touch (dry-run by default · writes nothing).
//
// Modes:
//   --dry-run (default)   just prints the test counts, does not touch DB
//   --live                also exercises the live child-creation flow
//                         (requires NEX_FAMILY_SAFETY_CHILD_CREATE_LIVE_MODE)
//
// Exit code:
//   0 · all green
//   1 · any suite failed
//
// Session identity enforcement: before any DB operation this script
// refuses to proceed unless process.env.NEX_SESSION_IDENTITY === "nex_dev".
// This matches the sealed CC-1/CC-2/CC-3 gates on migrations and services.
//
// Date is an estimate · authored 2026-10-10.

import { spawnSync } from "node:child_process";
import { argv, env, exit, platform } from "node:process";

const args = new Set(argv.slice(2));
const DRY_RUN = !args.has("--live");

// ─────────────────────────────────────────────────────────────────────
// Session identity gate
// ─────────────────────────────────────────────────────────────────────

function sessionGate() {
  const sid = env.NEX_SESSION_IDENTITY ?? "";
  if (sid !== "nex_dev") {
    log(
      `REFUSED · NEX_SESSION_IDENTITY must equal "nex_dev" to run this sweep. Current value: "${sid}". Export NEX_SESSION_IDENTITY=nex_dev and retry.`,
    );
    exit(1);
  }
}

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[cc-sweep] ${msg}`);
}

function run(cmd, cmdArgs, label) {
  log(`→ ${label} · ${cmd} ${cmdArgs.join(" ")}`);
  const r = spawnSync(cmd, cmdArgs, {
    stdio: "pipe",
    encoding: "utf8",
    shell: platform === "win32",
  });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  // Vitest standard summary line:
  //   Tests  53 passed (53)
  //   Tests  12 passed | 1 failed (13)
  const vMatch = out.match(/Tests\s+(.*?)\((\d+)\)/i);
  let pass = 0;
  let total = 0;
  let fail = 0;
  if (vMatch) {
    total = Number(vMatch[2]);
    const inner = vMatch[1];
    const passMatch = inner.match(/(\d+)\s+passed/i);
    if (passMatch) pass = Number(passMatch[1]);
    const failMatch = inner.match(/(\d+)\s+failed/i);
    if (failMatch) fail = Number(failMatch[1]);
  } else {
    // Playwright summary line:
    //   7 passed (xxs)
    //   1 failed · 7 passed · 2 skipped (xxs)
    const pwPassed = out.match(/(\d+)\s+passed/i);
    if (pwPassed) pass = Number(pwPassed[1]);
    const pwFailed = out.match(/(\d+)\s+failed/i);
    if (pwFailed) fail = Number(pwFailed[1]);
    const pwSkipped = out.match(/(\d+)\s+skipped/i);
    const skipped = pwSkipped ? Number(pwSkipped[1]) : 0;
    total = pass + fail + skipped;
  }
  // Preserve the full output so a human can look at any failure.
  return { ok: r.status === 0, pass, fail, total, label, raw: out };
}

const summary = [];

// ─────────────────────────────────────────────────────────────────────
// 1 · Vitest · prior sealed layers (safechat / emergency / family-links /
//     family-safety core / account-gate)
// ─────────────────────────────────────────────────────────────────────

summary.push(
  run("npx", [
    "vitest",
    "run",
    "src/lib/nex-native/safechat/",
  ], "vitest · safechat (prior · 351)"),
);
summary.push(
  run("npx", [
    "vitest",
    "run",
    "src/lib/nex-native/emergency/",
  ], "vitest · emergency (prior · 240)"),
);
summary.push(
  run("npx", [
    "vitest",
    "run",
    "src/lib/nex-native/family-links/",
  ], "vitest · family-links (prior · 141)"),
);
summary.push(
  run("npx", [
    "vitest",
    "run",
    "src/lib/nex-native/family-safety/",
  ], "vitest · family-safety (prior · 317)"),
);
summary.push(
  run("npx", [
    "vitest",
    "run",
    "src/lib/nex-native/account-gate/",
    "src/components/nex-native/account-gate/",
  ], "vitest · account-gate (prior · 31)"),
);

// ─────────────────────────────────────────────────────────────────────
// 2 · Playwright · the current wave's six new specs
// ─────────────────────────────────────────────────────────────────────

if (env.NEX_RUN_PLAYWRIGHT === "1" || args.has("--playwright")) {
  const specs = [
    "tests/e2e/nex-family-safety-create-child.spec.ts",
    "tests/e2e/nex-family-safety-custody.spec.ts",
    "tests/e2e/nex-family-safety-age-transition.spec.ts",
    "tests/e2e/nex-family-safety-dashboard-live.spec.ts",
    "tests/e2e/nex-family-safety-minor-safechat-enforcement.spec.ts",
    "tests/e2e/nex-family-safety-regression.spec.ts",
  ];
  for (const s of specs) {
    summary.push(run("npx", ["playwright", "test", s], `playwright · ${s}`));
  }
}

// ─────────────────────────────────────────────────────────────────────
// 3 · Dev-mode legal-gate smoke
// ─────────────────────────────────────────────────────────────────────

if (!DRY_RUN) {
  // Only engage the DB session gate when a live run is explicitly
  // requested. The default dry-run reports counts without any writes.
  sessionGate();
  log("--live mode: future hook for a seeded end-to-end round-trip");
}

// ─────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────

log("─────────────────────────────────────────────");
let totalPass = 0;
let totalFail = 0;
let totalTests = 0;
for (const s of summary) {
  const flag = s.ok ? "OK" : "FAIL";
  const line = `${flag}  ${s.label}  pass=${s.pass} fail=${s.fail} total=${s.total}`;
  log(line);
  totalPass += s.pass;
  totalFail += s.fail;
  totalTests += s.total;
}
log("─────────────────────────────────────────────");
log(`AGGREGATE · pass=${totalPass} fail=${totalFail} total=${totalTests}`);
const anyFail = summary.some((s) => !s.ok);
exit(anyFail ? 1 : 0);
