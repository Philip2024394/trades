// src/lib/nex-native/intelligence/worker-circuit.ts
//
// NEX Engine · worker-side circuit breaker (server-only).
// -------------------------------------------------------
// Wave 5 of the 2026-09-24 Scaling Doctrine sequence.
//
// Small isolating device that protects the fleet from a bad worker
// state. When a worker's engine errors exceed the failure threshold
// within the observation window, the breaker OPENS · the worker stops
// leasing new jobs, waits `openMs`, then transitions to HALF-OPEN
// (one trial job). On success it closes; on failure it re-opens with
// exponential backoff.
//
// The breaker is per-worker · a bad worker isolates itself, other
// workers keep serving. Job payloads remain queued for other workers
// to pick up · no request is lost.

import "server-only";

export interface CircuitConfig {
  failureThreshold: number;      // consecutive engine errors before opening
  observationWindowMs: number;   // window over which failures are counted
  openMs: number;                // base open duration
  maxOpenMs: number;             // cap on exponential open duration
}

const DEFAULT_CONFIG: CircuitConfig = {
  failureThreshold: Number(process.env.NEX_WORKER_CIRCUIT_FAILURE_THRESHOLD ?? "3"),
  observationWindowMs: Number(process.env.NEX_WORKER_CIRCUIT_OBSERVATION_MS ?? "60000"),
  openMs: Number(process.env.NEX_WORKER_CIRCUIT_OPEN_MS ?? "15000"),
  maxOpenMs: Number(process.env.NEX_WORKER_CIRCUIT_MAX_OPEN_MS ?? "300000"),
};

export type CircuitState = "closed" | "open" | "half_open";

export class WorkerCircuit {
  private state: CircuitState = "closed";
  private failureTimes: number[] = [];
  private openedAt = 0;
  private currentOpenMs: number;
  private cfg: CircuitConfig;
  private trials = 0;

  constructor(config: Partial<CircuitConfig> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
    this.currentOpenMs = this.cfg.openMs;
  }

  getState(): CircuitState {
    this.maybeTransitionAfterCooldown();
    return this.state;
  }

  /** Should the worker attempt to lease + process a job right now? */
  canRequestWork(): boolean {
    this.maybeTransitionAfterCooldown();
    return this.state === "closed" || this.state === "half_open";
  }

  /** Delay to sleep before re-checking · used by the worker loop. */
  cooldownRemainingMs(now = Date.now()): number {
    if (this.state !== "open") return 0;
    const remaining = this.openedAt + this.currentOpenMs - now;
    return Math.max(0, remaining);
  }

  /** Record a successful engine invocation · resets failure state. */
  recordSuccess(): void {
    this.failureTimes = [];
    if (this.state === "half_open") {
      this.state = "closed";
      this.currentOpenMs = this.cfg.openMs; // reset exponential backoff on recovery
      this.trials = 0;
    }
  }

  /** Record an engine error · may open the breaker. */
  recordFailure(now = Date.now()): void {
    this.failureTimes.push(now);
    // Drop entries outside the observation window
    this.failureTimes = this.failureTimes.filter(
      (t) => now - t <= this.cfg.observationWindowMs
    );
    if (this.state === "half_open") {
      this.trials++;
      this.reopen(now);
      return;
    }
    if (
      this.state === "closed" &&
      this.failureTimes.length >= this.cfg.failureThreshold
    ) {
      this.reopen(now);
    }
  }

  private reopen(now: number): void {
    // Capture whether we were in half_open BEFORE mutating state · a
    // half_open → open transition indicates a failed trial and must
    // apply exponential backoff. A closed → open transition is the
    // initial trip and uses the base openMs.
    const wasHalfOpen = this.state === "half_open";
    this.state = "open";
    this.openedAt = now;
    const multiplier = wasHalfOpen ? 2 : 1;
    this.currentOpenMs = Math.min(this.cfg.maxOpenMs, this.currentOpenMs * multiplier);
  }

  private maybeTransitionAfterCooldown(now = Date.now()): void {
    if (this.state !== "open") return;
    if (now - this.openedAt >= this.currentOpenMs) {
      this.state = "half_open";
    }
  }

  snapshot(): { state: CircuitState; recentFailures: number; currentOpenMs: number } {
    this.maybeTransitionAfterCooldown();
    return {
      state: this.state,
      recentFailures: this.failureTimes.length,
      currentOpenMs: this.currentOpenMs,
    };
  }
}
