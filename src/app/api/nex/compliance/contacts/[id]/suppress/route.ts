// POST /api/nex/compliance/contacts/{id}/suppress
// Body: { reason: string, actor?: string }
// Sets state = 'manual_block' via the Compliance Engine.
import { NextResponse } from "next/server";
import { manualSuppress } from "@/lib/nex/compliance/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { reason?: string; actor?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.reason || body.reason.trim().length < 3) {
    return NextResponse.json({ ok: false, error: "reason required (min 3 chars)" }, { status: 400 });
  }
  const r = await manualSuppress(id, body.reason.trim(), body.actor?.trim() || "admin");
  if (!r) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, contact: r });
}
