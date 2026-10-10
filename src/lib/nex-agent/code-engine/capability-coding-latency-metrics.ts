// src/lib/nex-agent/code-engine/capability-coding-latency-metrics.ts
//
// NEX1 · Coding Latency Metrics (§40 · §55)
// Ledger B additive · Zero LLM · Deterministic.
//
// PURPOSE
//   Real timing substrate. Records phase-level latencies so the founder
//   can measure "minimum unnecessary work while preserving verification
//   quality" (§40).

import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";

export const CODING_LATENCY_METRICS_VERSION = "coding-latency-metrics.v1.2026-09-19";

export type PhaseName =
  | "understand"
  | "repository_context"
  | "hypothesis"
  | "plan"
  | "first_change"
  | "static_check"
  | "target_test"
  | "regression_test"
  | "semantic_verification"
  | "referee"
  | "runtime_probe"
  | "preview_update"
  | "twin_recovery";

export interface PhaseMark {
  readonly phase: PhaseName;
  readonly started_ms: number;
  readonly ended_ms: number | null;
  readonly duration_ms: number | null;
}

export interface CodingSession {
  readonly session_id: string;
  readonly started_ms: number;
  readonly phases: PhaseMark[];
  readonly counters: {
    files_read: number;
    files_changed: number;
    tests_run: number;
    builds_run: number;
    duplicate_operations: number;
    repair_attempts: number;
    agent_handoffs: number;
    cache_hits: number;
  };
}

const sessions = new Map<string, CodingSession>();

export function startSession(): string {
  const id = `sess_${Date.now()}_${randomUUID().slice(0, 6)}`;
  sessions.set(id, {
    session_id: id,
    started_ms: performance.now(),
    phases: [],
    counters: {
      files_read: 0, files_changed: 0, tests_run: 0, builds_run: 0,
      duplicate_operations: 0, repair_attempts: 0, agent_handoffs: 0, cache_hits: 0,
    },
  });
  return id;
}

export function beginPhase(session_id: string, phase: PhaseName): void {
  const s = sessions.get(session_id);
  if (!s) return;
  s.phases.push({ phase, started_ms: performance.now(), ended_ms: null, duration_ms: null });
}

export function endPhase(session_id: string, phase: PhaseName): number | null {
  const s = sessions.get(session_id);
  if (!s) return null;
  // Find the most recent open mark for this phase
  for (let i = s.phases.length - 1; i >= 0; i--) {
    if (s.phases[i].phase === phase && s.phases[i].ended_ms === null) {
      const ended = performance.now();
      const duration = ended - s.phases[i].started_ms;
      s.phases[i] = { ...s.phases[i], ended_ms: ended, duration_ms: duration };
      return duration;
    }
  }
  return null;
}

export function incrementCounter(session_id: string, counter: keyof CodingSession["counters"], by: number = 1): void {
  const s = sessions.get(session_id);
  if (!s) return;
  s.counters[counter] += by;
}

export interface LatencyReport {
  readonly session_id: string;
  readonly total_elapsed_ms: number;
  readonly phase_durations: Record<PhaseName, number>;
  readonly time_to_understand_ms: number | null;
  readonly time_to_repository_context_ms: number | null;
  readonly time_to_hypothesis_ms: number | null;
  readonly time_to_first_change_ms: number | null;
  readonly time_to_test_ms: number | null;
  readonly time_to_verification_ms: number | null;
  readonly time_to_preview_ms: number | null;
  readonly twin_recovery_latency_ms: number | null;
  readonly counters: CodingSession["counters"];
  readonly efficiency_score: number;
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

export function finaliseReport(session_id: string): LatencyReport | null {
  const s = sessions.get(session_id);
  if (!s) return null;
  const now = performance.now();
  const total = now - s.started_ms;
  const durations: Record<string, number> = {};
  for (const p of s.phases) {
    if (p.duration_ms !== null) {
      durations[p.phase] = (durations[p.phase] ?? 0) + p.duration_ms;
    }
  }
  // Efficiency score: 1.0 = ideal · penalises duplicate_operations and unnecessary handoffs
  const denom = Math.max(1, s.counters.files_read + s.counters.tests_run);
  const wastedOps = s.counters.duplicate_operations + Math.max(0, s.counters.agent_handoffs - 3);
  const efficiency_score = Math.max(0, 1 - wastedOps / denom);

  return {
    session_id,
    total_elapsed_ms: total,
    phase_durations: durations as Record<PhaseName, number>,
    time_to_understand_ms: durations["understand"] ?? null,
    time_to_repository_context_ms: durations["repository_context"] ?? null,
    time_to_hypothesis_ms: durations["hypothesis"] ?? null,
    time_to_first_change_ms: durations["first_change"] ?? null,
    time_to_test_ms: durations["target_test"] ?? null,
    time_to_verification_ms: (durations["target_test"] ?? 0) + (durations["semantic_verification"] ?? 0) || null,
    time_to_preview_ms: durations["preview_update"] ?? null,
    twin_recovery_latency_ms: durations["twin_recovery"] ?? null,
    counters: { ...s.counters },
    efficiency_score,
    zero_llm: true,
    ledger: "B",
    version: CODING_LATENCY_METRICS_VERSION,
  };
}

export function _resetForTests(): void {
  sessions.clear();
}
