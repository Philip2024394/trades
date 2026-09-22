// GET /api/nex/founder/email-harvest/workers
//
// Founder-only list of harvest workers with heartbeat state.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import { loadWorkers } from "@/lib/nex/harvest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const workers = await loadWorkers(client);
    return NextResponse.json({ ok: true, workers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) {
      return NextResponse.json({ ok: true, workers: [], warning: "harvest_schema_not_applied", detail: msg });
    }
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
