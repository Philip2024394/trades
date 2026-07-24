// The BI engine — one call, one snapshot.
//
// buildBusinessSnapshot(merchantSlug) runs every adapter in parallel,
// aggregates the sub-scores into a Business Health, unions the
// observations, and returns the shape the briefing / answer / report
// modules all consume.
//
// Caching: snapshots are cheap (a handful of small aggregations) so we
// keep the cache per-process, keyed by (merchant, lookback, hour).
// Same merchant asking twice in the same hour gets the same snapshot.

import { computeHealth } from "./health";
import { ADAPTERS } from "./registry";
import type { BusinessHealth, DomainMetrics, Observation } from "./types";

const CACHE_TTL_MS = 60 * 60 * 1000;    // 1 hour
const cache = new Map<string, { snapshot: BusinessHealth; expiresAt: number }>();

/** Test-only cache reset. Not exported through the barrel. */
export function _clearBiCache(): void { cache.clear(); }

export type BuildOptions = {
  merchantSlug: string;
  lookbackDays?: number;
  now?:          Date;
  /** Skip cache and force re-run. */
  refresh?:      boolean;
};

export async function buildBusinessSnapshot(opts: BuildOptions): Promise<BusinessHealth> {
  const lookbackDays = opts.lookbackDays ?? 30;
  const now          = opts.now ?? new Date();
  const hourKey      = now.toISOString().slice(0, 13);  // …T09
  const cacheKey     = `${opts.merchantSlug}|${lookbackDays}|${hourKey}`;

  if (!opts.refresh) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > now.getTime()) return hit.snapshot;
  }

  const results = await Promise.all(
    ADAPTERS.map(async (adapter) => {
      try {
        return await adapter.run({
          merchantSlug: opts.merchantSlug,
          lookbackDays,
          now
        });
      } catch (err) {
        return errorMetrics(adapter, err);
      }
    })
  );

  const errors: BusinessHealth["errors"] = [];
  for (const r of results) {
    if (r.error) errors.push({ domain: r.domain, error: r.error });
  }

  const domains: DomainMetrics[] = results.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.label.localeCompare(b.label);
  });

  const observations: Observation[] = results
    .flatMap((d) => d.observations)
    .sort(bySeverity);

  const health = computeHealth(domains);
  const snapshot: BusinessHealth = {
    score:        health.score,
    band:         health.band,
    headline:     health.headline,
    domains,
    observations,
    computed_at:  now.toISOString(),
    errors
  };

  cache.set(cacheKey, { snapshot, expiresAt: now.getTime() + CACHE_TTL_MS });
  return snapshot;
}

function errorMetrics(adapter: { domain: DomainMetrics["domain"]; label: string; weight: number }, err: unknown): DomainMetrics {
  return {
    domain:       adapter.domain,
    label:        adapter.label,
    sub_score:    null,
    weight:       adapter.weight,
    metrics:      [],
    observations: [],
    error:        err instanceof Error ? err.message : String(err)
  };
}

const SEVERITY_RANK: Record<Observation["severity"], number> = {
  alert:   0,
  warning: 1,
  notice:  2,
  info:    3
};

function bySeverity(a: Observation, b: Observation): number {
  return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
}
