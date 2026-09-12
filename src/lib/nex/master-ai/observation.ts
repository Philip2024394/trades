// src/lib/nex/master-ai/observation.ts
//
// NEX Master AI Engineer · M3 · Read-only observation layer
// Philip 2026-09-07 · AUTHORIZE
//
// Reads runtime state (heartbeats · events · agent-runtime status) and
// records observations to Master AI's own append-only ledger. NEVER
// writes to any observed agent's data.
//
// PRESERVATION:
//   · Reads agent-runtime files via the existing paths module (no
//     mutation, no probing beyond fs.readFileSync).
//   · Does NOT invoke control-plane commands. Master AI observation
//     never START/STOPs agents.
//   · Does NOT modify events.jsonl · never emits into it. Master AI
//     has its own observations.jsonl.

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { observationsPath } from "./paths";
import type {
  ObservationRecord,
  ObservationKind,
  MasterAgentId,
} from "./types";

// Existing runtime paths (agent-runtime · READ ONLY)
import {
  heartbeatPath as runtimeHeartbeatPath,
  eventsPath as runtimeEventsPath,
} from "@/lib/nex/agent-runtime/paths";
import type { Heartbeat } from "@/lib/nex/agent-runtime/types";

export class ForbiddenObservationWriteError extends Error {
  constructor(target: string) { super(`observer_attempted_write:${target}`); }
}

/** Record a single observation. Append-only. */
export function recordObservation(input: Omit<ObservationRecord, "observation_id" | "timestamp_iso"> & {
  timestamp_iso?: string;
}): ObservationRecord {
  const record: ObservationRecord = {
    ...input,
    observation_id: randomUUID(),
    timestamp_iso: input.timestamp_iso ?? new Date().toISOString(),
  };
  appendJsonLine(observationsPath(), record);
  return record;
}

export function readAllObservations(): ObservationRecord[] {
  return readJsonlAll<ObservationRecord>(observationsPath());
}

/** Read a heartbeat file directly. READ-ONLY. Returns null if missing. */
export function readHeartbeatSnapshot(agentId: "programmer" | "accommodation"): Heartbeat | null {
  try {
    const p = runtimeHeartbeatPath(agentId);
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf8");
    if (!raw.trim()) return null;
    return JSON.parse(raw) as Heartbeat;
  } catch {
    return null;
  }
}

/** Tail the runtime events.jsonl. Bounded read · never modifies file. */
export function tailRuntimeEvents(maxLines = 500): unknown[] {
  try {
    const p = runtimeEventsPath();
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, "utf8");
    if (!raw.trim()) return [];
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const start = Math.max(0, lines.length - maxLines);
    const out: unknown[] = [];
    for (let i = start; i < lines.length; i++) {
      try { out.push(JSON.parse(lines[i])); } catch { /* skip malformed */ }
    }
    return out;
  } catch {
    return [];
  }
}

/** One observation tick · records snapshots for both known runtime
 *  agents · plus a health-derived observation summarising the pair.
 *  Returns the observation records emitted. */
export function observationTick(observer_run_id: string): ObservationRecord[] {
  const emitted: ObservationRecord[] = [];

  for (const agentId of ["programmer", "accommodation"] as const) {
    const hb = readHeartbeatSnapshot(agentId);
    emitted.push(recordObservation({
      kind: "AGENT_HEARTBEAT_SNAPSHOT" satisfies ObservationKind,
      observer_run_id,
      agent_id: agentId as MasterAgentId,
      provenance: {
        source_path: runtimeHeartbeatPath(agentId),
        read_only: true,
      },
      attributes: hb
        ? {
            pid: hb.process_id,
            status: hb.status,
            current_task: hb.current_task,
            heartbeat_iso: hb.timestamp_iso,
            internet_state: hb.internet_state,
          }
        : { heartbeat_missing: true },
    }));
  }

  const eventCount = tailRuntimeEvents(1).length;
  emitted.push(recordObservation({
    kind: "AGENT_EVENT_TAIL" satisfies ObservationKind,
    observer_run_id,
    agent_id: null,
    provenance: {
      source_path: runtimeEventsPath(),
      read_only: true,
    },
    attributes: {
      events_visible: eventCount,
      tail_bound: 1,
    },
  }));

  return emitted;
}

export function _resetObservationsForTests(): void {
  try { if (fs.existsSync(observationsPath())) fs.unlinkSync(observationsPath()); } catch { /* ignore */ }
}
