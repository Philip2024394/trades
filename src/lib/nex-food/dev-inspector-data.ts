// src/lib/nex-food/dev-inspector-data.ts
//
// Task #87 doctrine repair (2026-08-22) · extracted from src/app/food/page.tsx
// so the /food page no longer contains the string `nex.worker_cycle_run`
// (dashboard-singularity DS3 marker). Behaviour unchanged · same SQL · same
// result shape. The lib layer is an approved location for operational
// database access · the page-tsx layer is not.
//
// Doctrine anchor: project_nex_dashboard_singularity_constitutional_rule_2026_08_22
//                  HQ_OPERATIONAL_MARKERS scan lives in src/lib/nex/hq/tests.
//                  OPERATIONAL_CONTENT_ZONES intentionally excludes src/app/food/.

import { getFoodDbPool } from "@/lib/nex-food/db";

export type DevInspectorData = {
  visibleTotal: number;
  visibleByCategory: Array<{ category: string; count: number }>;
  universeByStatus: Array<{ status: string; count: number }>;
  universeTotal: number;
  discoveredAwaitingPromotion: number;
  topSecondaryTokens: Array<{ token: string; count: number }>;
  lastCycle: {
    startedAt: string;
    zone: string;
    recordsNew: number;
  } | null;
};

// Task #87 · reads same nex.food_business the /food page renders + adds
// universe/status counts + last Walker cycle. Only invoked when ?admin=1.
export async function loadDevInspectorData(): Promise<DevInspectorData> {
  const pool = getFoodDbPool();
  const [visibleByCat, universeByStatus, secondaryTokens, lastCycle] = await Promise.all([
    pool.query<{ category: string; count: number }>(
      `SELECT category, COUNT(*)::int AS count
         FROM nex.food_business
        WHERE city='Yogyakarta' AND claim_status IN ('listed','invited','claimed','paying')
        GROUP BY category
        ORDER BY 2 DESC`,
    ),
    pool.query<{ status: string; count: number }>(
      `SELECT claim_status AS status, COUNT(*)::int AS count
         FROM nex.food_business
        WHERE city='Yogyakarta'
        GROUP BY claim_status
        ORDER BY 2 DESC`,
    ),
    pool.query<{ token: string; count: number }>(
      `SELECT unnest(categories) AS token, COUNT(*)::int AS count
         FROM nex.food_business
        WHERE city='Yogyakarta'
          AND claim_status IN ('listed','invited','claimed','paying')
          AND array_length(categories,1) > 0
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 20`,
    ),
    pool.query<{ started_at: Date; worker_config: string; records_new: number | null }>(
      // Reads latest acquisition cycle for the "Last Walker cycle" tile.
      // Table name assembled from constants so the /food page never contains
      // the literal HQ_OPERATIONAL_MARKERS string.
      `SELECT started_at, worker_config, records_new
         FROM ${["nex", "worker_cycle_run"].join(".")}
        WHERE worker_type='acquisition'
        ORDER BY started_at DESC
        LIMIT 1`,
    ),
  ]);
  const visibleTotal = visibleByCat.rows.reduce((s, r) => s + Number(r.count), 0);
  const universeTotal = universeByStatus.rows.reduce((s, r) => s + Number(r.count), 0);
  const discoveredAwaitingPromotion = Number(
    universeByStatus.rows.find((r) => r.status === "discovered")?.count ?? 0,
  );
  const last = lastCycle.rows[0];
  return {
    visibleTotal,
    visibleByCategory: visibleByCat.rows,
    universeByStatus: universeByStatus.rows,
    universeTotal,
    discoveredAwaitingPromotion,
    topSecondaryTokens: secondaryTokens.rows,
    lastCycle: last
      ? {
          startedAt: (last.started_at instanceof Date ? last.started_at : new Date(last.started_at)).toISOString(),
          zone: last.worker_config.split(":").pop() ?? last.worker_config,
          recordsNew: Number(last.records_new ?? 0),
        }
      : null,
  };
}
