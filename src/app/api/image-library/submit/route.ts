// POST /api/image-library/submit
//
// Trade submits an image (usually from a live-feed post) into the
// moderation queue. Runs the auto-quality gate; clean submissions
// land as `auto_approved` and appear on Inspiration immediately,
// borderline ones land as `pending` for admin review.
//
// Auth required — the submitter_slug on the row is the caller's
// merchant identity so the credit trail is unforgeable.

import { NextResponse } from "next/server";
import { getMerchantIdentity } from "@/lib/merchantSession";
import { insertImageSubmission, runQualityGate } from "@/lib/imageSubmissions";

type Body = {
  imageUrl?: unknown;
  altText?: unknown;
  keywords?: unknown;
  tradeSlug?: unknown;
  sourcePostId?: unknown;
  sourceCanteenId?: unknown;
  submitterDisplay?: unknown;
  submitterAvatarUrl?: unknown;
};

const MAX_KEYWORDS = 12;

export async function POST(req: Request) {
  const identity = await getMerchantIdentity();
  if (!identity) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }

  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const imageUrl = typeof payload.imageUrl === "string" ? payload.imageUrl.trim() : "";
  if (!imageUrl || !/^https?:\/\//.test(imageUrl)) {
    return NextResponse.json({ ok: false, error: "invalid-image-url" }, { status: 400 });
  }
  const altText = typeof payload.altText === "string" ? payload.altText.trim() : null;
  const tradeSlug = typeof payload.tradeSlug === "string" ? payload.tradeSlug.trim() : null;
  const sourcePostId = typeof payload.sourcePostId === "string" ? payload.sourcePostId : null;
  const sourceCanteenId = typeof payload.sourceCanteenId === "string" ? payload.sourceCanteenId : null;
  const submitterDisplay = typeof payload.submitterDisplay === "string" ? payload.submitterDisplay.trim() : null;
  const submitterAvatarUrl = typeof payload.submitterAvatarUrl === "string" ? payload.submitterAvatarUrl.trim() : null;

  const rawKeywords = Array.isArray(payload.keywords) ? payload.keywords : [];
  const keywords = rawKeywords
    .filter((k): k is string => typeof k === "string")
    .map((k) => k.toLowerCase().trim())
    .filter((k) => k.length >= 2 && k.length <= 40)
    .slice(0, MAX_KEYWORDS);

  const quality = await runQualityGate({ imageUrl, altText, keywords });

  const row = await insertImageSubmission({
    submitterSlug:       identity.slug,
    submitterDisplay,
    submitterAvatarUrl,
    sourcePostId,
    sourceCanteenId,
    imageUrl,
    altText,
    tradeSlug,
    keywords,
    qualityScore:  quality.qualityScore,
    qualityFlags:  quality.qualityFlags,
    initialStatus: quality.initialStatus
  });

  if (!row) {
    return NextResponse.json({ ok: false, error: "db-insert-failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok:     true,
    status: row.status,
    id:     row.id,
    qualityScore: row.qualityScore,
    qualityFlags: row.qualityFlags
  });
}
