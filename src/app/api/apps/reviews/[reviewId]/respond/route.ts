// POST /api/apps/reviews/[reviewId]/respond — merchant posts a public reply.
// One response per review; PATCH-style upsert (edit if exists).

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";
import { recordTimelineEvent } from "@/lib/os/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { body?: unknown; responderDisplayName?: unknown };

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ reviewId: string }> }
) {
  const { reviewId } = await ctx.params;
  const merchantId = await getMerchantIdFromRequest(null);
  if (!merchantId) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 }
    );
  }
  const { data: review } = await supabaseAdmin
    .from("app_reviews_reviews")
    .select("id, merchant_id, project_id, property_id")
    .eq("id", reviewId)
    .maybeSingle();
  if (!review || review.merchant_id !== merchantId) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const name =
    typeof body.responderDisplayName === "string"
      ? body.responderDisplayName.trim()
      : "The team";
  if (text.length < 3) {
    return NextResponse.json(
      { ok: false, error: "Response is too short." },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("app_reviews_responses")
    .upsert(
      {
        review_id: reviewId,
        merchant_id: merchantId,
        body: text,
        responder_display_name: name || "The team"
      },
      { onConflict: "review_id" }
    );
  if (error) {
    return NextResponse.json(
      { ok: false, error: "Could not save response." },
      { status: 500 }
    );
  }

  if (review.property_id) {
    await recordTimelineEvent({
      propertyId: review.property_id,
      projectId: review.project_id,
      actorBusinessListingId: merchantId,
      verb: "review.posted",   // Uses posted for the timeline surface; consumers can filter by verb+subject
      subjectType: "review",
      subjectId: reviewId,
      headline: "Merchant responded to your review",
      payload: { response: text.slice(0, 240) }
    });
  }

  return NextResponse.json({ ok: true });
}
