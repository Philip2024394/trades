// src/app/api/nex/founder-window/events/route.ts
//
// Founder's Window · GET /api/nex/founder-window/events?after=<iso>&limit=200
//
// Cursor-based event stream. Returns events after the given timestamp so
// the client can incrementally fetch new events without duplicates.
// Companion to the SSE stream at /api/nex/founder-window/stream but
// works over plain fetch (useful for slow networks / debugging).

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isFounderRequest(req: Request): boolean {
  const url = new URL(req.url);
  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  const cookie = req.headers.get("cookie") ?? "";
  if (cookie.includes("admin_authed=1") || /x-admin-sig|nex_session=/.test(cookie)) return true;
  const token = req.headers.get("x-hq-token") ?? url.searchParams.get("hq_token");
  const expected = process.env.NEX_HQ_DASHBOARD_TOKEN;
  if (expected && expected.length >= 16 && token && token === expected) return true;
  return false;
}

export async function GET(req: Request) {
  if (!isFounderRequest(req)) {
    return NextResponse.json({ error: "no_founder_credential" }, { status: 401 });
  }
  const url = new URL(req.url);
  const after = url.searchParams.get("after"); // ISO timestamp
  const subsystem = url.searchParams.get("subsystem");
  const kind = url.searchParams.get("kind");
  const status = url.searchParams.get("status");
  const limit = Math.min(500, Math.max(10, Number(url.searchParams.get("limit") ?? "100")));

  const pool = await getPool();
  if (!pool) {
    return NextResponse.json({ events: [], note: "postgres_pool_unavailable" });
  }
  const c = await pool.connect();
  try {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (after) { params.push(after); clauses.push(`emitted_at > $${params.length}::timestamptz`); }
    if (subsystem) { params.push(subsystem); clauses.push(`subsystem = $${params.length}`); }
    if (kind) { params.push(kind); clauses.push(`event_kind = $${params.length}`); }
    if (status) { params.push(status); clauses.push(`status = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    params.push(limit);
    const sql = `
      SELECT event_id, emitted_at, subsystem, event_kind, status, request_id, actor,
             subject_ref, message, reference, duration_ms
      FROM nex.founder_window_event
      ${where}
      ORDER BY emitted_at DESC
      LIMIT $${params.length}
    `;
    const r = await c.query(sql, params);
    // Fresh top of the log first for the UI; the SSE stream reverses order
    return NextResponse.json({
      generated_at: new Date().toISOString(),
      count: r.rowCount,
      events: r.rows,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: "query_failed", detail: String(err).slice(0, 200) }, { status: 500 });
  } finally { c.release(); }
}
