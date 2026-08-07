// GET /api/nex/analytics/rollups?scope=campaigns|daily|monthly|country|provider|segment&limit=100
import { NextResponse } from "next/server";
import { withClient } from "@/lib/nex/delivery/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES = new Set(["campaigns","daily","monthly","country","provider","segment"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = (url.searchParams.get("scope") ?? "campaigns").toLowerCase();
  if (!SCOPES.has(scope)) return NextResponse.json({ ok: false, error: "unknown_scope", allowed: Array.from(SCOPES) }, { status: 400 });
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? 100)));
  const table = `nex.rollup_${scope}`;
  const orderCol = scope === "daily" ? "day DESC" : scope === "monthly" ? "month DESC" : "updated_at DESC";

  const rows = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM ${table} ORDER BY ${orderCol} LIMIT ${limit}`);
    return res.rows;
  });
  return NextResponse.json({ ok: true, scope, rows: rows ?? [] });
}
