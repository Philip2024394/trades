// GET /api/nex/segments/{id}/preview — preview a saved segment
import { NextResponse } from "next/server";
import { bumpSegmentUsage, getSegment } from "@/lib/nex/segments/registry";
import { previewAudience } from "@/lib/nex/segments/preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const segment = await getSegment(id);
  if (!segment) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const preview = await previewAudience(segment.filter);
  await bumpSegmentUsage(id);
  return NextResponse.json({ ok: true, segment, ...preview });
}
