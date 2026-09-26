// src/lib/nex-native/intelligence/telemetry.ts
//
// NEX Generation Engine · in-process telemetry ring buffer (server-only).
// -----------------------------------------------------------------------
// Small, bounded, in-memory record of the last N engine invocations.
// Reserved for engineering diagnostics (HQ / Founder consoles). Never
// exposed to end users.
//
// Records per event:
//   · timestamp
//   · model id
//   · outcome (accepted / rejected / errored)
//   · attempts consumed (initial + retries)
//   · union of validator findings across all attempts
//   · total engine latency (ms)
//   · optional error / final validator findings
//
// Ring size is fixed to keep memory bounded (default 100). Reads are
// snapshot-copies · callers cannot mutate the internal state.

import "server-only";
import type { ValidatorFinding } from "./validator";

export interface EngineTelemetryEvent {
  ts: string;
  modelId: string | null;
  outcome: "accepted" | "rejected" | "errored";
  attempts: number;
  findings: ValidatorFinding[];
  totalLatencyMs: number;
  error?: string;
}

const CAPACITY = Number(process.env.NEX_ENGINE_TELEMETRY_CAPACITY ?? "100");

const ring: EngineTelemetryEvent[] = [];
let cursor = 0;
let recorded = 0;

export function recordEngineEvent(event: EngineTelemetryEvent): void {
  ring[cursor] = event;
  cursor = (cursor + 1) % CAPACITY;
  recorded++;
}

export function getEngineTelemetry(limit = CAPACITY): {
  totalRecorded: number;
  capacity: number;
  events: EngineTelemetryEvent[];
} {
  const events: EngineTelemetryEvent[] = [];
  // Walk from oldest to newest in the ring
  const size = Math.min(recorded, CAPACITY);
  for (let i = 0; i < size; i++) {
    const idx = recorded < CAPACITY ? i : (cursor + i) % CAPACITY;
    const e = ring[idx];
    if (e) events.push(e);
  }
  return {
    totalRecorded: recorded,
    capacity: CAPACITY,
    events: events.slice(-limit),
  };
}

/** Aggregate stats over the current buffer · for Founder/HQ console. */
export function summarizeEngineTelemetry(): {
  totalRecorded: number;
  buffered: number;
  accepted: number;
  rejected: number;
  errored: number;
  meanLatencyMs: number;
  meanAttempts: number;
  findingCounts: Record<string, number>;
} {
  const { events } = getEngineTelemetry();
  if (events.length === 0) {
    return {
      totalRecorded: recorded,
      buffered: 0,
      accepted: 0,
      rejected: 0,
      errored: 0,
      meanLatencyMs: 0,
      meanAttempts: 0,
      findingCounts: {},
    };
  }
  const accepted = events.filter((e) => e.outcome === "accepted").length;
  const rejected = events.filter((e) => e.outcome === "rejected").length;
  const errored = events.filter((e) => e.outcome === "errored").length;
  const meanLatencyMs = Math.round(events.reduce((a, e) => a + e.totalLatencyMs, 0) / events.length);
  const meanAttempts = events.reduce((a, e) => a + e.attempts, 0) / events.length;
  const findingCounts: Record<string, number> = {};
  for (const e of events) for (const f of e.findings) findingCounts[f] = (findingCounts[f] ?? 0) + 1;
  return {
    totalRecorded: recorded,
    buffered: events.length,
    accepted,
    rejected,
    errored,
    meanLatencyMs,
    meanAttempts,
    findingCounts,
  };
}

/** Test-only reset. Not used in production. */
export function resetEngineTelemetry(): void {
  ring.length = 0;
  cursor = 0;
  recorded = 0;
}
