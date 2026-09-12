#!/usr/bin/env node
// NEX Acquisition Workforce · PRODUCTION LAUNCHER (Layer A).
//
// Philip 2026-09-02 · Phase 1A · outermost entry point for the acquisition
// workforce. Invoked by the Windows Scheduled Task `NEX-Acquisition-Workforce`.
//
// This launcher's sole job is to bootstrap the production watchdog under tsx
// so we don't need to pre-compile TypeScript. Same two-layer pattern as
// scripts/walkers/run-outer-watchdog.mjs.
//
// Contract:
//   · No terminal dependency (Scheduled Task launches without a shell)
//   · No NEX_DEV_WORKERS gate (this is production, not dev)
//   · No Claude dependency
//   · Exit codes: 0=clean shutdown, 1=watchdog crashed (OS supervision must restart)

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { assertProductionPostgresUrl, requirePostgresUrl, redactUrl } from "../../src/lib/nex/config/production-guard.mjs";

// ═══════════════════════════════════════════════════════════════════════
// LEGACY WORKFORCE QUARANTINE · 2026-09-04 · fail-closed at boot
// ═══════════════════════════════════════════════════════════════════════
// This file (run-production-launcher.mjs) belongs to the LEGACY Phase 1B
// "nex-acquisition-workforce" system. It was superseded by workforce v2
// (scripts/nex-workforce-v2/), which was proven end-to-end by Gate 5A #4
// on 2026-09-04 including the Slice 4.1 v2 extensions.digest persister
// boundary.
//
// The legacy path writes directly to nex.work_item / nex.food_business
// bypassing the workforce v2 persister boundary and its safety guarantees
// (extensions.digest resolution · SECDEF persister role · monotonic UPSERT
// with identity-ambiguity protection).
//
// Execution is refused UNCONDITIONALLY at boot. There is NO environment-
// variable bypass. To re-enable (emergency only) you must:
//   1. Explicitly edit this guard block via git commit,
//   2. Re-run the Permanent Workforce Activation Readiness Gate,
//   3. Obtain separate explicit authorization from Philip.
//
// The original file logic is preserved below this guard block for recovery.
// See scripts/nex-acquisition-workforce/QUARANTINED-DO-NOT-RUN.mjs for the
// Scheduled Task safety-net that replaced this file as the task's action.
// ═══════════════════════════════════════════════════════════════════════
process.stderr.write("═══════════════════════════════════════════════════════════════════════\n");
process.stderr.write(" NEX LEGACY WORKFORCE · QUARANTINED · run-production-launcher.mjs\n");
process.stderr.write("═══════════════════════════════════════════════════════════════════════\n");
process.stderr.write(" This launcher is quarantined (2026-09-04). No DB connection, no child\n");
process.stderr.write(" process, and no Overpass request has occurred. Exiting code 2.\n");
process.stderr.write(" Legacy path bypasses Slice 4.1 v2 persister boundary. Superseded by\n");
process.stderr.write(" scripts/nex-workforce-v2/ (Gate 5A #4 proven · activation still gated).\n");
process.stderr.write("═══════════════════════════════════════════════════════════════════════\n");
process.exit(2);

// ═══════════════════════════════════════════════════════════════════════
// ORIGINAL FILE LOGIC PRESERVED BELOW (UNREACHABLE)
// ═══════════════════════════════════════════════════════════════════════

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const repoRoot   = join(__dirname, "..", "..");

// Load .env.local BEFORE the guard fires so that a dev run picks up the
// URL from the file (the Scheduled Task hands us `--env-file=.env.local`
// on the tsx re-invoke below, but this outer node process doesn't have
// that yet). Only set vars that are not already in process.env so an
// operator can still override at the shell.
if (existsSync(join(repoRoot, ".env.local"))) {
  for (const line of readFileSync(join(repoRoot, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// Boot-time fail-closed guard · refuses to launch in production when
// NEX_POSTGRES_URL is missing / malformed / points at localhost/nex_dev.
// Dev is unaffected (NODE_ENV !== "production" → no-op).
try {
  assertProductionPostgresUrl();
  // Additionally require presence at boot (dev included) so the workforce
  // never spawns with a missing URL — a walker crashing on first query is
  // worse than refusing to start.
  const url = requirePostgresUrl();
  // eslint-disable-next-line no-console
  console.log(`[launcher] NEX_POSTGRES_URL ok · ${redactUrl(url)}`);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(`[launcher] FAIL-CLOSED · code=${err.code ?? "unknown"} · ${err.message}`);
  process.exit(2);
}

if (!process.env.__ACQ_LAUNCHER_INNER__) {
  // Bootstrap · re-invoke under tsx so we can also import .ts modules if needed.
  // Currently all files in this folder are .mjs so tsx isn't strictly required,
  // but the pattern matches System A and gives us headroom to add .ts later.
  const child = spawn(
    "npx",
    ["tsx", "--env-file=.env.local", fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __ACQ_LAUNCHER_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const watchdogScript = join(repoRoot, "scripts", "nex-acquisition-workforce", "run-production-watchdog.mjs");
  console.log(`\nNEX ACQUISITION WORKFORCE · LAUNCHER · pid ${process.pid}`);
  console.log(`  cwd: ${repoRoot}`);
  console.log(`  invoking: node ${watchdogScript}`);

  const watchdog = spawn(process.execPath, [watchdogScript], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env },
  });

  // Propagate signals downward so graceful shutdown works from Task Scheduler stop
  process.once("SIGINT",  () => { try { watchdog.kill("SIGINT"); }  catch {} });
  process.once("SIGTERM", () => { try { watchdog.kill("SIGTERM"); } catch {} });

  watchdog.on("exit", (code) => {
    console.log(`[launcher] watchdog exited · code=${code}`);
    process.exit(code ?? 1);
  });
}
