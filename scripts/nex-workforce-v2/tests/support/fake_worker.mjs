#!/usr/bin/env node
// NEX Workforce V2 · Test-only fake worker
// ─────────────────────────────────────────────────────────────────────────────
// Used by C9 lifecycle tests to simulate agent/orchestrator/reaper processes
// without touching real workforce code or the database.
//
// Behavior controlled via env vars:
//   NEX_FAKE_ROLE            = AGENT | ORCHESTRATOR | REAPER (informational)
//   NEX_FAKE_SLEEP_MS        = ms before exiting (0 = exit immediately)
//   NEX_FAKE_EXIT_CODE       = exit code (default 0)
//   NEX_FAKE_EMIT_STDERR     = optional string to write to stderr before exit
//   NEX_FAKE_HANG            = "true" → sleep forever (until SIGTERM)
//   NEX_FAKE_IGNORE_SIGTERM  = "true" → ignore SIGTERM (test force-kill scenarios)

const role      = process.env.NEX_FAKE_ROLE || "UNKNOWN";
const sleepMs   = Number(process.env.NEX_FAKE_SLEEP_MS ?? 0);
const exitCode  = Number(process.env.NEX_FAKE_EXIT_CODE ?? 0);
const stderrMsg = process.env.NEX_FAKE_EMIT_STDERR || "";
const hang      = process.env.NEX_FAKE_HANG === "true";
const ignoreSig = process.env.NEX_FAKE_IGNORE_SIGTERM === "true";

process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), msg: "fake_worker.boot", role, pid: process.pid, sleepMs, exitCode, hang }) + "\n");

if (!ignoreSig) {
  process.on("SIGTERM", () => {
    process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), msg: "fake_worker.sigterm", role, pid: process.pid }) + "\n");
    process.exit(0);
  });
  process.on("SIGINT", () => {
    process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), msg: "fake_worker.sigint", role, pid: process.pid }) + "\n");
    process.exit(0);
  });
}

if (stderrMsg) process.stderr.write(stderrMsg + "\n");

if (hang) {
  // Sleep forever (until signal)
  setInterval(() => {}, 60_000);
} else {
  setTimeout(() => process.exit(exitCode), sleepMs);
}
