// P4 OBSERVATION HARNESS · autonomous scheduler for the P4 proof window.
//
// Philip 2026-08-26 · P4 = "moment we find out whether NEX walks without Claude."
//
// This is the SCHEDULER for the P4 test. It runs rotation-tick + orchestrator-tick
// on compressed cadences (rotation 90s / orchestrator 60s) so the observation
// window is manageable while still being fully autonomous · Claude does not
// invoke walkers or repair state during operation.
//
// Env NEX_ORCHESTRATOR_ENABLED=true is REQUIRED · orchestrator-tick's own gate
// refuses to spawn walkers otherwise.
//
// Auto-exits after HARNESS_LIFESPAN_MS to bound the observation window.
//
// Usage (background):
//   NEX_POSTGRES_URL=... NEX_ORCHESTRATOR_ENABLED=true \
//     node scripts/nex-discovery-rotation/p4-observation-harness.mjs \
//     > .cache/p4-harness.log 2>&1 &

import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const LOG_PATH             = ".cache/p4-harness.log";
const ROTATION_TICK_MS     = 90_000;   // compressed from 600s
const ORCHESTRATOR_TICK_MS = 60_000;   // matches production
const HARNESS_LIFESPAN_MS  = 20 * 60_000;  // 20 minutes hard cap

try { mkdirSync(dirname(LOG_PATH), { recursive: true }); } catch {}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try { appendFileSync(LOG_PATH, line); } catch {}
}

function runTick(script, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], {
      env: { ...process.env, ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function rotationTick() {
  const started = Date.now();
  const r = await runTick("scripts/nex-discovery-rotation/_rotation-tick.mjs");
  const ms = Date.now() - started;
  // Extract state summary from stdout
  const stateLine = r.stdout.split("\n").find((l) => l.includes("by state"))?.trim();
  log(`rotation-tick · exit=${r.code} · ${ms}ms · ${stateLine ?? "(no state line)"}`);
  if (r.code !== 0) log(`  stderr: ${r.stderr.slice(0, 300)}`);
}

async function orchestratorTick() {
  const started = Date.now();
  const r = await runTick("scripts/nex-discovery-orchestrator/_orchestrator-tick.mjs", {
    NEX_ORCHESTRATOR_ENABLED: "true",
  });
  const ms = Date.now() - started;
  const queueLine = r.stdout.split("\n").find((l) => l.includes("Queue:"))?.trim();
  const spawnLine = r.stdout.split("\n").find((l) => l.includes("Spawning") || l.includes("spawned"))?.trim();
  log(`orchestrator-tick · exit=${r.code} · ${ms}ms · ${queueLine ?? "(no queue line)"}${spawnLine ? " · " + spawnLine : ""}`);
  if (r.code !== 0) log(`  stderr: ${r.stderr.slice(0, 300)}`);
}

async function main() {
  log(`P4 harness starting · rotation=${ROTATION_TICK_MS/1000}s · orchestrator=${ORCHESTRATOR_TICK_MS/1000}s · lifespan=${HARNESS_LIFESPAN_MS/60000}min`);
  log(`env NEX_ORCHESTRATOR_ENABLED=${process.env.NEX_ORCHESTRATOR_ENABLED ?? "(unset)"}`);

  // Kick off with an immediate tick of each so the observation window starts productive.
  await rotationTick();
  await orchestratorTick();

  const rotationTimer     = setInterval(rotationTick,     ROTATION_TICK_MS);
  const orchestratorTimer = setInterval(orchestratorTick, ORCHESTRATOR_TICK_MS);

  setTimeout(() => {
    log("P4 harness lifespan reached · shutting down");
    clearInterval(rotationTimer);
    clearInterval(orchestratorTimer);
    process.exit(0);
  }, HARNESS_LIFESPAN_MS);

  process.on("SIGTERM", () => { log("SIGTERM · shutting down"); process.exit(0); });
  process.on("SIGINT",  () => { log("SIGINT · shutting down");  process.exit(0); });
}

main().catch((err) => { log(`fatal: ${err.message}`); process.exit(1); });
