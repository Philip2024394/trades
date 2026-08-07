// GET /api/nex/alerts/{id} — single alert + dispatch history
import { NextResponse } from "next/server";
import { getAlert } from "@/lib/nex/alerts/evaluator";
import { withClient } from "@/lib/nex/delivery/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const alert = await getAlert(id);
  if (!alert) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const dispatches = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.alert_dispatches WHERE alert_id = $1 ORDER BY dispatched_at DESC`, [id]);
    return res.rows;
  }) ?? [];
  return NextResponse.json({ ok: true, alert, dispatches });
}
