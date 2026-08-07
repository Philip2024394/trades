// GET /api/nex/analytics/campaigns/{id} — funnel · splits · timeline
import { NextResponse } from "next/server";
import { campaignAnalytics } from "@/lib/nex/analytics/dashboards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await campaignAnalytics(id);
  if (!a) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...a });
}
