// POST /api/nex/experiments/{id}/status  { to: 'active' | 'paused' | 'ended' }
import { NextResponse } from "next/server";
import { activateExperiment, endExperiment, pauseExperiment } from "@/lib/nex/experiments/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { to?: "active" | "paused" | "ended" };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (body.to === "active") { const r = await activateExperiment(id); return NextResponse.json(r, { status: r.ok ? 200 : 409 }); }
  if (body.to === "paused") { const ok = await pauseExperiment(id);    return NextResponse.json({ ok }, { status: ok ? 200 : 409 }); }
  if (body.to === "ended")  { const ok = await endExperiment(id);      return NextResponse.json({ ok }, { status: ok ? 200 : 409 }); }
  return NextResponse.json({ ok: false, error: "invalid_to" }, { status: 400 });
}
