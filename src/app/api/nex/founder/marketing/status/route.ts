// GET /api/nex/founder/marketing/status
//
// NEX Email Marketing HQ · Founder Control Centre
// System status readout · Founder-only.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth, getHQSystemStatus } from "@/lib/nex/marketing/founder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const pool = await getPool();
  if (!pool) {
    return NextResponse.json({
      ok: true,
      status: {
        ready: false, send_enabled: false, primary_provider: "none",
        configured_providers: [], active_senders: 0, total_founder_senders: 0,
        pending_queue: 0, auto_state: "not_configured", compliance_ok: false,
        last_activity_at: null, backend_available: false,
      },
    });
  }
  const client = await pool.connect();
  try {
    const status = await getHQSystemStatus(client, auth);
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally {
    client.release();
  }
}
