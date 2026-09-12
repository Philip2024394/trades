#!/usr/bin/env node
// scripts/nex-agent-runtime.mjs
//
// NEX Agent Runtime · daemon entry point
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · §31 real process boundary
//
// Two-step pattern (proven working in scripts/walkers/run-supervisor.mjs):
//   1. Outer .mjs: re-invoke self via `npx tsx --env-file=.env.local`
//      so subsequent dynamic imports resolve TypeScript modules.
//   2. Inner call (identified by NEX_AGENT_RUNTIME_INNER=1): register
//      signal handlers, write the PID record, dispatch to the correct
//      worker, poll desired_state, exit gracefully on stop.
//
// This file MUST stay plain .mjs — control-plane.ts spawns it via
// `process.execPath` (= node) for maximum portability.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);

// Parse --agent=<id>
function readAgentIdFromArgv() {
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--agent=(programmer|accommodation|master_ai|speaking|vision|travel|business|food|construction|healthcare|transport)$/);
    if (m) return m[1];
  }
  return null;
}

const AGENT_ID = readAgentIdFromArgv();
if (!AGENT_ID) {
  console.error("[nex-agent-runtime] FAIL: --agent=<programmer|accommodation|master_ai|speaking|vision|travel|business|food|construction|healthcare|transport> required");
  process.exit(2);
}

// ── OUTER: re-invoke via npx tsx ─────────────────────────────────────
if (!process.env.NEX_AGENT_RUNTIME_INNER) {
  const envFileArgs = fs.existsSync(path.join(repoRoot, ".env.local"))
    ? ["--env-file=.env.local"]
    : [];
  const child = spawn(
    "npx",
    ["tsx", ...envFileArgs, entryFile, ...process.argv.slice(2)],
    {
      stdio: "inherit",
      cwd: repoRoot,
      shell: true,
      env: { ...process.env, NEX_AGENT_RUNTIME_INNER: "1" },
    },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

// ── INNER: real worker execution ────────────────────────────────────
async function inner() {
  const [
    { runProgrammerWorker },
    { runAccommodationWorker },
    { runMasterAiWorker },
    { runSpeakingWorker },
    { runVisionWorker },
    { runTravelWorker },
    { runBusinessWorker },
    { runFoodWorker },
    { runConstructionWorker },
    { runHealthcareWorker },
    { runTransportWorker },
  ] = await Promise.all([
    import("../src/lib/nex/agent-runtime/worker-programmer.ts"),
    import("../src/lib/nex/agent-runtime/worker-accommodation.ts"),
    import("../src/lib/nex/agent-runtime/worker-master-ai.ts"),
    import("../src/lib/nex/agent-runtime/worker-speaking.ts"),
    import("../src/lib/nex/agent-runtime/worker-vision.ts"),
    import("../src/lib/nex/agent-runtime/worker-travel.ts"),
    import("../src/lib/nex/agent-runtime/worker-business.ts"),
    import("../src/lib/nex/agent-runtime/worker-food.ts"),
    import("../src/lib/nex/agent-runtime/worker-construction.ts"),
    import("../src/lib/nex/agent-runtime/worker-healthcare.ts"),
    import("../src/lib/nex/agent-runtime/worker-transport.ts"),
  ]);
  const { writePidRecord, clearPidRecord, clearHeartbeat } = await import(
    "../src/lib/nex/agent-runtime/heartbeat.ts"
  );
  const { emitEvent } = await import("../src/lib/nex/agent-runtime/event-bus.ts");
  const { getPosition } = await import(
    "../src/lib/nex/agent-runtime/registry.ts"
  );
  const { AGENT_RUNTIME_VERSION } = await import(
    "../src/lib/nex/agent-runtime/types.ts"
  );

  const commandLine = [entryFile, ...process.argv.slice(2)].join(" ");
  writePidRecord({
    agent_id: AGENT_ID,
    pid: process.pid,
    started_at_iso: new Date().toISOString(),
    runtime_version: AGENT_RUNTIME_VERSION,
    command_line: commandLine,
  });

  let shouldStop = false;
  const stopSignal = () => {
    if (shouldStop) return;
    shouldStop = true;
    emitEvent({
      kind: "AGENT_STOP_REQUESTED",
      agent_id: AGENT_ID,
      process_id: process.pid,
      attributes: { via: "signal" },
    });
  };
  process.on("SIGINT", stopSignal);
  process.on("SIGTERM", stopSignal);
  process.on("SIGBREAK", stopSignal);   // Windows Ctrl+Break

  // Poll registry for desired_state=STOPPED every 2s (secondary channel
  // in case signal doesn't reach us for any reason).
  const registryPoller = setInterval(() => {
    try {
      const pos = getPosition(AGENT_ID);
      if (pos && pos.desired_state === "STOPPED" && !shouldStop) {
        stopSignal();
      }
    } catch { /* transient FS error, next tick */ }
  }, 2000);

  const control = {
    shouldStop: () => shouldStop,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => Date.now(),
  };

  try {
    if (AGENT_ID === "programmer") {
      await runProgrammerWorker(control);
    } else if (AGENT_ID === "accommodation") {
      await runAccommodationWorker(control);
    } else if (AGENT_ID === "master_ai") {
      await runMasterAiWorker(control);
    } else if (AGENT_ID === "speaking") {
      await runSpeakingWorker(control);
    } else if (AGENT_ID === "vision") {
      await runVisionWorker(control);
    } else if (AGENT_ID === "travel") {
      await runTravelWorker(control);
    } else if (AGENT_ID === "business") {
      await runBusinessWorker(control);
    } else if (AGENT_ID === "food") {
      await runFoodWorker(control);
    } else if (AGENT_ID === "construction") {
      await runConstructionWorker(control);
    } else if (AGENT_ID === "healthcare") {
      await runHealthcareWorker(control);
    } else if (AGENT_ID === "transport") {
      await runTransportWorker(control);
    }
  } catch (err) {
    emitEvent({
      kind: "AGENT_CRASHED",
      agent_id: AGENT_ID,
      process_id: process.pid,
      attributes: { error: String(err).slice(0, 400) },
    });
    clearInterval(registryPoller);
    clearPidRecord(AGENT_ID);
    clearHeartbeat(AGENT_ID);
    process.exit(1);
  }

  // Graceful exit path
  clearInterval(registryPoller);
  clearPidRecord(AGENT_ID);
  clearHeartbeat(AGENT_ID);
  process.exit(0);
}
