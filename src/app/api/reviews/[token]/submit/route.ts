// POST /api/reviews/[token]/submit
//
// Homeowner posts a review. Verified=true because it's bound to a
// completed sign-off. Idempotent per request (unique index on
// reviews.request_id would be nice; we enforce in code with a lookup).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordTimelineEvent } from "@/lib/os/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  rating?: unknown;
  headline?: unknown;
  body?: unknown;
  mediaUrls?: unknown;
  reviewerDisplayName?: unknown;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const rating =
    typeof body.rating === "number" && Number.isFinite(body.rating)
      ? Math.round(body.rating)
      : 0;
  const headline =
    typeof body.headline === "string" ? body.headline.trim() : "";
  const bodyText = typeof body.body === "string" ? body.body.trim() : "";
  const mediaUrls = Array.isArray(body.mediaUrls)
    ? body.mediaUrls
        .filter((v): v is string => typeof v === "string")
        .slice(0, 4)
    : [];
  const reviewerDisplayName =
    typeof body.reviewerDisplayName === "string"
      ? body.reviewerDisplayName.trim()
      : "";

  if (rating < 1 || rating > 5) {
    return NextResponse.json(
      { ok: false, error: "Rate 1–5 stars." },
      { status: 400 }
    );
  }
  if (headline.length < 3) {
    return NextResponse.json(
      { ok: false, error: "Add a short headline." },
      { status: 400 }
    );
  }
  if (bodyText.length < 10) {
    return NextResponse.json(
      { ok: false, error: "Tell us a bit more about the job." },
      { status: 400 }
    );
  }

  const { data: reqRow } = await supabaseAdmin
    .from("app_reviews_review_requests")
    .select(
      "id, status, merchant_id, project_id, property_id, job_id, homeowner_party_id, homeowner_id, expires_at"
    )
    .eq("share_token", token)
    .maybeSingle();
  if (!reqRow) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  if (reqRow.expires_at && new Date(reqRow.expires_at) < new Date()) {
    return NextResponse.json(
      { ok: false, error: "This link has expired." },
      { status: 410 }
    );
  }
  if (reqRow.status === "completed" || reqRow.status === "declined") {
    return NextResponse.json(
      { ok: false, error: "You've already reviewed this job." },
      { status: 409 }
    );
  }

  // De-dupe by request_id (in case of double-tap)
  const { data: existing } = await supabaseAdmin
    .from("app_reviews_reviews")
    .select("id")
    .eq("request_id", reqRow.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, alreadyPosted: true, reviewId: existing.id });
  }

  // Default reviewer name: from homeowner if not supplied
  let finalName = reviewerDisplayName;
  if (!finalName && reqRow.homeowner_id) {
    const { data: ho } = await supabaseAdmin
      .from("app_ai_visualiser_homeowners")
      .select("full_name, postcode")
      .eq("id", reqRow.homeowner_id)
      .maybeSingle();
    if (ho) {
      const firstName = ho.full_name.split(" ")[0];
      const area = (ho.postcode || "").slice(0, 4);
      finalName = area ? `${firstName} in ${area}` : firstName;
    }
  }
  if (!finalName) finalName = "Verified homeowner";

  const { data: created, error } = await supabaseAdmin
    .from("app_reviews_reviews")
    .insert({
      request_id: reqRow.id,
      merchant_id: reqRow.merchant_id,
      project_id: reqRow.project_id,
      property_id: reqRow.property_id,
      job_id: reqRow.job_id,
      homeowner_party_id: reqRow.homeowner_party_id,
      reviewer_display_name: finalName,
      rating,
      headline,
      body: bodyText,
      media_urls: mediaUrls,
      verified: true,
      verified_reason: "job_sign_off",
      visibility: "public" as const
    })
    .select("id")
    .single();
  if (error || !created) {
    console.error("[reviews.submit] insert failed", error);
    return NextResponse.json(
      { ok: false, error: "Could not save your review." },
      { status: 500 }
    );
  }

  await supabaseAdmin
    .from("app_reviews_review_requests")
    .update({
      status: "completed",
      completed_at: new Date().toISOString()
    })
    .eq("id", reqRow.id);

  await recordTimelineEvent({
    propertyId: reqRow.property_id,
    projectId: reqRow.project_id,
    actorPartyId: reqRow.homeowner_party_id,
    actorBusinessListingId: reqRow.merchant_id,
    verb: "review.posted",
    subjectType: "review",
    subjectId: created.id,
    headline: `${rating}★ review posted`,
    payload: { rating, headline }
  });

  return NextResponse.json({ ok: true, reviewId: created.id });
}
