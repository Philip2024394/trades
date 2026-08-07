// POST /api/nex/campaigns/{id}/duplicate  { name?: string }
import { NextResponse } from "next/server";
import { duplicateCampaign } from "@/lib/nex/campaigns/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { name?: string } = {};
  try { body = await request.json() as { name?: string }; } catch { /* body optional */ }
  const c = await duplicateCampaign(id, body.name);
  if (!c) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, campaign: c });
}
