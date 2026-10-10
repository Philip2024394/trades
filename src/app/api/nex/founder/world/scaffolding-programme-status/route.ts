// GET /api/nex/founder/world/scaffolding-programme-status
//
// Founder-only live status for the scaffolding World Discovery programme.
// Reads persisted state · never fabricates · never returns raw email addresses.
// Founder-authorised World Activation · 2026-09-22.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import { loadScaffoldingProgrammeStatus } from "@/lib/nex/discovery-world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const url = new URL(req.url);
  const slug = url.searchParams.get("programme") ?? "scaffolding";
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const status = await loadScaffoldingProgrammeStatus(client, slug);
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) {
      return NextResponse.json({ ok: true, status: null, warning: "schema_not_applied", detail: msg });
    }
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
