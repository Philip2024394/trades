// Live-source runtime · schedules connector polls under the supervisor.
//
// Layer that turns "connector exists" into "connector operational":
//   · picks eligible connectors each supervisor tick (pollIntervalMs)
//   · runs fetch() (respecting the env gate + circuit-breaker)
//   · publishes observations through the workforce pipeline
//   · dedupes idempotent observations (same earthquake reported
//     seconds apart shouldn't create two entities)
//   · tracks per-source health: last poll, avg latency, failure rate,
//     consecutive failures
//   · records health signals to LiveSourceHealthRegistry so HQ shows
//     the operational state per source
//
// The runtime NEVER hits the network on its own · it delegates to the
// connector's fetch(), which is env-gated. Tests inject `__mock` to
// simulate BMKG/MAGMA responses without HTTP.

import type { EntityRecord } from "../data/types";
import type { LiveSourceConnector, LiveObservation, LiveFetchError } from "./types";
import { isLiveFetchError } from "./types";
import type { BudgetRegistry } from "./budget";

export type LiveSourceHealth = {
  sourceId: string;
  lastPollAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
  pollsTotal: number;
  successesTotal: number;
  failuresTotal: number;
  consecutiveFailures: number;
  avgLatencyMs: number;
  lastPublishedEntities: number;
  cumulativeEntities: number;
};

/** In-memory health registry for live sources. Persisted alongside
 *  the workforce state so HQ sees continuity across restarts. */
export class LiveSourceHealthRegistry {
  private readonly bySourceId = new Map<string, LiveSourceHealth>();

  private ensure(sourceId: string): LiveSourceHealth {
    let h = this.bySourceId.get(sourceId);
    if (!h) {
      h = {
        sourceId, pollsTotal: 0, successesTotal: 0, failuresTotal: 0,
        consecutiveFailures: 0, avgLatencyMs: 0,
        lastPublishedEntities: 0, cumulativeEntities: 0,
      };
      this.bySourceId.set(sourceId, h);
    }
    return h;
  }

  recordPoll(sourceId: string, ok: boolean, latencyMs: number, at: string, published: number, error?: string): LiveSourceHealth {
    const h = this.ensure(sourceId);
    h.pollsTotal += 1;
    h.lastPollAt = at;
    // Exponential moving average (α=0.2).
    h.avgLatencyMs = h.avgLatencyMs === 0 ? latencyMs : Math.round(0.8 * h.avgLatencyMs + 0.2 * latencyMs);
    if (ok) {
      h.successesTotal += 1;
      h.lastSuccessAt = at;
      h.consecutiveFailures = 0;
      h.lastPublishedEntities = published;
      h.cumulativeEntities += published;
    } else {
      h.failuresTotal += 1;
      h.lastFailureAt = at;
      h.lastError = error;
      h.consecutiveFailures += 1;
    }
    return h;
  }

  get(sourceId: string): LiveSourceHealth | undefined {
    return this.bySourceId.get(sourceId);
  }

  all(): LiveSourceHealth[] {
    return [...this.bySourceId.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  }
}

// ─── Idempotent observation store ─────────────────────────────────

/** Simple LRU-ish store for recent entity IDs per source. Prevents
 *  the same earthquake / volcano status / weather snapshot being
 *  published twice within a short window. */
export class RecentObservationStore {
  private readonly buckets = new Map<string, Map<string, number>>();
  private readonly ttlMs: number;
  constructor(ttlMs: number = 10 * 60_000) { this.ttlMs = ttlMs; }

  seen(sourceId: string, entityId: string, now: Date = new Date()): boolean {
    this.gc(sourceId, now);
    const bucket = this.buckets.get(sourceId);
    return bucket?.has(entityId) ?? false;
  }

  mark(sourceId: string, entityId: string, now: Date = new Date()): void {
    let bucket = this.buckets.get(sourceId);
    if (!bucket) { bucket = new Map(); this.buckets.set(sourceId, bucket); }
    bucket.set(entityId, now.getTime());
  }

  private gc(sourceId: string, now: Date): void {
    const bucket = this.buckets.get(sourceId);
    if (!bucket) return;
    const cutoff = now.getTime() - this.ttlMs;
    for (const [k, t] of bucket) if (t < cutoff) bucket.delete(k);
  }
}

// ─── Runtime ─────────────────────────────────────────────────────

export type LiveRuntimeOptions = {
  connectors: LiveSourceConnector[];
  health: LiveSourceHealthRegistry;
  recent: RecentObservationStore;
  /** Optional per-source budget/rate-limit gate. Sources whose
   *  budget is exhausted are skipped for this tick. */
  budget?: BudgetRegistry;
  /** Called with each set of NEW entities produced this tick. */
  onPublish?: (sourceId: string, entities: EntityRecord[]) => Promise<void> | void;
  /** Test-only · injects mock payloads keyed by connector id. */
  __mocks?: Record<string, unknown>;
  now?: () => Date;
};

export type LiveTickReport = {
  tickAt: string;
  eligible: number;
  polled: number;
  succeeded: number;
  failed: number;
  publishedEntities: number;
  dedupedEntities: number;
  budgetSkipped: number;
  perSource: Array<{ sourceId: string; ok: boolean; latencyMs: number; published: number; deduped: number; reason?: string; skippedByBudget?: boolean }>;
};

/** Decide which connectors are due to poll this tick. `pollIntervalMs`
 *  in the connector config drives eligibility. */
export function eligibleConnectors(connectors: LiveSourceConnector[], health: LiveSourceHealthRegistry, now: Date): LiveSourceConnector[] {
  return connectors.filter((c) => {
    const h = health.get(c.config.id);
    if (!h?.lastPollAt) return true; // never polled → eligible
    const interval = c.config.pollIntervalMs ?? 60_000;
    return (now.getTime() - new Date(h.lastPollAt).getTime()) >= interval;
  });
}

/** Run one live-source tick · non-blocking, sequential per connector
 *  (respecting rate limits). Returns a structured report. */
export async function liveTick(opts: LiveRuntimeOptions): Promise<LiveTickReport> {
  const now = opts.now ?? (() => new Date());
  const at = now();
  const eligible = eligibleConnectors(opts.connectors, opts.health, at);

  const perSource: LiveTickReport["perSource"] = [];
  let published = 0, deduped = 0, succeeded = 0, failed = 0, budgetSkipped = 0;

  for (const c of eligible) {
    // Budget gate · protects the source from runaway polling.
    if (opts.budget) {
      const verdict = opts.budget.check(c.config.id);
      if (!verdict.ok) {
        perSource.push({ sourceId: c.config.id, ok: false, latencyMs: 0, published: 0, deduped: 0, reason: `budget:${verdict.reason}`, skippedByBudget: true });
        budgetSkipped += 1;
        continue;
      }
    }

    const mock = opts.__mocks?.[c.config.id];
    // Wall-clock latency uses the real OS clock so we measure ACTUAL
    // execution time · opts.now() may be a frozen logical clock used
    // for scheduling determinism (burn-in / tests) which would report
    // 0ms and blind us to real degradation.
    const t0 = Date.now();
    const result = await c.fetch(mock !== undefined ? { mock } : undefined);
    const latency = Date.now() - t0;
    const pollAt = now().toISOString();
    // Record against budget regardless of outcome · rate-limits
    // protect the source, not just successful requests.
    if (opts.budget) opts.budget.recordPoll(c.config.id);

    if (isLiveFetchError(result)) {
      const errStr = `${result.reason}${result.detail ? `:${result.detail.slice(0, 80)}` : ""}`;
      opts.health.recordPoll(c.config.id, false, latency, pollAt, 0, errStr);
      perSource.push({ sourceId: c.config.id, ok: false, latencyMs: latency, published: 0, deduped: 0, reason: errStr });
      failed += 1;
      continue;
    }

    // Dedupe against recent observations.
    const fresh: EntityRecord[] = [];
    let dropped = 0;
    for (const e of result.entities) {
      if (opts.recent.seen(c.config.id, e.id, now())) { dropped += 1; continue; }
      opts.recent.mark(c.config.id, e.id, now());
      fresh.push(e);
    }

    if (fresh.length > 0 && opts.onPublish) {
      try { await opts.onPublish(c.config.id, fresh); } catch { /* publish failure doesn't crash the runtime */ }
    }
    opts.health.recordPoll(c.config.id, true, latency, pollAt, fresh.length);
    perSource.push({ sourceId: c.config.id, ok: true, latencyMs: latency, published: fresh.length, deduped: dropped });
    succeeded += 1;
    published += fresh.length;
    deduped += dropped;
  }

  return {
    tickAt: at.toISOString(),
    eligible: eligible.length,
    polled: eligible.length - budgetSkipped,
    succeeded, failed, publishedEntities: published, dedupedEntities: deduped,
    budgetSkipped,
    perSource,
  };
}
