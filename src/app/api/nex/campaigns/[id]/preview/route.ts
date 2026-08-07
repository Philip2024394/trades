// GET /api/nex/campaigns/{id}/preview
// Aggregates a FRESH audience preview across every attached segment ·
// caches it on nex.campaigns.last_preview.
import { NextResponse } from "next/server";
import { previewCampaign } from "@/lib/nex/campaigns/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const preview = await previewCampaign(id);
  if (!preview) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...preview });
}
