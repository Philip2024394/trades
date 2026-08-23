// GET /api/nex-worker/report-24h
//
// Returns the 24-hour worker reliability report as structured JSON.
// Consumed by:
//   · HQ tile (server-side render · direct JS import)
//   · voice endpoint (below in this file · returns prose)
//   · admin dashboards
//
// GET /api/nex-worker/report-24h?voice=en (or voice=id)
//   → returns { text: "..." } · plain prose · consumed by voice pipeline
//     (existing brain-emits-clean-text contract per Voice V1 doctrine)
//
// No auth here · non-sensitive aggregates. If sensitive fields are added
// later, gate this route.

import { NextResponse } from "next/server";
import pg from "pg";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

let cachedPool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (cachedPool) return cachedPool;
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) throw new Error("NEX_POSTGRES_URL not set");
  cachedPool = new pg.Pool({ connectionString: url, max: 4 });
  return cachedPool;
}

interface HealthRow {
  worker_id: string;
  worker_type: string;
  worker_config: string | null;
  health: string;
  seconds_since_heartbeat: number | null;
  last_cycle_status: string | null;
  recent_failures_24h: number;
}
interface ActivityRow {
  worker_id: string;
  worker_type: string;
  worker_config: string | null;
  cycles_run: number;
  cycles_completed: number;
  cycles_failed: number;
  total_records_new: number;
  total_records_processed: number;
  total_errors: number;
}

async function buildReport() {
  const pool = getPool();
  const [health, activity, cycles] = await Promise.all([
    pool.query<HealthRow>(`SELECT * FROM nex.worker_health_status ORDER BY worker_type, worker_id`),
    pool.query<ActivityRow>(`SELECT * FROM nex.worker_24h_activity`),
    pool.query(`
      SELECT id, worker_id, worker_type, worker_config, started_at, finished_at,
             duration_ms, status, records_processed, records_new, errors_count,
             doctrine_checks
      FROM nex.worker_cycle_run
      WHERE started_at > now() - interval '24 hours'
      ORDER BY started_at DESC
      LIMIT 20
    `),
  ]);
  const healthSummary: Record<string, number> = {};
  for (const h of health.rows) healthSummary[h.health] = (healthSummary[h.health] ?? 0) + 1;

  const total24h = {
    cycles_run: activity.rows.reduce((s, r) => s + Number(r.cycles_run), 0),
    cycles_completed: activity.rows.reduce((s, r) => s + Number(r.cycles_completed), 0),
    cycles_failed: activity.rows.reduce((s, r) => s + Number(r.cycles_failed), 0),
    total_records_new: activity.rows.reduce((s, r) => s + Number(r.total_records_new), 0),
    total_records_processed: activity.rows.reduce((s, r) => s + Number(r.total_records_processed), 0),
    total_errors: activity.rows.reduce((s, r) => s + Number(r.total_errors), 0),
  };
  return {
    generatedAt: new Date().toISOString(),
    workerCount: health.rows.length,
    healthSummary,
    perWorkerHealth: health.rows,
    perWorker24h: activity.rows,
    recentCycles: cycles.rows,
    total24h,
  };
}

function buildProse(report: Awaited<ReturnType<typeof buildReport>>, lang: "en" | "id"): string {
  const date = new Date(report.generatedAt);
  const dateStr = date.toLocaleString(lang === "id" ? "id-ID" : "en-GB", {
    dateStyle: "long", timeStyle: "short",
  });
  const total = report.total24h;
  const h = report.healthSummary;
  const parts: string[] = [];
  if (lang === "id") {
    parts.push(`Laporan mesin NEX, ${dateStr}.`);
    if (report.workerCount === 0) parts.push(`Belum ada worker terpantau.`);
    else parts.push(`${report.workerCount} worker: ${h.HEALTHY ?? 0} sehat, ${h.WARNING ?? 0} peringatan, ${h.CRITICAL ?? 0} kritis, ${h.UNKNOWN ?? 0} belum diketahui.`);
    if (total.cycles_run === 0) parts.push(`Tidak ada siklus dijalankan dalam 24 jam terakhir.`);
    else parts.push(`${total.cycles_run} siklus dijalankan, ${total.total_records_new} rekaman baru, ${total.total_errors} kesalahan.`);
  } else {
    parts.push(`NEX machine report, ${dateStr}.`);
    if (report.workerCount === 0) parts.push(`No workers monitored yet.`);
    else parts.push(`${report.workerCount} workers: ${h.HEALTHY ?? 0} healthy, ${h.WARNING ?? 0} warning, ${h.CRITICAL ?? 0} critical, ${h.UNKNOWN ?? 0} unknown.`);
    if (total.cycles_run === 0) parts.push(`No cycles ran in the last 24 hours.`);
    else parts.push(`${total.cycles_run} cycles executed, ${total.total_records_new} new records added, ${total.total_errors} errors logged.`);
    for (const w of report.perWorker24h) {
      if (Number(w.cycles_run) === 0) continue;
      const wc = w.worker_config ? `, ${w.worker_config}` : "";
      const bad = Number(w.cycles_failed);
      if (bad > 0) parts.push(`${w.worker_type}${wc}: ${w.cycles_completed} completed, ${bad} failed, ${w.total_records_new} new records.`);
      else parts.push(`${w.worker_type}${wc}: ${w.cycles_completed} cycles clean, ${w.total_records_new} new records.`);
    }
  }
  return parts.join(" ");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const voiceLang = url.searchParams.get("voice");
    const report = await buildReport();
    if (voiceLang === "id" || voiceLang === "en") {
      return NextResponse.json({ text: buildProse(report, voiceLang) });
    }
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `report generation failed: ${message}` }, { status: 500 });
  }
}
