// POST /api/nex/journeys/triggers/{triggerId}/status  { to: 'active' | 'paused' | 'archived' }
import { NextResponse } from "next/server";
import { activateTrigger, archiveTrigger, pauseTrigger } from "@/lib/nex/journeys/triggers/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ triggerId: string }> }) {
  const { triggerId } = await ctx.params;
  let body: { to?: "active" | "paused" | "archived" };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (body.to === "active")   { const r = await activateTrigger(triggerId); return NextResponse.json(r, { status: r.ok ? 200 : 409 }); }
  if (body.to === "paused")   { const ok = await pauseTrigger(triggerId);   return NextResponse.json({ ok }, { status: ok ? 200 : 409 }); }
  if (body.to === "archived") { const ok = await archiveTrigger(triggerId); return NextResponse.json({ ok }, { status: ok ? 200 : 409 }); }
  return NextResponse.json({ ok: false, error: "invalid_to" }, { status: 400 });
}
