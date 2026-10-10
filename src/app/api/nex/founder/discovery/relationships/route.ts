// GET /api/nex/founder/discovery/relationships?topic=scaffolding&parent=scaffolding
// Returns evidence-backed related-term relationships.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import { loadRelationships } from "@/lib/nex/discovery-intel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const url = new URL(req.url);
  const topic = url.searchParams.get("topic") ?? "scaffolding";
  const parent = url.searchParams.get("parent") ?? undefined;
  const min = url.searchParams.get("min_evidence");
  const min_evidence = min ? Number(min) : undefined;
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const relationships = await loadRelationships(client, { topic, parent_term: parent, min_evidence });
    return NextResponse.json({ ok: true, relationships });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) return NextResponse.json({ ok: true, relationships: [], warning: "schema_not_applied", detail: msg });
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
