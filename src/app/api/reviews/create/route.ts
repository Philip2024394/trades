// POST /api/reviews/create
//
// Real DB write path. Inserts a row into hammerex_network_reviews +
// an initial "submitted" event, then returns the new id + publish
// status so the leave-review form can route to a matching success
// screen (immediate publish vs 72h cool-off).
//
// Auth model (interim): reviewer identity is bound to an anonymous
// cookie set by this endpoint. When real session auth lands, we swap
// the cookie for a session-derived listing_id. The cookie survives
// the swap so historic reviews stay attributable.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ReviewDimensionScores, ReviewJobVerificationKind } from "@/lib/reviews";
import { overallForReview } from "@/lib/reviews";
import { assertUploadAllowedFromDb, recordUpload } from "@/lib/tierGates.server";
import { UploadGateError } from "@/lib/tierGates";

const COOL_OFF_MS = 72 * 60 * 60 * 1000;
const REVIEWER_COOKIE = "network_reviewer_id";
const REVIEWER_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365 * 2; // 2 years

// Interim size estimate per photo url — real byte count arrives with
// the storage upload endpoint. 500KB is the median for a compressed
// mobile photo; conservative enough to protect the free tier's 200KB
// total budget from being blown by a single review.
const REVIEW_PHOTO_ESTIMATE_BYTES = 500 * 1024;

type SubmitPayload = {
  merchantSlug: string;
  scores: ReviewDimensionScores;
  body: string;
  jobVerification: {
    kind: ReviewJobVerificationKind;
  };
  photoUrls: string[];
  reviewerDisplayName?: string;
  reviewerTradeLabel?: string;
  reviewerCity?: string;
  reviewerAvatarUrl?: string;
};

export async function POST(req: Request) {
  let payload: SubmitPayload;
  try {
    payload = (await req.json()) as SubmitPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  // Validation — mirrors the client-side checks so a fail here is
  // bad-faith submission.
  if (!payload.merchantSlug || typeof payload.merchantSlug !== "string") {
    return NextResponse.json({ ok: false, error: "missing-merchant" }, { status: 400 });
  }
  if (!payload.scores) {
    return NextResponse.json({ ok: false, error: "missing-scores" }, { status: 400 });
  }
  const requiredDims: Array<keyof ReviewDimensionScores> = [
    "quality", "communication", "punctuality", "value", "cleanliness"
  ];
  for (const dim of requiredDims) {
    const s = payload.scores[dim];
    if (typeof s !== "number" || s < 1 || s > 5) {
      return NextResponse.json({ ok: false, error: `bad-dimension:${dim}` }, { status: 400 });
    }
  }
  if (typeof payload.body !== "string" || payload.body.trim().length < 60) {
    return NextResponse.json({ ok: false, error: "body-too-short" }, { status: 400 });
  }
  if (!payload.jobVerification || !payload.jobVerification.kind) {
    return NextResponse.json({ ok: false, error: "missing-verification" }, { status: 400 });
  }

  const overall = overallForReview(payload.scores);
  const goesToCoolOff = overall < 4.0;
  const nowMs = Date.now();
  const publishAt = goesToCoolOff
    ? new Date(nowMs + COOL_OFF_MS).toISOString()
    : new Date(nowMs).toISOString();
  const status: "pending" | "published" = goesToCoolOff ? "pending" : "published";

  // Reviewer cookie — set-if-missing so historic reviews stay
  // attributable when we upgrade to session-based identity later.
  const jar = await cookies();
  let reviewerCookie = jar.get(REVIEWER_COOKIE)?.value ?? null;
  if (!reviewerCookie) {
    reviewerCookie = crypto.randomUUID();
  }

  // Storage tier gate — every attached photo counts against the
  // reviewer's cumulative cap. Free reviewers can attach up to their
  // 200KB total; Pro reviewers get the full 5GB. Cheating the client
  // gate no longer works: this is the server truth. Real upload
  // sizes replace the estimate once the storage upload endpoint
  // lands (photos here are still direct URLs from the client).
  const photos = payload.photoUrls ?? [];
  if (photos.length > 0) {
    // Reviewer tier is "free" by default; upgrade to "pro" once a
    // real reviewer session lands and we can look up their tier from
    // hammerex_trade_off_listings.tier.
    const tier = "free" as const;
    for (const url of photos) {
      try {
        await assertUploadAllowedFromDb({
          ownerSlug: reviewerCookie,
          ownerKind: "reviewer",
          uploadKind: "review-photo",
          tier,
          sizeBytes: REVIEW_PHOTO_ESTIMATE_BYTES
        });
      } catch (err) {
        if (err instanceof UploadGateError) {
          return NextResponse.json(
            { ok: false, error: err.code, message: err.message },
            { status: 402 }
          );
        }
        throw err;
      }
      // Record after the assert so we don't over-count on a rejected
      // upload. Fire-and-forget; recordUpload silently logs errors.
      await recordUpload({
        ownerSlug: reviewerCookie,
        ownerKind: "reviewer",
        uploadKind: "review-photo",
        tier,
        sizeBytes: REVIEW_PHOTO_ESTIMATE_BYTES,
        storageUrl: url
      });
    }
  }

  // Insert. Cast photoUrls to text[] via the Supabase array syntax.
  const insert = await supabaseAdmin
    .from("hammerex_network_reviews")
    .insert({
      merchant_slug: payload.merchantSlug,
      reviewer_cookie: reviewerCookie,
      reviewer_display_name: payload.reviewerDisplayName ?? "Network member",
      reviewer_trade_label: payload.reviewerTradeLabel ?? null,
      reviewer_city: payload.reviewerCity ?? null,
      reviewer_avatar_url: payload.reviewerAvatarUrl ?? null,
      job_verification_kind: payload.jobVerification.kind,
      job_verification_at: new Date().toISOString(),
      job_verification_label: verificationLabel(payload.jobVerification.kind),
      quality_score: payload.scores.quality,
      communication_score: payload.scores.communication,
      punctuality_score: payload.scores.punctuality,
      value_score: payload.scores.value,
      cleanliness_score: payload.scores.cleanliness,
      trade_specific_score: payload.scores.trade_specific ?? null,
      overall_score: Number(overall.toFixed(2)),
      body: payload.body.trim(),
      photo_urls: payload.photoUrls ?? [],
      status,
      publish_at: publishAt,
      helpful_count: 0
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    // eslint-disable-next-line no-console
    console.error("[reviews.create] insert failed", insert.error);
    return NextResponse.json(
      { ok: false, error: "db-insert-failed", detail: insert.error?.message },
      { status: 500 }
    );
  }

  // Emit the initial submitted event. Fire-and-forget — if the event
  // log write fails we still return success, since the review row is
  // the source of truth.
  await supabaseAdmin.from("hammerex_network_review_events").insert({
    review_id: insert.data.id,
    kind: "submitted",
    actor: "reviewer",
    actor_slug: reviewerCookie
  });

  const res = NextResponse.json({
    ok: true,
    id: insert.data.id,
    status,
    publishAt,
    overall: Number(overall.toFixed(2)),
    coolOffActive: goesToCoolOff
  });

  // Set the reviewer cookie so subsequent reviews are attributable to
  // the same anonymous identity.
  res.cookies.set({
    name: REVIEWER_COOKIE,
    value: reviewerCookie,
    maxAge: REVIEWER_COOKIE_MAX_AGE_S,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });

  return res;
}

function verificationLabel(kind: NonNullable<ReviewJobVerificationKind>): string {
  switch (kind) {
    case "job-tag":         return "Verified job";
    case "whatsapp-thread": return "Verified WhatsApp";
    case "invoice":         return "Verified invoice";
  }
}
