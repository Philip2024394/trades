// GET /api/apps/ai-visualiser/hd/[renderId]
//
// Redirects to the HD render URL — but only if the parent lead has
// been marked as 'quoted' or 'won' by the merchant. This is the
// value-asymmetry gate: freeloaders get watermarked SD, buyers get
// HD after real merchant intent.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNLOCKED_STATUSES = new Set(["quoted", "won"]);

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ renderId: string }> }
) {
  const { renderId } = await ctx.params;
  const { data: render } = await supabaseAdmin
    .from("app_ai_visualiser_renders")
    .select("id, render_url, homeowner_id, status")
    .eq("id", renderId)
    .maybeSingle();
  if (!render || render.status !== "complete" || !render.render_url) {
    return new NextResponse("Render not found or not complete.", { status: 404 });
  }
  const { data: lead } = await supabaseAdmin
    .from("app_ai_visualiser_leads")
    .select("status")
    .eq("homeowner_id", render.homeowner_id)
    .maybeSingle();
  if (!lead || !UNLOCKED_STATUSES.has(lead.status)) {
    return new NextResponse(
      "This design is watermarked until the merchant provides a quote.",
      { status: 402 }
    );
  }
  return NextResponse.redirect(render.render_url, 302);
}
