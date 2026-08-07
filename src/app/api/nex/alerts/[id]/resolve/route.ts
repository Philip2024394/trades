// POST /api/nex/alerts/{id}/resolve  { actor?: string, reason: string }
import { NextResponse } from "next/server";
import { resolveAlert } from "@/lib/nex/alerts/evaluator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { actor?: string; reason?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.reason || body.reason.trim().length < 3) return NextResponse.json({ ok: false, error: "reason required (min 3 chars)" }, { status: 400 });
  const r = await resolveAlert(id, body.actor ?? "admin", body.reason.trim());
  if (!r) return NextResponse.json({ ok: false, error: "not_found_or_already_resolved" }, { status: 404 });
  return NextResponse.json({ ok: true, alert: r });
}
