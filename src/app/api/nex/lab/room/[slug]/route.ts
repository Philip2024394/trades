// src/app/api/nex/lab/room/[slug]/route.ts
//
// Founder ADR-0304 · Per-room detail feed for the drill-in page.
// Returns counts, growth history, recent harvest samples.

import { NextResponse } from "next/server";
import { LAB_ROOMS } from "@/lib/nex/lab/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadPg() {
  try { return (await import("pg")).Client; } catch { return null; }
}
function readPgUrl() {
  return process.env.NEX_TAXONOMY_POSTGRES_URL
    ?? process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const room = LAB_ROOMS.find((r) => r.slug === slug);
  if (!room) return NextResponse.json({ error: "unknown_room" }, { status: 404 });

  const Client = await loadPg();
  if (!Client) return NextResponse.json({ error: "pg_missing" }, { status: 500 });
  const c = new Client({ connectionString: readPgUrl(), connectionTimeoutMillis: 5000 });
  try { await c.connect(); }
  catch (err) { return NextResponse.json({ error: `pg_connect:${String(err).slice(0, 100)}` }, { status: 200 }); }

  try {
    let harvest_rows: number | null = null;
    let verified_rows: number | null = null;
    let recent_samples: Array<{ name?: string; city?: string; harvested_at?: string }> = [];
    let growth_series: Array<{ ts_iso: string; metric_value: number }> = [];
    let growth_1h_pct: number | null = null;

    try {
      const h = await c.query(`SELECT count(*)::bigint c FROM ${room.schema_name}.harvest_raw`);
      harvest_rows = Number(h.rows[0].c);
    } catch { /* leave null */ }
    try {
      const v = await c.query(`SELECT count(*)::bigint c FROM ${room.schema_name}.verified`);
      verified_rows = Number(v.rows[0].c);
    } catch { /* leave null */ }
    try {
      const samples = await c.query(
        `SELECT payload, harvested_at FROM ${room.schema_name}.harvest_raw ORDER BY harvested_at DESC LIMIT 15`,
      );
      recent_samples = samples.rows.map((r) => ({
        name: r.payload?.name ?? null,
        city: r.payload?.city ?? null,
        harvested_at: r.harvested_at?.toISOString?.() ?? null,
      }));
    } catch { /* empty */ }
    try {
      const g = await c.query(
        `SELECT ts_iso, metric_value FROM nex_lab.growth_history WHERE room_slug=$1 AND metric_key='harvest_rows' ORDER BY ts_iso ASC LIMIT 60`,
        [slug],
      );
      growth_series = g.rows.map((r) => ({ ts_iso: r.ts_iso.toISOString(), metric_value: Number(r.metric_value) }));
      if (growth_series.length >= 2) {
        const first = growth_series[0].metric_value;
        const last = growth_series[growth_series.length - 1].metric_value;
        if (first > 0) growth_1h_pct = Number((((last - first) / first) * 100).toFixed(3));
      }
    } catch { /* empty */ }

    return NextResponse.json({
      slug: room.slug,
      display_name: room.display_name,
      primary_agent_id: room.primary_agent_id,
      target_records: room.target_records,
      harvest_rows,
      verified_rows,
      growth_1h_pct,
      recent_samples,
      growth_series,
    }, { headers: { "cache-control": "no-store" } });
  } finally {
    try { await c.end(); } catch { /* ignore */ }
  }
}
