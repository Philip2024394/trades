// POST /api/nex/campaigns/{id}/status  { to: CampaignStatus }
import { NextResponse } from "next/server";
import { transitionCampaignStatus } from "@/lib/nex/campaigns/registry";
import type { CampaignStatus } from "@/lib/nex/campaigns/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { to?: CampaignStatus };
  try { body = await request.json() as { to?: CampaignStatus }; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.to) return NextResponse.json({ ok: false, error: "to required" }, { status: 400 });
  const r = await transitionCampaignStatus(id, body.to);
  if (!r.ok) return NextResponse.json(r, { status: r.error === "not_found" ? 404 : 409 });
  return NextResponse.json(r);
}
