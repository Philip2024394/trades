// GET /api/nexapp/latest-discovery
//
// Feeds the NEX Contextual Workspace Zone with the most-recent walker cycle
// outcome. Consumed by NexAppShell client-side polling (~20s cadence).
// Doctrine anchors:
//   project_nex_contextual_workspace_zone_doctrine_2026_08_25
//   project_nex_phase1_rejection_telemetry_2026_08_25
//
// Response shape (stable · versioned via `version` field):
//   {
//     version: 1,
//     latest: {
//       workerId: string,               // "acquisition:market:Yogyakarta"
//       workerConfig: string | null,    // "market:sleman:nominatim"
//       vertical: "food"|"accommodation"|"market"|"transport"|"unknown",
//       city: string | null,
//       recordsNew: number,
//       recordsProcessed: number,
//       cycleOutcome: string | null,    // PRODUCTIVE / ALL_DEDUPED / PROVIDER_EMPTY / ...
//       finishedAt: string,             // ISO
//       secondsAgo: number,
//     } | null,
//     rollup24h: {
//       recordsNew: number,
//       cyclesCompleted: number,
//       byVertical: Record<string, number>, // { food: 12, market: 43, ... }
//     },
//   }
//
// Only returns cycles from the last 24h. Only cycles that have my Phase 1
// telemetry (`summary ? 'cycle_outcome'`) are surfaced as "latest" — older
// cycles that predate the telemetry install are excluded from the primary
// signal to keep the context card honest.

import { NextResponse } from "next/server";
import { getFoodDbPool } from "@/lib/nex-food/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface LatestRow {
  worker_id: string;
  worker_config: string | null;
  records_new: number | null;
  records_processed: number | null;
  cycle_outcome: string | null;
  finished_at: Date;
  seconds_ago: number;
}
interface RollupRow {
  vertical: string;
  records_new: number;
  cycles_completed: number;
}

function verticalFromWorkerId(workerId: string): string {
  // worker_id shape: "acquisition:<vertical>:<CityLabel>" · pluck [1].
  const parts = workerId.split(":");
  const v = parts[1]?.toLowerCase() ?? "";
  if (v === "food" || v === "accommodation" || v === "market" || v === "transport") return v;
  return "unknown";
}

function cityFromWorkerConfig(workerConfig: string | null): string | null {
  if (!workerConfig) return null;
  // Configs shape like "market:sleman:nominatim" / "food:Bandung:bandung" /
  // "transport:Kulon Progo:query-universe-v1". Middle token = city.
  const parts = workerConfig.split(":");
  return parts[1] ?? null;
}

export async function GET() {
  try {
    const pool = getFoodDbPool();

    const [latestRes, rollupRes] = await Promise.all([
      pool.query<LatestRow>(`
        SELECT
          worker_id,
          worker_config,
          records_new,
          records_processed,
          summary->>'cycle_outcome'                         AS cycle_outcome,
          finished_at,
          EXTRACT(EPOCH FROM (now() - finished_at))::int    AS seconds_ago
        FROM nex.worker_cycle_run
        WHERE finished_at IS NOT NULL
          AND worker_type = 'acquisition'
          AND summary ? 'cycle_outcome'
          AND finished_at >= now() - interval '24 hours'
        ORDER BY finished_at DESC
        LIMIT 1
      `),
      pool.query<RollupRow>(`
        SELECT
          split_part(worker_id, ':', 2)   AS vertical,
          COALESCE(SUM(records_new), 0)::int  AS records_new,
          COUNT(*)::int                    AS cycles_completed
        FROM nex.worker_cycle_run
        WHERE finished_at IS NOT NULL
          AND worker_type = 'acquisition'
          AND status = 'completed'
          AND finished_at >= now() - interval '24 hours'
        GROUP BY vertical
        ORDER BY records_new DESC
      `),
    ]);

    const row = latestRes.rows[0];
    const latest = row
      ? {
          workerId:         row.worker_id,
          workerConfig:     row.worker_config,
          vertical:         verticalFromWorkerId(row.worker_id),
          city:             cityFromWorkerConfig(row.worker_config),
          recordsNew:       row.records_new ?? 0,
          recordsProcessed: row.records_processed ?? 0,
          cycleOutcome:     row.cycle_outcome,
          finishedAt:       row.finished_at.toISOString(),
          secondsAgo:       row.seconds_ago,
        }
      : null;

    const byVertical: Record<string, number> = {};
    let totalNew = 0;
    let totalCycles = 0;
    for (const r of rollupRes.rows) {
      byVertical[r.vertical] = r.records_new;
      totalNew += r.records_new;
      totalCycles += r.cycles_completed;
    }

    return NextResponse.json({
      version: 1,
      latest,
      rollup24h: {
        recordsNew:      totalNew,
        cyclesCompleted: totalCycles,
        byVertical,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ version: 1, error: msg, latest: null, rollup24h: null }, { status: 500 });
  }
}
