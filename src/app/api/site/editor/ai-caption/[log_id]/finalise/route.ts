// POST /api/site/editor/ai-caption/[log_id]/finalise
//
// After the merchant edits the AI-drafted caption and posts, we
// update the training row with what actually went out. The diff
// (ai_caption vs final_caption) is the primary learning signal for
// the caption model — captures the human correction pattern.
//
// Only the owner of the log row can update it. Fields updatable:
//   • final_caption          — the string that actually shipped
//   • engagement_score       — set later by an ingest job when the
//                              destination network returns stats

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ log_id: string }> }
): Promise<NextResponse> {
  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  const { log_id: logId } = await ctx.params;
  if (!logId) return NextResponse.json({ ok: false, error: "log_id_required" }, { status: 400 });

  let body: { final_caption?: unknown; engagement_score?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const finalCaption = typeof body.final_caption === "string"
    ? body.final_caption.slice(0, 4000)
    : null;
  const engagementScore = typeof body.engagement_score === "number" && Number.isFinite(body.engagement_score)
    ? body.engagement_score
    : null;

  const patch: Record<string, unknown> = {};
  if (finalCaption   !== null) patch.final_caption = finalCaption;
  if (engagementScore !== null) {
    patch.engagement_score       = engagementScore;
    patch.engagement_snapshot_at = new Date().toISOString();
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "nothing_to_update" }, { status: 400 });
  }

  const upd = await supabaseAdmin
    .from("hammerex_site_editor_ai_captions")
    .update(patch)
    .eq("id",                      logId)
    .eq("requester_merchant_slug", merchantSlug)
    .select("id")
    .maybeSingle();
  if (upd.error || !upd.data) {
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
