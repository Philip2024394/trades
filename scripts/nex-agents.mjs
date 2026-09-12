#!/usr/bin/env node
// scripts/nex-agents.mjs
//
// NEX Agent Runtime · Founder-facing CLI (§27 · §44)
// Philip 2026-09-06 · FOUNDER AUTHORIZATION
//
// Direct invocation of the Control Plane — bypasses HTTP so the
// Founder can operate the runtime without a running Next.js server or
// Supabase session. Runs in the local shell as the same OS user as the
// spawned daemons, which IS the correct trust boundary for local
// development. HTTP surface is the correct trust boundary for anything
// remote (see /api/nex-control/agents/*).
//
// Two-step tsx pattern so TS imports resolve (proven from
// scripts/walkers/run-supervisor.mjs).
//
// Usage:
//   node scripts/nex-agents.mjs status
//   node scripts/nex-agents.mjs start programmer
//   node scripts/nex-agents.mjs stop programmer
//   node scripts/nex-agents.mjs start accommodation
//   node scripts/nex-agents.mjs stop accommodation
//   node scripts/nex-agents.mjs start all
//   node scripts/nex-agents.mjs stop all

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);

if (!process.env.NEX_AGENTS_CLI_INNER) {
  const envArgs = fs.existsSync(path.join(repoRoot, ".env.local"))
    ? ["--env-file=.env.local"]
    : [];
  const child = spawn(
    "npx",
    ["tsx", ...envArgs, entryFile, ...process.argv.slice(2)],
    {
      stdio: "inherit",
      cwd: repoRoot,
      shell: true,
      env: { ...process.env, NEX_AGENTS_CLI_INNER: "1" },
    },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const [cmd, target] = process.argv.slice(2);
  if (!cmd) {
    console.error("Usage: node scripts/nex-agents.mjs <status|start|stop> [programmer|accommodation|all]");
    process.exit(2);
  }
  const {
    startAgent, stopAgent, startAll, stopAll, status,
    ensureAuthorizedAgentsRegistered,
  } = await import("../src/lib/nex/agent-runtime/control-plane.ts");
  ensureAuthorizedAgentsRegistered();

  const founderIdMock = process.env.USER || process.env.USERNAME || "local_shell";

  if (cmd === "status") {
    const s = status();
    console.log("\nNEX WORKFORCE STATUS · " + s.now_iso);
    console.log("founder_stop_override: " + s.founder_stop_override);
    console.log("host_state: " + s.host_state + "\n");
    for (const a of s.agents) {
      console.log(`${a.agent_id.toUpperCase()}`);
      console.log(`  runtime_state   : ${a.runtime_state}`);
      console.log(`  desired_state   : ${a.desired_state}`);
      console.log(`  PID             : ${a.process_id ?? "-"}`);
      console.log(`  started         : ${a.started_at_iso ?? "-"}`);
      console.log(`  last heartbeat  : ${a.last_heartbeat_iso ?? "-"}  (stale ${a.last_heartbeat_stale_ms ?? "-"}ms)`);
      console.log(`  current task    : ${a.current_task ?? "-"}`);
      console.log(`  last success    : ${a.last_success_iso ?? "-"}`);
      console.log(`  last failure    : ${a.last_failure_iso ?? "-"}`);
      console.log(`  internet        : ${a.internet_state}`);
      console.log(`  restarts/hour   : ${a.restart_count_last_hour}`);
      console.log(`  reason          : ${a.reason}`);
      console.log();
    }
    console.log(`summary: ${JSON.stringify(s.summary)}\n`);
    process.exit(0);
  }

  if (cmd === "watchdog-tick") {
    const { watchdogTickAll } = await import("../src/lib/nex/agent-runtime/control-plane.ts");
    const r = await watchdogTickAll({ founder_user_id: founderIdMock });
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  }

  // ── Phase B · universe subcommands ────────────────────────────────
  if (cmd === "universe") {
    const sub = process.argv[3];
    if (!sub || sub === "help") {
      console.log("Usage: node scripts/nex-agents.mjs universe <status|business|demo>");
      console.log("  status            · list registered businesses + placements");
      console.log("  business <id>     · dump one business detail");
      console.log("  demo              · run the seeded movement/multi-location/ambiguous scenarios");
      process.exit(0);
    }
    if (sub === "status") {
      const { readAllBusinesses, readAllPlacements, readAllChanges } = await import(
        "../src/lib/nex/entity-universe/persistence.ts"
      );
      const businesses = readAllBusinesses();
      const placements = readAllPlacements();
      const changes = readAllChanges();
      const active = placements.filter((p) => p.status === "ACTIVE").length;
      const historical = placements.filter((p) => p.status === "HISTORICAL").length;
      const closed = placements.filter((p) => p.status === "CLOSED").length;
      const ambig = placements.filter((p) => p.status === "AMBIGUOUS" || p.status === "CONFLICTING").length;
      console.log(`NEX Entity Universe · status`);
      console.log(`  businesses            : ${businesses.length}`);
      console.log(`  placements            : ${placements.length}`);
      console.log(`    active              : ${active}`);
      console.log(`    historical          : ${historical}`);
      console.log(`    closed              : ${closed}`);
      console.log(`    ambiguous/conflict  : ${ambig}`);
      console.log(`  change records        : ${changes.length}`);
      process.exit(0);
    }
    if (sub === "business") {
      const id = process.argv[4];
      if (!id) { console.error("usage: universe business <id>"); process.exit(2); }
      const { readBusinessDetail } = await import("../src/lib/nex/entity-universe/query.ts");
      const detail = readBusinessDetail(id);
      if (!detail) { console.error(`business_not_found: ${id}`); process.exit(1); }
      console.log(JSON.stringify(detail, null, 2));
      process.exit(0);
    }
    if (sub === "demo") {
      // Run the seeded scenarios — same as the live proof script but as
      // a one-shot local demo the Founder can invoke to see the primitives.
      const path = await import("node:path");
      const { spawn } = await import("node:child_process");
      const demoScript = path.default.join(repoRoot, "tests", "fixtures", "conversation-followup-proof", "_agent_runtime_phase_b_live_probes.mjs");
      const child = spawn("npx", ["tsx", demoScript], { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, NEX_LIVE_PROBE_INNER: "1" } });
      child.on("exit", (code) => process.exit(code ?? 1));
      return;
    }
    console.error(`unknown universe subcommand: ${sub}`);
    process.exit(2);
  }

  if (cmd === "scheduled-task") {
    const sub = process.argv[3];
    if (!sub || sub === "help") {
      console.log("Usage: node scripts/nex-agents.mjs scheduled-task <install|uninstall|status>");
      console.log("  install    · register per-user Scheduled Task (no admin required)");
      console.log("  uninstall  · remove the per-user task");
      console.log("  status     · show current registration");
      process.exit(0);
    }
    const { spawn } = await import("node:child_process");
    if (sub === "install") {
      const script = "scripts\\install-nex-agent-scheduled-task.ps1";
      const child = spawn("powershell", ["-ExecutionPolicy", "Bypass", "-File", script], { stdio: "inherit", cwd: repoRoot, shell: true });
      child.on("exit", (code) => process.exit(code ?? 1));
      return;
    }
    if (sub === "uninstall") {
      const script = "scripts\\uninstall-nex-agent-scheduled-task.ps1";
      const child = spawn("powershell", ["-ExecutionPolicy", "Bypass", "-File", script], { stdio: "inherit", cwd: repoRoot, shell: true });
      child.on("exit", (code) => process.exit(code ?? 1));
      return;
    }
    if (sub === "status") {
      const child = spawn("powershell", ["-Command", "Get-ScheduledTask -TaskName 'NEX-Agent-Runtime-User' -ErrorAction SilentlyContinue | Select-Object TaskName,State,Author,Description | Format-List"], { stdio: "inherit", cwd: repoRoot, shell: true });
      child.on("exit", (code) => process.exit(code ?? 1));
      return;
    }
    console.error(`unknown scheduled-task subcommand: ${sub}`);
    process.exit(2);
  }

  if (cmd === "start" || cmd === "stop") {
    const t = String(target || "").toLowerCase();
    if (t !== "all" && t !== "programmer" && t !== "accommodation" && t !== "master_ai" && t !== "speaking" && t !== "vision" && t !== "travel" && t !== "business") {
      console.error(`invalid target: ${target} · expected all|programmer|accommodation|master_ai|speaking|vision|travel|business`);
      process.exit(2);
    }
    const authIn = {
      founder_user_id: founderIdMock,
      authorization: "AUTHORIZED",
      authorization_reason: `local_cli:${founderIdMock}`,
    };
    if (cmd === "start" && t === "all") {
      const r = await startAll(authIn);
      console.log(JSON.stringify(r, null, 2));
    } else if (cmd === "stop" && t === "all") {
      const r = await stopAll(authIn);
      console.log(JSON.stringify(r, null, 2));
    } else if (cmd === "start") {
      const r = await startAgent({ ...authIn, agent_id: t });
      console.log(JSON.stringify(r, null, 2));
    } else if (cmd === "stop") {
      const r = await stopAgent({ ...authIn, agent_id: t });
      console.log(JSON.stringify(r, null, 2));
    }
    process.exit(0);
  }

  console.error("Unknown command: " + cmd);
  process.exit(2);
}
