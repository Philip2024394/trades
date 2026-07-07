// GET /api/reviews/[token] — load the request context for the review form.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  if (!token || token.length < 12) {
    return NextResponse.json({ ok: false, error: "Invalid link." }, { status: 400 });
  }
  const { data: reqRow } = await supabaseAdmin
    .from("app_reviews_review_requests")
    .select(
      "id, status, expires_at, opened_at, merchant_id, project_id, property_id, homeowner_id"
    )
    .eq("share_token", token)
    .maybeSingle();
  if (!reqRow) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const expired = reqRow.expires_at
    ? new Date(reqRow.expires_at).getTime() < Date.now()
    : false;

  const [merchant, project, homeowner, existingReview] = await Promise.all([
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("display_name, trading_name, avatar_url, city, postcode_prefix")
      .eq("id", reqRow.merchant_id)
      .maybeSingle(),
    supabaseAdmin
      .from("os_projects")
      .select("title, leaf_slug")
      .eq("id", reqRow.project_id)
      .maybeSingle(),
    reqRow.homeowner_id
      ? supabaseAdmin
          .from("app_ai_visualiser_homeowners")
          .select("full_name, postcode")
          .eq("id", reqRow.homeowner_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("app_reviews_reviews")
      .select("id, rating, headline, body")
      .eq("request_id", reqRow.id)
      .maybeSingle()
  ]);

  // Mark opened once
  if (!reqRow.opened_at && reqRow.status === "sent") {
    await supabaseAdmin
      .from("app_reviews_review_requests")
      .update({ opened_at: new Date().toISOString(), status: "opened" })
      .eq("id", reqRow.id);
  }

  return NextResponse.json({
    ok: true,
    request: {
      id: reqRow.id,
      status: existingReview.data ? "completed" : reqRow.status,
      expired
    },
    merchant: merchant.data,
    project: project.data,
    homeowner: homeowner.data,
    existingReview: existingReview.data
  });
}
