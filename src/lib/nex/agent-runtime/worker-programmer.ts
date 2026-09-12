// src/lib/nex/agent-runtime/worker-programmer.ts
//
// NEX Agent Runtime · Programmer Agent worker loop (§5 · §6 · §7 · §40)
// Philip 2026-09-06 · FOUNDER AUTHORIZATION
//
// Runs inside the detached child_process spawned by control-plane.ts.
// Does REAL work (§40) — never emits fabricated runs. Phase-A worker
// scope is deliberately conservative:
//
//   1. Observe: read the tail of programmer-learning JSONL event files
//      and emit LEARNING_OBSERVED events for anything new since the
//      last tick. (Real read of real files, real diff.)
//   2. Record: append every observation to the event bus so the
//      Founder can independently audit.
//
// §7 discipline: this Phase A worker DOES NOT itself create/test/promote
// candidates. That would require invoking the full programmer-improvement
// loop, which is authorized independently. Candidate creation stays a
// separate authorized action — the always-on worker only OBSERVES.
//
// §6: never modifies protected paths · never falsifies runs · never
// weakens tests · never disables assertions · never grants itself
// permissions.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentId, Heartbeat } from "./types";
import { AGENT_RUNTIME_VERSION } from "./types";
import { writeHeartbeat } from "./heartbeat";
import { emitEvent } from "./event-bus";
import { cachedInternetState, probeInternet } from "./internet-check";
import { getPosition } from "./registry";

const AGENT: AgentId = "programmer";

/** Tracks how many bytes we've already observed in each learning file so
 *  re-reads on the next tick only surface truly new content. */
const OBSERVED_BYTES = new Map<string, number>();

type LoopControl = {
  shouldStop: () => boolean;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

const LEARNING_DIRS_TO_OBSERVE = [
  "data/programmer-improvement",
  "data/programmer-learning",
  "data/programmer-review",
  "data/programmer-execution",
];

function existingLearningFiles(): string[] {
  const out: string[] = [];
  for (const d of LEARNING_DIRS_TO_OBSERVE) {
    const abs = path.join(process.cwd(), d);
    try {
      if (!fs.existsSync(abs)) continue;
      const entries = fs.readdirSync(abs);
      for (const e of entries) {
        if (e.endsWith(".jsonl") || e.endsWith(".json")) out.push(path.join(abs, e));
      }
    } catch { /* skip inaccessible dirs */ }
  }
  return out;
}

/** Read the tail of a file since we last observed it. Never loads the
 *  full file into memory when the file is large — only the new bytes. */
function readNewBytesSince(filePath: string): { newContent: string; newSize: number } {
  const prior = OBSERVED_BYTES.get(filePath) ?? 0;
  try {
    const stat = fs.statSync(filePath);
    if (stat.size === prior) return { newContent: "", newSize: prior };
    if (stat.size < prior) {
      // File was truncated / rotated — reset tracking.
      OBSERVED_BYTES.set(filePath, stat.size);
      return { newContent: "", newSize: stat.size };
    }
    const fd = fs.openSync(filePath, "r");
    try {
      const bytes = stat.size - prior;
      const buf = Buffer.alloc(bytes);
      fs.readSync(fd, buf, 0, bytes, prior);
      OBSERVED_BYTES.set(filePath, stat.size);
      return { newContent: buf.toString("utf8"), newSize: stat.size };
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return { newContent: "", newSize: prior };
  }
}

/** Emit heartbeat with current task info. Called once per outer tick. */
function beat(status: Heartbeat["status"], currentTask: string | null, runId: string): void {
  const internet = cachedInternetState();
  writeHeartbeat({
    agent_id: AGENT,
    run_id: runId,
    process_id: process.pid,
    timestamp_iso: new Date().toISOString(),
    status,
    current_task: currentTask,
    last_success_iso: LAST_SUCCESS_ISO,
    last_failure_iso: LAST_FAILURE_ISO,
    internet_state: internet.state,
    runtime_version: AGENT_RUNTIME_VERSION,
  });
}

let LAST_SUCCESS_ISO: string | null = null;
let LAST_FAILURE_ISO: string | null = null;

/** One observation tick. Returns count of newly observed items. */
function observationTick(runId: string): number {
  let observedCount = 0;
  const files = existingLearningFiles();
  for (const f of files) {
    const { newContent } = readNewBytesSince(f);
    if (!newContent) continue;
    const lines = newContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    for (const line of lines) {
      // Never parse-then-summarise — Phase A worker records that
      // SOMETHING was observed, without claiming any interpretation.
      // Interpretation belongs to the programmer-improvement candidate
      // path, which is authorized separately.
      emitEvent({
        kind: "LEARNING_OBSERVED",
        agent_id: AGENT,
        process_id: process.pid,
        attributes: {
          source_file: path.relative(process.cwd(), f),
          line_length: line.length,
          run_id: runId,
        },
      });
      observedCount++;
    }
  }
  return observedCount;
}

/** Poll for one Master AI delegation and process it end-to-end.
 *  Bounded per tick · never mutates code (Phase A observation-only).
 *  Restart-safe · duplicate-safe · fail-closed.
 *
 *  Y-W4-3 closure wire: MASTER AI THINKS → PROGRAMMER ACTS →
 *  MASTER AI MEASURES → MASTER AI LEARNS. */
async function delegationPollTick(runId: string): Promise<{ processed: boolean; delegation_id: string | null; final_status: string | null; reason: string }> {
  // Deferred import · master-ai modules live outside agent-runtime
  const { getNextClaimablePending } = await import("../master-ai/delegation");
  const { processOneDelegation } = await import("../master-ai/delegation-executor");
  const next = getNextClaimablePending(AGENT);
  if (!next) return { processed: false, delegation_id: null, final_status: null, reason: "no_pending_delegation" };
  const outcome = await processOneDelegation({
    delegation_id: next.delegation_id,
    recipient: AGENT,
    claimer_id: runId,
  });
  return {
    processed: outcome.attempted,
    delegation_id: next.delegation_id,
    final_status: outcome.final_status,
    reason: outcome.reason,
  };
}

/** Entry point — called by the daemon script. Runs until shouldStop()
 *  returns true. Emits heartbeat every outer iteration. */
export async function runProgrammerWorker(control: LoopControl): Promise<void> {
  const runId = randomUUID();
  const position = getPosition(AGENT);
  const observationCadenceMs = 30_000;      // observe file tail every 30s
  const heartbeatCadenceMs = position?.heartbeat_interval_ms ?? 5_000;
  const internetProbeCadenceMs = 60_000;    // probe once per minute
  const delegationCadenceMs = 60_000;       // poll delegation ledger every 60s

  emitEvent({
    kind: "AGENT_STARTED",
    agent_id: AGENT,
    process_id: process.pid,
    attributes: { run_id: runId, runtime_version: AGENT_RUNTIME_VERSION },
  });
  beat("STARTING", "initializing", runId);

  // Prime OBSERVED_BYTES so the first tick doesn't dump the entire
  // historical file as "new" — we start observing from now, not from
  // the beginning of time.
  for (const f of existingLearningFiles()) {
    try { OBSERVED_BYTES.set(f, fs.statSync(f).size); } catch { /* ignore */ }
  }

  await probeInternet().catch(() => { /* offline is fine */ });
  beat("RUNNING", "idle", runId);

  let lastObservation = 0;
  let lastInternetProbe = Date.now();
  let lastDelegationPoll = 0;

  while (!control.shouldStop()) {
    const nowMs = control.now();

    if (nowMs - lastInternetProbe >= internetProbeCadenceMs) {
      await probeInternet().catch(() => { /* offline is fine */ });
      lastInternetProbe = nowMs;
    }

    if (nowMs - lastObservation >= observationCadenceMs) {
      try {
        beat("RUNNING", "observing_engineering_events", runId);
        const n = observationTick(runId);
        LAST_SUCCESS_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_COMPLETED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: { work: "observation_tick", observed_count: n, run_id: runId },
        });
      } catch (err) {
        LAST_FAILURE_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_FAILED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: { work: "observation_tick", error: (err as Error).message.slice(0, 200) },
        });
      }
      lastObservation = nowMs;
    }

    // Y-W4-3 · Delegation poll · bounded per tick · never mutates code
    if (nowMs - lastDelegationPoll >= delegationCadenceMs) {
      try {
        beat("RUNNING", "polling_master_ai_delegations", runId);
        const result = await delegationPollTick(runId);
        if (result.processed) {
          LAST_SUCCESS_ISO = new Date().toISOString();
          emitEvent({
            kind: "WORK_COMPLETED",
            agent_id: AGENT,
            process_id: process.pid,
            attributes: {
              work: "delegation_processed",
              delegation_id: result.delegation_id,
              final_status: result.final_status,
              run_id: runId,
            },
          });
        }
      } catch (err) {
        LAST_FAILURE_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_FAILED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: { work: "delegation_poll", error: (err as Error).message.slice(0, 200) },
        });
      }
      lastDelegationPoll = nowMs;
    }

    beat("RUNNING", "idle", runId);
    await control.sleep(heartbeatCadenceMs);
  }

  beat("STOPPING", "shutting_down", runId);
  emitEvent({
    kind: "AGENT_STOPPED",
    agent_id: AGENT,
    process_id: process.pid,
    attributes: { run_id: runId, reason: "should_stop_signalled" },
  });
}
