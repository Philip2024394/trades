#!/usr/bin/env node
// heartbeat-liveness.test.mjs · Phase 12.3
//
// Proves the worker heartbeat layer:
//   - writes real heartbeats before + after every worker call
//   - primes standby heartbeats at cycle start so idle workers don't
//     look identical to offline workers
//   - derives Working / Waiting_AI / Standby / Failed / Offline from
//     heartbeat freshness + last-cycle status, NEVER from queue depth
//   - swallows write failures so observability can't break the runtime
//
// Two sections:
//   A · Static · greps the source for required contracts (import
//       wiring · hook points · no fake progress markers · endpoint).
//   B · Logic · imports heartbeat.ts and exercises deriveLiveness with
//       synthetic heartbeat rows for every state transition.
//
// Assertions:
//   HB1   · heartbeat.ts exports LIVENESS_THRESHOLD_MS = 60_000
//   HB2   · heartbeat.ts exports BRAIN_WORKER_TYPES with 6 entries
//   HB3   · workerHostId returns "<worker_type>@<pid>"
//   HB4   · writeHeartbeat is async + wrapped in try/catch (never throws)
//   HB5   · primeStandbyHeartbeats writes for every BRAIN_WORKER_TYPES entry
//   HB6   · deriveLiveness returns "offline" for null heartbeat
//   HB7   · deriveLiveness returns "offline" for heartbeat older than threshold
//   HB8   · deriveLiveness returns "standby" for fresh heartbeat with status=standby
//   HB9   · deriveLiveness returns "working" for fresh heartbeat with status=working
//   HB10  · deriveLiveness returns "failed" for fresh heartbeat with status=failed
//   HB11  · deriveLiveness returns "waiting_llm" for fresh heartbeat with status=waiting_llm
//   HB12  · deriveLiveness NEVER accepts queue-depth arguments (function signature check)
//   HB13  · Standby vs Offline distinction · same heartbeat · only time changes
//   HB14  · manager.ts imports writeHeartbeat + primeStandbyHeartbeats
//   HB15  · withAuditEvents writes "working" heartbeat BEFORE runner
//   HB16  · withAuditEvents writes "standby" heartbeat AFTER successful runner
//   HB17  · withAuditEvents writes "failed" heartbeat when runner throws
//   HB18  · runOneCycle calls primeStandbyHeartbeats() at start (before drain)
//   HB19  · heartbeat.ts contains no Math.random / setInterval / fake progress
//   HB20  · /api/nex/brain/workers-live endpoint exists + reads listHeartbeats
//   HB21  · workers-live endpoint reports all 5 states in totals

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");

const HEARTBEAT = readFileSync(join(REPO, "src/lib/nex/brain/heartbeat.ts"), "utf8");
const MANAGER   = readFileSync(join(REPO, "src/lib/nex/brain/manager.ts"),   "utf8");
const ENDPOINT  = readFileSync(join(REPO, "src/app/api/nex/brain/workers-live/route.ts"), "utf8");

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

// ═════════════════════════════════════════════════════════════════════
// SECTION A · STATIC · greps the source for required contracts
// ═════════════════════════════════════════════════════════════════════

// HB1 · threshold constant declared with expected value
record("HB1",
  /export const LIVENESS_THRESHOLD_MS\s*=\s*60_000/.test(HEARTBEAT),
  "LIVENESS_THRESHOLD_MS = 60_000 exported");

// HB2 · exactly 6 worker types in BRAIN_WORKER_TYPES
const workerTypesMatch = HEARTBEAT.match(/export const BRAIN_WORKER_TYPES:\s*WorkerType\[\]\s*=\s*\[([\s\S]*?)\]/);
const workerTypesCount = workerTypesMatch
  ? (workerTypesMatch[1].match(/"[a-z-]+"/g) ?? []).length
  : 0;
record("HB2", workerTypesCount === 6,
  `BRAIN_WORKER_TYPES has ${workerTypesCount} entries (expected 6)`);

// HB3 · workerHostId formula
record("HB3",
  /export function workerHostId\(worker_type: WorkerType\): string\s*\{\s*return\s*`\$\{worker_type\}@\$\{process\.pid\}`;?\s*\}/.test(HEARTBEAT),
  "workerHostId returns worker_type@pid");

// HB4 · writeHeartbeat is async + inner try/catch (never throws)
const writeMatch = HEARTBEAT.match(/export async function writeHeartbeat[\s\S]*?^\}/m);
const writeBlock = writeMatch ? writeMatch[0] : "";
record("HB4",
  /export async function writeHeartbeat/.test(HEARTBEAT)
    && /try\s*\{/.test(writeBlock)
    && /\}\s*catch\s*\(err\)/.test(writeBlock),
  "writeHeartbeat is async + wraps store call in try/catch");

// HB5 · primeStandbyHeartbeats iterates over BRAIN_WORKER_TYPES
record("HB5",
  /export async function primeStandbyHeartbeats/.test(HEARTBEAT)
    && /BRAIN_WORKER_TYPES\.map\(\(wt\)\s*=>[\s\S]*?writeHeartbeat\(/.test(HEARTBEAT)
    && /status:\s*"standby"/.test(HEARTBEAT),
  "primeStandbyHeartbeats writes standby for every worker type");

// HB12 · deriveLiveness signature has NO queue argument
const deriveSignature = HEARTBEAT.match(/export function deriveLiveness\(([\s\S]*?)\):\s*WorkerLiveness/);
const deriveArgs = deriveSignature ? deriveSignature[1] : "";
const noQueueArg = !/queue/i.test(deriveArgs) && !/depth/i.test(deriveArgs) && !/jobs/i.test(deriveArgs);
record("HB12", noQueueArg,
  `deriveLiveness signature args = "${deriveArgs.replace(/\s+/g, " ").trim()}" (no queue/depth/jobs)`);

// HB14 · manager imports heartbeat helpers
record("HB14",
  /import\s*\{\s*primeStandbyHeartbeats,\s*writeHeartbeat\s*\}\s*from\s*"\.\/heartbeat"/.test(MANAGER),
  "manager.ts imports primeStandbyHeartbeats + writeHeartbeat");

// HB15 · withAuditEvents writes "working" BEFORE the runner
const withAuditBlock = MANAGER.match(/async function withAuditEvents[\s\S]*?^\}/m)?.[0] ?? "";
const workingBefore = /writeHeartbeat\(\{[\s\S]{0,120}?status:\s*"working"[\s\S]{0,200}?\}\);[\s\S]{0,200}?await runner\(\)/.test(withAuditBlock);
record("HB15", workingBefore,
  "withAuditEvents writes status=working before runner()");

// HB16 · withAuditEvents writes "standby" AFTER successful runner
const standbyAfter = /await runner\(\)[\s\S]{0,3000}?writeHeartbeat\(\{[\s\S]{0,300}?status:\s*"standby"[\s\S]{0,300}?\}\)/.test(withAuditBlock);
record("HB16", standbyAfter,
  "withAuditEvents writes status=standby after successful runner");

// HB17 · withAuditEvents writes "failed" on throw
const failedOnThrow = /catch\s*\(err\)\s*\{[\s\S]{0,900}?writeHeartbeat\(\{[\s\S]{0,300}?status:\s*"failed"/.test(withAuditBlock);
record("HB17", failedOnThrow,
  "withAuditEvents writes status=failed on runner throw");

// HB18 · runOneCycle calls primeStandbyHeartbeats at start
const runOneCycleMatch = MANAGER.match(/export async function runOneCycle[\s\S]*?const contextsAssembled/);
const primeAtStart = runOneCycleMatch && /await primeStandbyHeartbeats\(\);/.test(runOneCycleMatch[0]);
record("HB18", !!primeAtStart,
  "runOneCycle calls primeStandbyHeartbeats() before drain begins");

// HB19 · no fake/random progress in heartbeat module
const fakeMarkers = /Math\.random|setInterval|setTimeout|fake|mock/i.test(HEARTBEAT);
record("HB19", !fakeMarkers,
  "heartbeat.ts has no Math.random / setInterval / setTimeout / fake / mock");

// HB20 · endpoint reads listHeartbeats + imports deriveLiveness
record("HB20",
  /listHeartbeats\(\{[\s\S]{0,200}?since/.test(ENDPOINT)
    && /import[\s\S]*?deriveLiveness[\s\S]*?from\s*"@\/lib\/nex\/brain\/heartbeat"/.test(ENDPOINT),
  "workers-live endpoint reads listHeartbeats + imports deriveLiveness");

// HB21 · endpoint response shape lists all 5 states in totals
const allFiveStatesInTotals =
  /working:\s*workers\.filter/.test(ENDPOINT) &&
  /waiting_llm:\s*workers\.filter/.test(ENDPOINT) &&
  /standby:\s*workers\.filter/.test(ENDPOINT) &&
  /failed:\s*workers\.filter/.test(ENDPOINT) &&
  /offline:\s*workers\.filter/.test(ENDPOINT);
record("HB21", allFiveStatesInTotals,
  "workers-live totals include working/waiting_llm/standby/failed/offline");

// ═════════════════════════════════════════════════════════════════════
// SECTION B · LOGIC · import heartbeat.ts + exercise deriveLiveness
// ═════════════════════════════════════════════════════════════════════

// Dynamic import via ts-node-esque loader isn't available here — use
// esbuild-registered runtime if present, otherwise transpile inline
// with a minimal type-strip. For test purposes we just re-implement
// the derive logic in JS from the exported spec and assert against it.

// Transpile heartbeat.ts on the fly using esbuild (already a project
// dep). This avoids a brittle regex type-strip while keeping the test
// hermetic to a single file. We strip the `import`/`export` lines that
// reference other modules and just extract the pure functions we need.
const esbuild = await import("esbuild");
const stripped = HEARTBEAT
  .replace(/^import[\s\S]*?;$/gm, "")   // drop cross-module imports
  .replace(/^export\s+/gm, "");          // demote exports to locals
const transformed = await esbuild.transform(stripped, {
  loader: "ts",
  format: "cjs",
  target: "node20",
});
const evalSrc = transformed.code + `
module.exports = { LIVENESS_THRESHOLD_MS, deriveLiveness };
`;
// eslint-disable-next-line no-new-func
const modFactory = new Function("module", "process", "exports", "require", evalSrc);
const mod = { exports: {} };
try {
  modFactory(mod, process, mod.exports, () => ({}));
} catch (err) {
  record("HB-LOAD", false, `esbuild eval failed: ${err.message}`);
  process.stdout.write(`\nheartbeat-liveness: aborted\n`);
  process.exit(1);
}
const { LIVENESS_THRESHOLD_MS, deriveLiveness } = mod.exports;

const now = 1_000_000_000_000; // pinned "now" in ms
const freshIso = new Date(now - 5_000).toISOString();
const staleIso = new Date(now - 90_000).toISOString();

// HB6 · null heartbeat = offline
record("HB6", deriveLiveness(null, now) === "offline",
  "null heartbeat → offline");

// HB7 · stale heartbeat = offline
record("HB7",
  deriveLiveness({
    host_id: "test", last_seen_at: staleIso, uptime_ms: 0, cycles_total: 0,
    cycles_failed: 0, last_error: null, last_cycle_summary: { status: "standby" }, metadata: null,
  }, now) === "offline",
  "heartbeat older than 60s → offline");

// HB8 · fresh + standby
record("HB8",
  deriveLiveness({
    host_id: "test", last_seen_at: freshIso, uptime_ms: 0, cycles_total: 0,
    cycles_failed: 0, last_error: null, last_cycle_summary: { status: "standby" }, metadata: null,
  }, now) === "standby",
  "fresh heartbeat + status=standby → standby");

// HB9 · fresh + working
record("HB9",
  deriveLiveness({
    host_id: "test", last_seen_at: freshIso, uptime_ms: 0, cycles_total: 0,
    cycles_failed: 0, last_error: null, last_cycle_summary: { status: "working" }, metadata: null,
  }, now) === "working",
  "fresh heartbeat + status=working → working");

// HB10 · fresh + failed
record("HB10",
  deriveLiveness({
    host_id: "test", last_seen_at: freshIso, uptime_ms: 0, cycles_total: 0,
    cycles_failed: 1, last_error: "boom", last_cycle_summary: { status: "failed" }, metadata: null,
  }, now) === "failed",
  "fresh heartbeat + status=failed → failed");

// HB11 · fresh + waiting_llm
record("HB11",
  deriveLiveness({
    host_id: "test", last_seen_at: freshIso, uptime_ms: 0, cycles_total: 0,
    cycles_failed: 0, last_error: null, last_cycle_summary: { status: "waiting_llm" }, metadata: null,
  }, now) === "waiting_llm",
  "fresh heartbeat + status=waiting_llm → waiting_llm");

// HB13 · Standby vs Offline · same heartbeat body · only time differs
const hb = {
  host_id: "test", last_seen_at: freshIso, uptime_ms: 0, cycles_total: 0,
  cycles_failed: 0, last_error: null, last_cycle_summary: { status: "standby" }, metadata: null,
};
const asStandby = deriveLiveness(hb, now);
const asOffline = deriveLiveness(hb, now + 120_000); // 2 min later
record("HB13", asStandby === "standby" && asOffline === "offline",
  `same hb: standby-at-now=${asStandby} · offline-at-now+120s=${asOffline}`);

// Also sanity-check the threshold constant round-trips
record("HB1b", LIVENESS_THRESHOLD_MS === 60_000,
  "runtime LIVENESS_THRESHOLD_MS === 60_000");

const passed = results.filter((r) => r.pass).length;
const total  = results.length;
process.stdout.write(`\nheartbeat-liveness: ${passed}/${total} assertions passed\n`);
process.exit(passed === total ? 0 : 1);
