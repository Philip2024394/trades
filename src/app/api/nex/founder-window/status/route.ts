// src/app/api/nex/founder-window/status/route.ts
//
// Founder's Window · GET /api/nex/founder-window/status
//
// Returns the last snapshot of all 5 subsystem probes plus a fresh
// on-demand probe run (so the dashboard is never showing stale data).
// Auth: founder-only via same gate as /api/nex/hq/live.

import { NextResponse } from "next/server";
import { runAllProbes } from "@/lib/nex/founder-window/probes";
import { getPool } from "@/lib/nex/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isFounderRequest(req: Request): boolean {
  const url = new URL(req.url);
  // Localhost dev shortcut
  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  // Admin cookie
  const cookie = req.headers.get("cookie") ?? "";
  if (cookie.includes("admin_authed=1") || /x-admin-sig|nex_session=/.test(cookie)) return true;
  // Dedicated dashboard token
  const token = req.headers.get("x-hq-token") ?? url.searchParams.get("hq_token");
  const expected = process.env.NEX_HQ_DASHBOARD_TOKEN;
  if (expected && expected.length >= 16 && token && token === expected) return true;
  return false;
}

export async function GET(req: Request) {
  if (!isFounderRequest(req)) {
    return NextResponse.json({ error: "no_founder_credential" }, { status: 401 });
  }
  const t0 = Date.now();
  const results = await runAllProbes();
  // Also return last-known persisted state (in case a probe hangs)
  let persisted: unknown[] = [];
  try {
    const pool = await getPool();
    if (pool) {
      const c = await pool.connect();
      try {
        const r = await c.query(
          `SELECT subsystem, status, status_reason, last_ok_at, last_probe_at, metrics
           FROM nex.founder_window_subsystem_status
           ORDER BY subsystem`
        );
        persisted = r.rows;
      } finally { c.release(); }
    }
  } catch { /* ignore */ }

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    probe_duration_ms: Date.now() - t0,
    subsystems: results,
    persisted,
  }, { headers: { "Cache-Control": "no-store" } });
}
