// POST /api/reviews/moderate/[id]/respond
//
// Merchant's public reply to a review. Writes owner_response_* fields
// on the review row + emits an owner_replied_public event.
//
// Auth model (interim): the request must carry a `merchant_slug`
// cookie that matches the review's merchant_slug. Session-based auth
// replaces this cookie check when the auth layer lands.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

const MAX_RESPONSE_LEN = 800;
const MIN_RESPONSE_LEN = 20;

type RespondPayload = {
  body: string;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });
  }

  let payload: RespondPayload;
  try {
    payload = (await req.json()) as RespondPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const body = String(payload.body ?? "").trim();
  if (body.length < MIN_RESPONSE_LEN) {
    return NextResponse.json({ ok: false, error: "body-too-short" }, { status: 400 });
  }
  if (body.length > MAX_RESPONSE_LEN) {
    return NextResponse.json({ ok: false, error: "body-too-long" }, { status: 400 });
  }

  // Auth gate — cookie merchant_slug must match the review's merchant.
  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }

  // Look up the review to check ownership + current state. A frozen
  // or removed review can't be responded to.
  const review = await supabaseAdmin
    .from("hammerex_network_reviews")
    .select("id, merchant_slug, status, owner_response_body")
    .eq("id", id)
    .maybeSingle();

  if (review.error) {
    // eslint-disable-next-line no-console
    console.error("[reviews.respond] lookup failed", review.error);
    return NextResponse.json({ ok: false, error: "db-lookup-failed" }, { status: 500 });
  }
  if (!review.data) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  if (review.data.merchant_slug !== merchantSlug) {
    return NextResponse.json({ ok: false, error: "not-owner" }, { status: 403 });
  }
  if (review.data.status === "frozen" || review.data.status === "removed") {
    return NextResponse.json(
      { ok: false, error: `review-${review.data.status}` },
      { status: 409 }
    );
  }
  if (review.data.owner_response_body) {
    return NextResponse.json({ ok: false, error: "already-responded" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const update = await supabaseAdmin
    .from("hammerex_network_reviews")
    .update({
      owner_response_body: body,
      owner_response_at: now,
      owner_response_kind: "public-reply"
    })
    .eq("id", id);

  if (update.error) {
    // eslint-disable-next-line no-console
    console.error("[reviews.respond] update failed", update.error);
    return NextResponse.json(
      { ok: false, error: "db-update-failed", detail: update.error.message },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("hammerex_network_review_events").insert({
    review_id: id,
    kind: "owner_replied_public",
    actor: "owner",
    actor_slug: merchantSlug,
    note: body.slice(0, 200)
  });

  return NextResponse.json({ ok: true, respondedAt: now });
}
