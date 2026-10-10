// scripts/nex-canonical/_family-safety-regression-sweep.mjs
//
// NEX Family Safety · wave regression sweep · FS-4.
// Runs:
//   · migration-202 structural tests (vitest.local.config.ts)
//   · subscription module vitest tests
//   · (optional) Playwright specs if NEX_RUN_PLAYWRIGHT=1
//
// Reports PASS/TOTAL counts to stdout.

import { spawnSync } from "node:child_process";

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[fs-regression] ${msg}`);
}

function run(cmd, args, label) {
  log(`→ ${label} · ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    stdio: "pipe",
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  // Vitest standard summary line:
  //   Tests  53 passed (53)
  //   Tests  12 passed | 1 failed (13)
  const match = out.match(/Tests\s+(.*?)\((\d+)\)/i);
  let pass = 0;
  let total = 0;
  if (match) {
    total = Number(match[2]);
    const inner = match[1];
    const passMatch = inner.match(/(\d+)\s+passed/i);
    if (passMatch) pass = Number(passMatch[1]);
  }
  return { ok: r.status === 0, pass, total, label };
}

const summary = [];

summary.push(
  run("npx", [
    "vitest",
    "run",
    "--config",
    "scripts/nex-canonical/vitest.local.config.ts",
    "scripts/nex-canonical/__tests__/migration-202.test.ts",
  ], "migration-202"),
);

summary.push(
  run("npx", [
    "vitest",
    "run",
    "src/lib/nex-native/family-safety/subscription/",
  ], "subscription-module"),
);

if (process.env.NEX_RUN_PLAYWRIGHT === "1") {
  summary.push(
    run("npx", [
      "playwright",
      "test",
      "tests/e2e/nex-family-safety-subscription.spec.ts",
    ], "pw-subscription"),
  );
  summary.push(
    run("npx", [
      "playwright",
      "test",
      "tests/e2e/nex-family-safety-emergency-regression.spec.ts",
    ], "pw-eh-regression"),
  );
}

log("─────────────────────────────────────────────");
for (const s of summary) {
  const flag = s.ok ? "OK" : "FAIL";
  log(`${flag}  ${s.label}  ${s.pass}/${s.total}`);
}
log("─────────────────────────────────────────────");
const anyFail = summary.some((s) => !s.ok);
process.exit(anyFail ? 1 : 0);
