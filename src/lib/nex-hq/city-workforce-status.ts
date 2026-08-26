// src/lib/nex-hq/city-workforce-status.ts
//
// Aggregate workforce status per CITY (2026-08-24 · Philip's sidebar mock).
//
// A city has 4 categories (food/accommodation/market/transport). The sidebar
// entry for each city shows ONE dot summarising the city's overall workforce
// situation. This lib computes that aggregate honestly from real per-cell
// resolveWorkforceStatus results · never invents state.
//
// Precedence (highest wins · picked to match "what needs attention" priority):
//   WORKING > QUEUED > ERROR > WAITING > SATURATED > IDLE > UNAVAILABLE
//
// Rationale:
//   · WORKING is the most visually reassuring · surface it if any category is
//     actively producing right now.
//   · QUEUED means imminent work.
//   · ERROR requires operator attention · shown when nothing is happening yet.
//   · WAITING = temporarily throttled (fairness / provider gated).
//   · SATURATED = temporarily cooled down (revisit later · never finished).
//   · IDLE = eligible · waiting for orchestrator tick.
//   · UNAVAILABLE = every category walker not city-configurable.

import type { WorkforceStatus } from "./workforce-status";

// Aggregate precedence · lower rank number wins.
const AGGREGATE_RANK: Record<WorkforceStatus, number> = {
  working:     0,
  queued:      1,
  error:       2,
  waiting:     3,
  saturated:   4,
  idle:        5,
  unavailable: 6,
};

/**
 * Pick the "most notable" status across a city's per-category statuses.
 * Returns "unavailable" when the input is empty (never fake activity).
 */
export function aggregateCityStatus(perCategoryStatuses: WorkforceStatus[]): WorkforceStatus {
  if (perCategoryStatuses.length === 0) return "unavailable";
  let best: WorkforceStatus = perCategoryStatuses[0];
  let bestRank = AGGREGATE_RANK[best];
  for (const s of perCategoryStatuses) {
    const rank = AGGREGATE_RANK[s];
    if (rank < bestRank) { best = s; bestRank = rank; }
  }
  return best;
}

/**
 * Aggregate per-city statuses from a flat list of (city, category, status).
 * Used by the HQ layout to compute one dot per city for the sidebar.
 */
export function aggregateStatusesByCity(
  rows: Array<{ city: string; status: WorkforceStatus }>,
): Map<string, WorkforceStatus> {
  const byCity = new Map<string, WorkforceStatus[]>();
  for (const r of rows) {
    const arr = byCity.get(r.city) ?? [];
    arr.push(r.status);
    byCity.set(r.city, arr);
  }
  const out = new Map<string, WorkforceStatus>();
  for (const [city, statuses] of byCity) out.set(city, aggregateCityStatus(statuses));
  return out;
}

/**
 * Optional detail shape for sidebar city entries so the drill-down can show
 * which category has which status without re-running resolveWorkforceStatus.
 */
export interface CityWorkforceDetail {
  city: string;
  aggregate: WorkforceStatus;
  perCategory: { category: string; status: WorkforceStatus }[];
}

export function buildCityWorkforceDetails(
  rows: Array<{ city: string; category: string; status: WorkforceStatus }>,
): CityWorkforceDetail[] {
  const byCity = new Map<string, { category: string; status: WorkforceStatus }[]>();
  for (const r of rows) {
    const arr = byCity.get(r.city) ?? [];
    arr.push({ category: r.category, status: r.status });
    byCity.set(r.city, arr);
  }
  const out: CityWorkforceDetail[] = [];
  for (const [city, perCategory] of byCity) {
    out.push({
      city,
      aggregate: aggregateCityStatus(perCategory.map((p) => p.status)),
      perCategory,
    });
  }
  return out;
}
