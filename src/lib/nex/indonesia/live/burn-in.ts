// Live-source burn-in.
//
// Runs a connector at its real cadence for a bounded window while
// recording every observable behaviour: polls, latency (min/max/avg/
// p50/p95), successes, failures by reason, entities published,
// duplicate observations dropped, budget skips, freshness state,
// recovery from injected failures.
//
// Two modes:
//   · simulated · a mock function determines each response ·
//     supports failure/latency injection · deterministic · used in
//     tests and offline burn-in
//   · live · uses the connector's real fetch() · requires
//     NEX_LIVE_SOURCES_ENABLED=1 · used for the first-day BMKG /
//     MAGMA burn-in an operator runs against real endpoints
//
// The output is a BurnInReport an operator can read directly + a
// per-tick log the runtime persists to data/indonesia/burn-in-*.jsonl

import type { EntityRecord } from "../data/types";
import type { LiveSourceConnector, LiveObservation, LiveFetchError } from "./types";
import { isLiveFetchError } from "./types";
import { LiveSourceHealthRegistry, RecentObservationStore, liveTick } from "./runtime";
import type { BudgetRegistry } from "./budget";

export type BurnInOptions = {
  connector: LiveSourceConnector;
  /** Total wall-clock duration to run, in ms. */
  durationMs: number;
  /** Optional budget · burn-in respects it just like production. */
  budget?: BudgetRegistry;
  /** Simulated-network mock function · called each tick to produce
   *  the "response". Return the payload for parseXxx, or return
   *  { error: true, reason } to inject a failure. Not called when
   *  running against live network. */
  simulator?: (tickIndex: number) => unknown | LiveFetchError;
  /** Faster tick interval for offline burn-in (defaults to the
   *  connector's pollIntervalMs). */
  tickIntervalMs?: number;
  /** Called once per tick with the per-tick observation. Useful for
   *  streaming output. */
  onTick?: (event: BurnInTickEvent) => void;
  /** Keep the last N published EntityRecords in the report so the
   *  operator can eyeball what a real live payload actually parsed
   *  into. Defaults to 5. Set 0 to disable retention. */
  retainLastPublished?: number;
  now?: () => Date;
};

export type BurnInTickEvent = {
  tickIndex: number;
  at: string;
  ok: boolean;
  latencyMs: number;
  entities: number;
  deduped: number;
  reason?: string;
  skippedByBudget?: boolean;
};

export type BurnInReport = {
  connectorId: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  tickIntervalMs: number;
  ticksTotal: number;
  ticksSucceeded: number;
  ticksFailed: number;
  ticksSkippedByBudget: number;
  entitiesPublished: number;
  entitiesDeduped: number;
  failureReasons: Record<string, number>;
  latency: { min: number; max: number; avg: number; p50: number; p95: number };
  longestConsecutiveFailures: number;
  finalHealth: ReturnType<LiveSourceHealthRegistry["get"]>;
  /** Ring-buffer of the last N EntityRecords published during the
   *  burn-in · lets an operator see what real payloads actually
   *  parse into. Empty if retention was disabled or nothing published. */
  samplePublished: EntityRecord[];
  verdict: "clean" | "degraded" | "unhealthy";
};

export async function runBurnIn(opts: BurnInOptions): Promise<BurnInReport> {
  const now = opts.now ?? (() => new Date());
  const connector = opts.connector;
  const tickInterval = opts.tickIntervalMs ?? connector.config.pollIntervalMs ?? 60_000;
  const health = new LiveSourceHealthRegistry();
  const recent = new RecentObservationStore(24 * 60 * 60_000);

  const startedAt = now();
  const startMs = startedAt.getTime();
  const endMs = startMs + opts.durationMs;

  const latencies: number[] = [];
  const failureReasons: Record<string, number> = {};
  let ticksSucceeded = 0, ticksFailed = 0, ticksSkippedByBudget = 0;
  let entitiesPublished = 0, entitiesDeduped = 0;
  let currentConsecutive = 0, longestConsecutive = 0;
  let tickIndex = 0;
  const retain = opts.retainLastPublished ?? 5;
  const samplePublished: EntityRecord[] = [];

  // Wrap the connector · if simulator is provided, intercept fetch.
  // Poll interval is set to the burn-in tickInterval so the eligibility
  // gate matches the tick cadence (otherwise the simulator only fires
  // once every pollIntervalMs — hides failures on fast burn-in).
  const configForBurnIn = {
    ...connector.config,
    pollIntervalMs: opts.tickIntervalMs ?? connector.config.pollIntervalMs,
  };
  const wrapped: LiveSourceConnector = opts.simulator ? {
    config: configForBurnIn,
    async fetch(_opts) {
      const idx = tickIndex;
      const value = opts.simulator!(idx);
      if (isLiveFetchError(value)) return value;
      // Use the connector's own parser via the mock path.
      return await connector.fetch({ mock: value });
    },
  } : { ...connector, config: configForBurnIn };

  while (now().getTime() < endMs) {
    const tickStart = now();
    const report = await liveTick({
      connectors: [wrapped],
      health, recent, budget: opts.budget,
      now: () => tickStart,
      onPublish: retain > 0 ? (_sourceId, entities) => {
        for (const e of entities) {
          samplePublished.push(e);
          while (samplePublished.length > retain) samplePublished.shift();
        }
      } : undefined,
    });
    const perSrc = report.perSource[0];
    if (!perSrc) { /* connector wasn't eligible this tick */ }
    else {
      const at = tickStart.toISOString();
      if (perSrc.skippedByBudget) {
        ticksSkippedByBudget++;
      } else if (perSrc.ok) {
        ticksSucceeded++;
        currentConsecutive = 0;
        entitiesPublished += perSrc.published;
        entitiesDeduped += perSrc.deduped;
        latencies.push(perSrc.latencyMs);
      } else {
        ticksFailed++;
        currentConsecutive++;
        if (currentConsecutive > longestConsecutive) longestConsecutive = currentConsecutive;
        const reason = perSrc.reason?.split(":")[0] ?? "unknown";
        failureReasons[reason] = (failureReasons[reason] ?? 0) + 1;
      }
      opts.onTick?.({
        tickIndex, at,
        ok: perSrc.ok, latencyMs: perSrc.latencyMs,
        entities: perSrc.published, deduped: perSrc.deduped,
        reason: perSrc.reason, skippedByBudget: perSrc.skippedByBudget,
      });
    }
    tickIndex++;
    // Wait for the next tick (real time in production; fast in tests).
    const waitMs = Math.max(0, (tickStart.getTime() + tickInterval) - now().getTime());
    if (waitMs > 0) await sleep(waitMs);
  }

  const endedAt = now();
  const finalHealth = health.get(connector.config.id);
  const total = ticksSucceeded + ticksFailed;
  const failureRate = total === 0 ? 0 : ticksFailed / total;
  const verdict: BurnInReport["verdict"] =
    total === 0 ? "clean" :
    failureRate < 0.05 && longestConsecutive < 3 ? "clean" :
    failureRate < 0.2  && longestConsecutive < 6 ? "degraded" : "unhealthy";

  return {
    connectorId: connector.config.id,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startMs,
    tickIntervalMs: tickInterval,
    ticksTotal: tickIndex,
    ticksSucceeded, ticksFailed, ticksSkippedByBudget,
    entitiesPublished, entitiesDeduped,
    failureReasons,
    latency: computeLatencyStats(latencies),
    longestConsecutiveFailures: longestConsecutive,
    finalHealth,
    samplePublished,
    verdict,
  };
}

function computeLatencyStats(arr: number[]): BurnInReport["latency"] {
  if (arr.length === 0) return { min: 0, max: 0, avg: 0, p50: 0, p95: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round(sum / sorted.length),
    p50: q(0.5),
    p95: q(0.95),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
