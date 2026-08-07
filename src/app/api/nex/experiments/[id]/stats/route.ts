// GET /api/nex/experiments/{id}/stats · per-variant conversion metrics
import { NextResponse } from "next/server";
import { computeExperimentStats } from "@/lib/nex/experiments/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = await computeExperimentStats(id);
  if (!s) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...s });
}
