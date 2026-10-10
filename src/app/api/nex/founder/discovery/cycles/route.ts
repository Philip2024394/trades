// GET /api/nex/founder/discovery/cycles?topic=scaffolding&limit=12
// Returns the most-recent cycle reports (default: last 12 · 1 hour at 5-min cadence).

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import { loadRecentCycles } from "@/lib/nex/discovery-intel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const url = new URL(req.url);
  const topic = url.searchParams.get("topic") ?? "scaffolding";
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "12")));
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const cycles = await loadRecentCycles(client, topic, limit);
    return NextResponse.json({ ok: true, cycles });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) return NextResponse.json({ ok: true, cycles: [], warning: "schema_not_applied", detail: msg });
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
