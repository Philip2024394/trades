// GET/PUT/DELETE /api/nex/campaigns/{id}
// DELETE = archive (moves to archived state · never hard delete for audit trail)
import { NextResponse } from "next/server";
import { getCampaign, transitionCampaignStatus, updateCampaign } from "@/lib/nex/campaigns/registry";
import type { CampaignInput } from "@/lib/nex/campaigns/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const c = await getCampaign(id);
  if (!c) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, campaign: c });
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: Partial<CampaignInput>;
  try { body = await request.json() as Partial<CampaignInput>; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const c = await updateCampaign(id, body);
  if (!c) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, campaign: c });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await transitionCampaignStatus(id, "archived");
  if (!r.ok) return NextResponse.json(r, { status: r.error === "not_found" ? 404 : 409 });
  return NextResponse.json(r);
}
