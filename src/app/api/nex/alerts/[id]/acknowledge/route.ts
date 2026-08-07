// POST /api/nex/alerts/{id}/acknowledge  { actor?: string }
import { NextResponse } from "next/server";
import { acknowledgeAlert } from "@/lib/nex/alerts/evaluator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { actor?: string } = {};
  try { body = await request.json() as { actor?: string }; } catch { /* body optional */ }
  const r = await acknowledgeAlert(id, body.actor ?? "admin");
  if (!r) return NextResponse.json({ ok: false, error: "not_found_or_not_open" }, { status: 404 });
  return NextResponse.json({ ok: true, alert: r });
}
