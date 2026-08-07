// GET /api/nex/experiments/{id} · experiment + variants
import { NextResponse } from "next/server";
import { getExperiment } from "@/lib/nex/experiments/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await getExperiment(id);
  if (!r) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...r });
}
