// src/lib/nex-hq/commercial-funnel.ts
//
// NEX HQ · Commercial funnel data layer · Philip 2026-08-27.
//
// Read-only queries against nex.service_business. NO OUTREACH. NO writes.
// The Marketing Workforce is not built yet — this page is purely visibility
// on what qualification has produced.
//
// Funnel ordering matches _commercial-states.mjs:
//   discovered → qualified → contactable → marketing_ready
//     → attempted → engaged → invited → trial → paid
//     (declined is a terminal off-ladder state)

import { getFoodDbPool } from "@/lib/nex-food/db";

export const COMMERCIAL_STATE_ORDER = [
  "discovered",
  "qualified",
  "contactable",
  "marketing_ready",
  "attempted",
  "engaged",
  "invited",
  "trial",
  "paid",
  "declined",
] as const;
export type CommercialState = typeof COMMERCIAL_STATE_ORDER[number];

export const QUALIFICATION_STATES: readonly CommercialState[] = [
  "discovered", "qualified", "contactable", "marketing_ready",
] as const;
export const MARKETING_STATES: readonly CommercialState[] = [
  "attempted", "engaged", "invited", "trial", "paid", "declined",
] as const;

export interface FunnelBucket {
  state: CommercialState;
  count: number;
}
export interface FunnelByCategory {
  category_slug: string;
  buckets: FunnelBucket[];
  total: number;
}
export interface CommercialSnapshot {
  measuredAt: Date;
  totalRows: number;
  overall: FunnelBucket[];       // ordered COMMERCIAL_STATE_ORDER
  byCategory: FunnelByCategory[]; // one entry per category_slug in service_business
  lastQualificationRunAt: Date | null;
}

export async function loadCommercialSnapshot(): Promise<CommercialSnapshot> {
  const pool = getFoodDbPool();

  const [overallR, byCatR, totalR, lastRunR] = await Promise.all([
    pool.query<{ state: string; count: string }>(
      `SELECT commercial_status AS state, count(*)::text AS count
         FROM nex.service_business
        GROUP BY commercial_status`,
    ),
    pool.query<{ category_slug: string; state: string; count: string }>(
      `SELECT category_slug, commercial_status AS state, count(*)::text AS count
         FROM nex.service_business
        GROUP BY category_slug, commercial_status`,
    ),
    pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM nex.service_business`),
    pool.query<{ finished_at: Date | null }>(
      `SELECT MAX(finished_at) AS finished_at
         FROM nex.worker_cycle_run
        WHERE worker_type = 'commercial:qualification'`,
    ),
  ]);

  const overallMap = new Map<string, number>();
  for (const r of overallR.rows) overallMap.set(r.state, Number(r.count));
  const overall: FunnelBucket[] = COMMERCIAL_STATE_ORDER.map((s) => ({
    state: s,
    count: overallMap.get(s) ?? 0,
  }));

  // Group by category · nested map.
  const byCategoryMap = new Map<string, Map<string, number>>();
  for (const r of byCatR.rows) {
    if (!byCategoryMap.has(r.category_slug)) byCategoryMap.set(r.category_slug, new Map());
    byCategoryMap.get(r.category_slug)!.set(r.state, Number(r.count));
  }
  const byCategory: FunnelByCategory[] = Array.from(byCategoryMap.entries())
    .map(([category_slug, m]) => {
      const buckets: FunnelBucket[] = COMMERCIAL_STATE_ORDER.map((s) => ({
        state: s,
        count: m.get(s) ?? 0,
      }));
      const total = buckets.reduce((a, b) => a + b.count, 0);
      return { category_slug, buckets, total };
    })
    .sort((a, b) => b.total - a.total);

  return {
    measuredAt: new Date(),
    totalRows: Number(totalR.rows[0]?.n ?? 0),
    overall,
    byCategory,
    lastQualificationRunAt: lastRunR.rows[0]?.finished_at ?? null,
  };
}
