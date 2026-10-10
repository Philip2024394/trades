// GET  /api/nex/founder/world/orchestration?programme=scaffolding · orchestration status
// POST /api/nex/founder/world/orchestration · trigger one on-demand orchestration tick
//
// NEX World Email Intelligence · Part 7-9 · Session-3

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import { loadOrchestrationStatus, loadRecentTicks, runOrchestrationTick } from "@/lib/nex/discovery-world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const url = new URL(req.url);
  const programme = url.searchParams.get("programme") ?? "scaffolding";
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const status = await loadOrchestrationStatus(client, programme);
    const recent = await loadRecentTicks(client, 12);
    return NextResponse.json({ ok: true, status, recent });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) return NextResponse.json({ ok: true, status: null, recent: [], warning: "schema_not_applied", detail: msg });
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}

export async function POST(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const url = new URL(req.url);
  const programme = url.searchParams.get("programme") ?? "scaffolding";
  const max = Math.max(1, Math.min(20, Number(url.searchParams.get("max_countries") ?? "3")));
  const worker_id = `hq-founder:${new Date().toISOString().slice(0, 16)}`;
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const report = await runOrchestrationTick(client, {
      programme_slug: programme,
      worker_id,
      max_countries_per_tick: max,
    });
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
