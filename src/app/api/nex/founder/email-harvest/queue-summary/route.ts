// GET /api/nex/founder/email-harvest/queue-summary
//
// Founder-only read-only aggregate of the harvest_job queue.
// Returns empty summary honestly if the schema is not yet applied.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import { loadQueueSummary } from "@/lib/nex/harvest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const summary = await loadQueueSummary(client);
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) {
      return NextResponse.json({
        ok: true,
        summary: { queued: 0, claimed: 0, processing: 0, completed: 0, failed: 0, dead_letter: 0 },
        warning: "harvest_schema_not_applied",
        detail: msg,
      });
    }
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
