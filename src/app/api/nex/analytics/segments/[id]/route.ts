// GET /api/nex/analytics/segments/{id} — engagement + best send time
import { NextResponse } from "next/server";
import { segmentIntelligence } from "@/lib/nex/analytics/dashboards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = await segmentIntelligence(id);
  if (!s) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...s });
}
