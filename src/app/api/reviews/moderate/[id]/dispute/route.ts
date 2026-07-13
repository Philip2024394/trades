// POST /api/reviews/moderate/[id]/dispute
//
// Merchant disputes a review. The row's status flips to 'frozen' so
// it doesn't publish at the 72h mark — admin has to review the
// evidence and decide. Emits owner_disputed event with the merchant's
// rebuttal + evidence urls.
//
// Auth: signed trade session, must own the review's merchant.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

const MAX_REBUTTAL = 2000;
const MIN_REBUTTAL = 30;
const MAX_EVIDENCE_URLS = 10;

type DisputePayload = {
  rebuttal: string;
  evidenceUrls?: string[];
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });
  }

  let payload: DisputePayload;
  try {
    payload = (await req.json()) as DisputePayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const rebuttal = String(payload.rebuttal ?? "").trim();
  if (rebuttal.length < MIN_REBUTTAL) {
    return NextResponse.json({ ok: false, error: "rebuttal-too-short" }, { status: 400 });
  }
  if (rebuttal.length > MAX_REBUTTAL) {
    return NextResponse.json({ ok: false, error: "rebuttal-too-long" }, { status: 400 });
  }
  const evidenceUrls = Array.isArray(payload.evidenceUrls) ? payload.evidenceUrls.slice(0, MAX_EVIDENCE_URLS) : [];

  const review = await supabaseAdmin
    .from("hammerex_network_reviews")
    .select("id, merchant_slug, status")
    .eq("id", id)
    .maybeSingle();

  if (review.error) {
    return NextResponse.json({ ok: false, error: "db-lookup-failed" }, { status: 500 });
  }
  if (!review.data) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  if (review.data.merchant_slug !== merchantSlug) {
    return NextResponse.json({ ok: false, error: "not-owner" }, { status: 403 });
  }
  if (review.data.status !== "pending") {
    return NextResponse.json({ ok: false, error: `review-${review.data.status}` }, { status: 409 });
  }

  // Freeze the row + emit event with rebuttal + evidence in meta.
  const nowIso = new Date().toISOString();
  const update = await supabaseAdmin
    .from("hammerex_network_reviews")
    .update({
      status: "frozen",
      admin_action: "frozen",
      admin_action_reason: `Merchant dispute: ${rebuttal.slice(0, 100)}`,
      admin_action_at: nowIso,
      admin_action_by: "merchant-dispute"
    })
    .eq("id", id);

  if (update.error) {
    return NextResponse.json(
      { ok: false, error: "db-update-failed", detail: update.error.message },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("hammerex_network_review_events").insert({
    review_id: id,
    kind: "owner_disputed",
    actor: "owner",
    actor_slug: merchantSlug,
    note: rebuttal,
    meta: { evidenceUrls }
  });

  return NextResponse.json({ ok: true, status: "frozen" });
}
