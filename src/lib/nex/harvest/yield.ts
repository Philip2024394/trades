// src/lib/nex/harvest/yield.ts
//
// NEX 24/7 World Harvest Engine · Wave H1 · Yield ledger
// Founder-authorised programme · 2026-09-22.
//
// Records real work as it occurs. The yield table is the answer to
// "can NEX prove whether real harvest is happening or nothing is happening?"
// If harvest_yield has zero rows in the last N minutes but harvest_job has
// non-zero completed count, something is fishy. The HQ SLA panel reads this
// table to distinguish "healthy · producing" from "healthy · not producing"
// from "stalled".

import type { PoolClient } from "pg";
import type { HarvestYield, RecordYieldInput } from "./types";

function rowToYield(r: any): HarvestYield {
  return {
    yield_id: r.yield_id,
    job_id: r.job_id,
    worker_id: r.worker_id ?? null,
    yield_kind: r.yield_kind,
    yield_count: Number(r.yield_count),
    yield_meta: r.yield_meta ?? {},
    yielded_at: r.yielded_at,
  };
}

export async function recordYield(client: PoolClient, input: RecordYieldInput): Promise<HarvestYield> {
  const r = await client.query<any>(
    `INSERT INTO nex.harvest_yield (job_id, worker_id, yield_kind, yield_count, yield_meta)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING *`,
    [input.job_id, input.worker_id ?? null, input.yield_kind, input.yield_count ?? 1, JSON.stringify(input.yield_meta ?? {})],
  );
  return rowToYield(r.rows[0]);
}

export async function loadRecentYield(
  client: PoolClient,
  input: { limit?: number; since_iso?: string } = {},
): Promise<readonly HarvestYield[]> {
  const limit = Math.min(1000, Math.max(1, input.limit ?? 100));
  const params: any[] = [limit];
  let where = "TRUE";
  if (input.since_iso) { params.push(input.since_iso); where = "yielded_at >= $2"; }
  const r = await client.query<any>(
    `SELECT * FROM nex.harvest_yield WHERE ${where} ORDER BY yielded_at DESC LIMIT $1`,
    params,
  );
  return r.rows.map(rowToYield);
}

export interface YieldSummary {
  readonly total_last_5_min: number;
  readonly total_last_60_min: number;
  readonly total_last_24h: number;
  readonly by_kind_last_60_min: Readonly<Record<string, number>>;
  readonly most_recent_at: string | null;
}

export async function loadYieldSummary(client: PoolClient): Promise<YieldSummary> {
  const totals = await client.query<{ five: number; sixty: number; day: number; most_recent: string | null }>(
    `SELECT
       COUNT(*) FILTER (WHERE yielded_at >= now() - INTERVAL '5 minutes')::int AS five,
       COUNT(*) FILTER (WHERE yielded_at >= now() - INTERVAL '60 minutes')::int AS sixty,
       COUNT(*) FILTER (WHERE yielded_at >= now() - INTERVAL '24 hours')::int AS day,
       MAX(yielded_at)::text AS most_recent
     FROM nex.harvest_yield`,
  );
  const by = await client.query<{ yield_kind: string; n: number }>(
    `SELECT yield_kind, COUNT(*)::int AS n
       FROM nex.harvest_yield
      WHERE yielded_at >= now() - INTERVAL '60 minutes'
      GROUP BY yield_kind`,
  );
  const by_kind: Record<string, number> = {};
  for (const row of by.rows) by_kind[row.yield_kind] = row.n;
  return {
    total_last_5_min: totals.rows[0]?.five ?? 0,
    total_last_60_min: totals.rows[0]?.sixty ?? 0,
    total_last_24h: totals.rows[0]?.day ?? 0,
    by_kind_last_60_min: by_kind,
    most_recent_at: totals.rows[0]?.most_recent ?? null,
  };
}
