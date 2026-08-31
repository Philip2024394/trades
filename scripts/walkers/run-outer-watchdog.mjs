#!/usr/bin/env node
// run-outer-watchdog.mjs · Layer B · spawns and keeps alive the
// NEX Walker Supervisor.
//
// This is the outermost NEX process. It has ONE job: ensure the
// supervisor process is running and making progress. If the
// supervisor crashes / hangs / stops progressing, this restarts it.
//
// This process should itself be started by:
//   · a Windows Scheduled Task at boot/login (see
//     scripts/walkers/install-scheduled-task.ps1)
//   · a systemd unit on Linux
//   · pm2 / launchd / other supervisord equivalents
//
// Usage:
//   node scripts/walkers/run-outer-watchdog.mjs
//
// Exit codes:
//   0 · clean shutdown (SIGINT/SIGTERM)
//   1 · watchdog itself crashed (which means the OS layer should
//       restart THIS process — that's what OS-level supervision is for)

import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

if (!process.env.__OUTER_WATCHDOG_INNER__) {
  // Bootstrap · run the same script through tsx so we can import the
  // TypeScript watchdog module without pre-compiling.
  const child = spawn(
    "npx",
    ["tsx", "--env-file=.env.local", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __OUTER_WATCHDOG_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { runOuterWatchdog } = await import("../../src/lib/nex/indonesia/workforce/outer-watchdog.ts");

  console.log(`\nNEX OUTER WATCHDOG · pid ${process.pid}`);
  console.log(`  cwd: ${repoRoot}`);
  console.log(`  supervising: node scripts/walkers/run-supervisor.mjs`);
  console.log(`  incidents log: data/indonesia/watchdog-incidents.jsonl`);

  const controller = new AbortController();
  const shutdown = (sig) => {
    console.log(`\n[watchdog] ${sig} · shutting down · will send SIGTERM to supervisor`);
    controller.abort();
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  const result = await runOuterWatchdog({
    command: "node",
    args: ["scripts/walkers/run-supervisor.mjs"],
    cwd: repoRoot,
    signal: controller.signal,
  });

  console.log(`\n[watchdog] exited · restarts=${result.restarts} incidents=${result.incidents.length}`);
  process.exit(0);
}
