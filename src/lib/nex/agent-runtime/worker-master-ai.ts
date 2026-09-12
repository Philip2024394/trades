// src/lib/nex/agent-runtime/worker-master-ai.ts
//
// NEX Master AI Engineer · Observer Daemon Worker (Wave-3)
// Philip 2026-09-07 · AUTHORIZE
//
// The 24/7 observation intelligence worker. Runs inside a detached
// child_process spawned by control-plane.ts, honours the same
// heartbeat/PID/founder-stop discipline as the other workers.
//
// DISCIPLINE:
//   · READ-ONLY against every observed agent. Every downstream write
//     lands under data/master-ai/. Never touches heartbeat / events /
//     PID / any specialist agent's data.
//   · Cadences (§4):
//       FAST_HEALTH   : observatoryTick + heartbeat evidence               (30s)
//       DEEP_INTEL    : failure aggregation + trend analysis + reconciles (5m)
//       DAILY_INTEL   : composeDaily + Philip Intelligence composition   (24h)
//       SELF_CRITIC   : self-evaluation pass                              (6h)
//   · Bounded per-tick work · never runs indefinite subtasks.
//   · Honours founder-stop-override via the same registry the watchdog
//     reads.
//   · Emits events on the shared runtime event bus so the watchdog +
//     status CLI can see it.

import { randomUUID } from "node:crypto";
import type { AgentId, Heartbeat } from "./types";
import { AGENT_RUNTIME_VERSION } from "./types";
import { writeHeartbeat } from "./heartbeat";
import { emitEvent } from "./event-bus";
import { cachedInternetState, probeInternet } from "./internet-check";
import { getPosition } from "./registry";

const AGENT: AgentId = "master_ai";

type LoopControl = {
  shouldStop: () => boolean;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

let LAST_SUCCESS_ISO: string | null = null;
let LAST_FAILURE_ISO: string | null = null;

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

/** Entry point · called by nex-agent-runtime.mjs when --agent=master_ai. */
export async function runMasterAiWorker(control: LoopControl): Promise<void> {
  const runId = randomUUID();
  const position = getPosition(AGENT);
  const heartbeatCadenceMs   = position?.heartbeat_interval_ms ?? 5_000;
  const fastHealthCadenceMs  = 30_000;
  const deepIntelCadenceMs   = 5 * 60_000;
  const dailyCadenceMs       = 24 * 60 * 60_000;
  const selfCriticCadenceMs  = 6 * 60 * 60_000;
  const internetProbeCadenceMs = 60_000;

  emitEvent({
    kind: "AGENT_STARTED",
    agent_id: AGENT,
    process_id: process.pid,
    attributes: { run_id: runId, runtime_version: AGENT_RUNTIME_VERSION },
  });
  beat("STARTING", "initializing", runId);
  await probeInternet().catch(() => { /* offline is fine */ });
  beat("RUNNING", "idle", runId);

  // Deferred imports · the master-ai modules live outside agent-runtime
  // and depend on the runtime types being available first.
  const [
    { ensureRuntimeAgentsRegistered },
    { observatoryTick, latestReportForAgent },
    { aggregateFailurePatterns },
    { composeDaily },
    { composeSelfCriticism },
    { registerWikipediaLiveSource },
  ] = await Promise.all([
    import("../master-ai/agent-registry"),
    import("../master-ai/observatory"),
    import("../master-ai/failure-intelligence"),
    import("../master-ai/daily-intelligence"),
    import("../master-ai/self-criticism"),
    import("../master-ai/live-adapter-wikipedia"),
  ]);

  // Idempotent · ensures programmer + accommodation + master_ai present.
  try { ensureRuntimeAgentsRegistered({ registered_by: "master_ai_worker" }); }
  catch (err) { LAST_FAILURE_ISO = new Date().toISOString(); /* keep running */ }

  // W4-A · Optionally register the live Wikipedia adapter · off by default.
  // Founder must set MASTER_AI_ENABLE_LIVE_WIKIPEDIA=1 to enable real HTTP.
  if (process.env.MASTER_AI_ENABLE_LIVE_WIKIPEDIA === "1") {
    try { registerWikipediaLiveSource({ registered_by: "master_ai_worker" }); }
    catch (err) { LAST_FAILURE_ISO = new Date().toISOString(); /* keep running */ }
  }

  let lastFastHealth      = 0;
  let lastDeepIntel       = 0;
  let lastDaily           = 0;
  let lastSelfCritic      = 0;
  let lastInternetProbe   = Date.now();

  while (!control.shouldStop()) {
    const nowMs = control.now();

    // Internet probe
    if (nowMs - lastInternetProbe >= internetProbeCadenceMs) {
      await probeInternet().catch(() => { /* offline ok */ });
      lastInternetProbe = nowMs;
    }

    // FAST HEALTH · observatoryTick (30s)
    if (nowMs - lastFastHealth >= fastHealthCadenceMs) {
      try {
        beat("RUNNING", "observatory_tick", runId);
        observatoryTick(nowMs);
        LAST_SUCCESS_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_COMPLETED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: { work: "observatory_tick", run_id: runId },
        });
      } catch (err) {
        LAST_FAILURE_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_FAILED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: { work: "observatory_tick", error: (err as Error).message.slice(0, 200) },
        });
      }
      lastFastHealth = nowMs;
    }

    // DEEP INTEL · failure aggregation (5m)
    if (nowMs - lastDeepIntel >= deepIntelCadenceMs) {
      try {
        beat("RUNNING", "failure_aggregation", runId);
        aggregateFailurePatterns(5000);
        LAST_SUCCESS_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_COMPLETED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: { work: "failure_aggregation", run_id: runId },
        });
      } catch (err) {
        LAST_FAILURE_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_FAILED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: { work: "failure_aggregation", error: (err as Error).message.slice(0, 200) },
        });
      }
      lastDeepIntel = nowMs;
    }

    // SELF-CRITIC · every 6h (§23)
    if (nowMs - lastSelfCritic >= selfCriticCadenceMs) {
      try {
        beat("RUNNING", "self_criticism", runId);
        composeSelfCriticism();
        LAST_SUCCESS_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_COMPLETED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: { work: "self_criticism", run_id: runId },
        });
      } catch (err) {
        LAST_FAILURE_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_FAILED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: { work: "self_criticism", error: (err as Error).message.slice(0, 200) },
        });
      }
      lastSelfCritic = nowMs;
    }

    // DAILY INTEL · every 24h (§24)
    if (nowMs - lastDaily >= dailyCadenceMs) {
      try {
        beat("RUNNING", "daily_briefing", runId);
        composeDaily();
        LAST_SUCCESS_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_COMPLETED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: { work: "daily_briefing", run_id: runId },
        });
      } catch (err) {
        LAST_FAILURE_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_FAILED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: { work: "daily_briefing", error: (err as Error).message.slice(0, 200) },
        });
      }
      lastDaily = nowMs;
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
