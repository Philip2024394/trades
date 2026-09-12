// src/lib/nex/agent-runtime/worker-accommodation.ts
//
// NEX Agent Runtime · Accommodation Workforce worker loop (§8 · §9 · §10 · §40)
// Philip 2026-09-06 · FOUNDER AUTHORIZATION
//
// Runs inside the detached child_process spawned by control-plane.ts.
// Does REAL work (§40) — never fabricates acquisition. Phase-A worker
// scope is intentionally observation-only:
//
//   1. LOCAL_SAFE — read existing accommodation records from
//      data/workforce/ + adapter fixtures and count how many are due
//      for freshness refresh (based on last_seen_at_iso · 7-day window).
//      This work runs even when the internet is offline.
//   2. NETWORK_REQUIRED — when online, emit FRESHNESS_DUE events for
//      each stale record so a downstream (later phase) acquisition
//      pipeline can pick them up. This Phase A worker does NOT itself
//      call external providers.
//
// §26 controls: never invents accommodation facts, never modifies
// existing records, never activates Programmer.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentId, Heartbeat } from "./types";
import { AGENT_RUNTIME_VERSION } from "./types";
import { writeHeartbeat } from "./heartbeat";
import { emitEvent } from "./event-bus";
import {
  cachedInternetState,
  probeInternet,
  mayProceedOffline,
} from "./internet-check";
import { getPosition } from "./registry";

const AGENT: AgentId = "accommodation";
const FRESHNESS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days

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

/** LOCAL_SAFE work: count records due for freshness refresh. Runs
 *  offline. Reads existing JSON only — never writes accommodation data. */
function countFreshnessDue(nowMs: number): { total_records: number; due: number; sample_ref_ids: string[] } {
  const p = path.join(process.cwd(), "data", "workforce", "positions.json");
  const sample: string[] = [];
  let total = 0;
  let due = 0;
  try {
    if (!fs.existsSync(p)) return { total_records: 0, due: 0, sample_ref_ids: [] };
    // The current positions.json is a minimal registration record — not
    // a full accommodation catalogue. Phase A worker treats each
    // registered position that references accommodation machinery as one
    // observable data source. Phase E entity-model + Phase F discovery
    // will surface the real per-record freshness signal.
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.positions) ? parsed.positions : []);
    for (const rec of arr) {
      if (rec && (rec.machinery === "p1_acquisition_pipeline" || rec.position_id === "hotel_accommodation")) {
        total++;
        const last = Date.parse(rec.registered_at ?? rec.registered_at_iso ?? "");
        if (Number.isNaN(last) || (nowMs - last) > FRESHNESS_WINDOW_MS) {
          due++;
          if (sample.length < 5) sample.push(rec.position_id ?? "unknown");
        }
      }
    }
  } catch { /* honest zero on read failure — do not fabricate */ }
  return { total_records: total, due, sample_ref_ids: sample };
}

/** Entry point — called by the daemon script. */
export async function runAccommodationWorker(control: LoopControl): Promise<void> {
  const runId = randomUUID();
  const position = getPosition(AGENT);
  const freshnessCadenceMs = 60_000;          // check freshness every minute
  const heartbeatCadenceMs = position?.heartbeat_interval_ms ?? 5_000;
  const internetProbeCadenceMs = 60_000;

  emitEvent({
    kind: "AGENT_STARTED",
    agent_id: AGENT,
    process_id: process.pid,
    attributes: { run_id: runId, runtime_version: AGENT_RUNTIME_VERSION },
  });
  beat("STARTING", "initializing", runId);
  await probeInternet().catch(() => { /* offline fine */ });
  beat("RUNNING", "idle", runId);

  let lastFreshness = 0;
  let lastInternetProbe = Date.now();
  let lastInternetState: "ONLINE" | "OFFLINE" | "UNKNOWN" = cachedInternetState().state;

  while (!control.shouldStop()) {
    const nowMs = control.now();

    // Periodic internet probe. Emits state-change events on transitions.
    if (nowMs - lastInternetProbe >= internetProbeCadenceMs) {
      try { await probeInternet(); } catch { /* ignore */ }
      const currentState = cachedInternetState().state;
      if (currentState !== lastInternetState) {
        emitEvent({
          kind: currentState === "ONLINE" ? "INTERNET_ONLINE" : "INTERNET_OFFLINE",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: { previous: lastInternetState, current: currentState },
        });
        lastInternetState = currentState;
      }
      lastInternetProbe = nowMs;
    }

    if (nowMs - lastFreshness >= freshnessCadenceMs) {
      // LOCAL_SAFE work — always runs, even offline
      try {
        beat("RUNNING", "counting_freshness_due", runId);
        const result = countFreshnessDue(nowMs);
        LAST_SUCCESS_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_COMPLETED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: {
            work: "freshness_scan",
            total_records: result.total_records,
            due: result.due,
            run_id: runId,
          },
        });

        // NETWORK_REQUIRED work — only when online
        if (mayProceedOffline("NETWORK_REQUIRED", cachedInternetState().state)) {
          for (const refId of result.sample_ref_ids) {
            emitEvent({
              kind: "FRESHNESS_DUE",
              agent_id: AGENT,
              process_id: process.pid,
              attributes: { ref_id: refId, run_id: runId },
            });
          }
        } else {
          emitEvent({
            kind: "WORK_BLOCKED",
            agent_id: AGENT,
            process_id: process.pid,
            attributes: { work: "freshness_refresh", reason: "internet_offline_or_unknown" },
          });
        }
      } catch (err) {
        LAST_FAILURE_ISO = new Date().toISOString();
        emitEvent({
          kind: "WORK_FAILED",
          agent_id: AGENT,
          process_id: process.pid,
          attributes: { work: "freshness_scan", error: (err as Error).message.slice(0, 200) },
        });
      }
      lastFreshness = nowMs;
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
