// POST /api/nex/journeys/{id}/status  { to: 'active' | 'paused' | 'archived' }
import { NextResponse } from "next/server";
import { activate, archive, pause } from "@/lib/nex/journeys/definition/versioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { to?: "active" | "paused" | "archived" };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (body.to === "active")   { const r = await activate(id); return NextResponse.json(r, { status: r.ok ? 200 : 409 }); }
  if (body.to === "paused")   { const ok = await pause(id);   return NextResponse.json({ ok }, { status: ok ? 200 : 409 }); }
  if (body.to === "archived") { const ok = await archive(id); return NextResponse.json({ ok }, { status: ok ? 200 : 409 }); }
  return NextResponse.json({ ok: false, error: "invalid_to" }, { status: 400 });
}
