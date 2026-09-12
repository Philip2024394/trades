// src/app/api/nex/lab/status/route.ts
//
// Founder ADR-0304 · Lab status endpoint.
// Returns live-measured Lab state · consumed by the HQ dashboard and
// (future) /nexapp/lab page. Never fabricates.

import { NextResponse } from "next/server";
import { LAB_ROOMS } from "@/lib/nex/lab/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RoomStatus {
  slug: string;
  display_name: string;
  schema_name: string;
  primary_agent_id: string;
  target_records: number;
  harvest_rows: number | null;
  verified_rows: number | null;
  growth_1h_pct: number | null;
  latest_snapshot_iso: string | null;
  // Founder 2026-09-10 · cog animation signal · client spins the wheel
  // only when this timestamp is <= 30 minutes old. Never fake activity.
  last_harvested_at_iso: string | null;
  last_harvested_age_sec: number | null;
}

async function loadPg() {
  try { return (await import("pg")).Client; } catch { return null; }
}

function readPgUrl() {
  return process.env.NEX_TAXONOMY_POSTGRES_URL
    ?? process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

export async function GET() {
  const Client = await loadPg();
  const nowIso = new Date().toISOString();
  if (!Client) {
    return NextResponse.json({
      ts_iso: nowIso,
      rooms: [],
      total_rooms: 0,
      total_harvest_rows: 0,
      total_verified_rows: 0,
      pending_promotions: 0,
      error: "pg_module_missing",
    }, { status: 200 });
  }
  const c = new Client({ connectionString: readPgUrl(), connectionTimeoutMillis: 5000 });
  try {
    await c.connect();
  } catch (err) {
    return NextResponse.json({
      ts_iso: nowIso,
      rooms: [],
      error: `pg_connect_failed:${String(err).slice(0, 120)}`,
    }, { status: 200 });
  }

  const rooms: RoomStatus[] = [];
  let totalHarvest = 0, totalVerified = 0;
  try {
    for (const r of LAB_ROOMS) {
      let harvest_rows: number | null = null;
      let verified_rows: number | null = null;
      let latest: string | null = null;
      let growth_1h_pct: number | null = null;
      let last_harvested_at_iso: string | null = null;
      let last_harvested_age_sec: number | null = null;
      try {
        const h = await c.query(`SELECT count(*)::bigint c, max(harvested_at) mx FROM ${r.schema_name}.harvest_raw`);
        harvest_rows = Number(h.rows[0].c);
        totalHarvest += harvest_rows;
        if (h.rows[0].mx) {
          last_harvested_at_iso = h.rows[0].mx.toISOString();
          last_harvested_age_sec = Math.round((Date.now() - h.rows[0].mx.getTime()) / 1000);
        }
      } catch { /* table missing · leave null */ }
      try {
        const v = await c.query(`SELECT count(*)::bigint c FROM ${r.schema_name}.verified`);
        verified_rows = Number(v.rows[0].c);
        totalVerified += verified_rows;
      } catch { /* table missing · leave null */ }
      try {
        const g = await c.query(
          `SELECT ts_iso, metric_value FROM nex_lab.growth_history WHERE room_slug=$1 AND metric_key='harvest_rows' ORDER BY ts_iso DESC LIMIT 12`,
          [r.slug],
        );
        if (g.rows.length > 0) {
          latest = g.rows[0].ts_iso.toISOString();
          if (g.rows.length >= 2) {
            const now = Number(g.rows[0].metric_value);
            const old = Number(g.rows[g.rows.length - 1].metric_value);
            if (old > 0) growth_1h_pct = Number((((now - old) / old) * 100).toFixed(3));
          }
        }
      } catch { /* growth history may be empty · leave null */ }
      rooms.push({
        slug: r.slug,
        display_name: r.display_name,
        schema_name: r.schema_name,
        primary_agent_id: r.primary_agent_id,
        target_records: r.target_records,
        harvest_rows,
        verified_rows,
        growth_1h_pct,
        latest_snapshot_iso: latest,
        last_harvested_at_iso,
        last_harvested_age_sec,
      });
    }
    const pending = await c.query("SELECT count(*)::int c FROM nex_lab.promotion_events WHERE status='pending'").catch(() => ({ rows: [{ c: 0 }] }));
    return NextResponse.json({
      ts_iso: nowIso,
      total_rooms: rooms.length,
      total_harvest_rows: totalHarvest,
      total_verified_rows: totalVerified,
      pending_promotions: pending.rows[0].c,
      rooms,
    }, { headers: { "cache-control": "no-store" } });
  } finally {
    try { await c.end(); } catch { /* ignore */ }
  }
}
