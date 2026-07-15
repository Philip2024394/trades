// POST /api/quote-requests
//
// Public homeowner-facing endpoint. Accepts multipart/form-data with
// the QuickContactForm fields (name, email/phone, message, target
// trade, source image) plus up to QUOTE_MAX_ATTACHMENTS photos of
// the site/area/project.
//
// Guard rails:
//   • Form fields are the seriousness filter — name + email/phone +
//     description ≥60 chars. See
//     feedback_form_gate_not_washer_for_contact.md.
//   • Rate limit: QUOTE_RATE_LIMIT_PER_HOUR requests per IP per
//     hour, checked before the row hits the table.
//   • Lead goes to target_trade_slug ONLY — the credit-chip trade
//     (or nearest-1 when the source image is curated with no
//     submitter). Never broadcast to 3-nearest (ADR-0003).
//   • Attachments upload through /lib/quoteRequests uploadQuoteAttachment
//     which streams to the quote-attachments Supabase Storage bucket
//     with size + MIME caps.

import { NextResponse } from "next/server";
import {
  insertQuoteRequest,
  isQuoteRequestRateLimited,
  QUOTE_MAX_ATTACHMENTS,
  uploadQuoteAttachment,
  validateQuoteInput
} from "@/lib/quoteRequests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: Request): string | null {
  // Vercel + most reverse-proxied deployments surface the real IP
  // in one of these headers. Fall back to null when nothing is set
  // (localhost dev requests without a proxy).
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return null;
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json(
      { ok: false, error: "invalid-content-type" },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-multipart" },
      { status: 400 }
    );
  }

  // Extract fields (all string-typed on FormData)
  const requesterName    = String(formData.get("requesterName") ?? "").trim();
  const requesterEmail   = String(formData.get("requesterEmail") ?? "").trim() || null;
  const requesterPhone   = String(formData.get("requesterPhone") ?? "").trim() || null;
  const message          = String(formData.get("message") ?? "").trim();
  const targetTradeSlug  = String(formData.get("targetTradeSlug") ?? "").trim();
  const targetCanteenSlug= String(formData.get("targetCanteenSlug") ?? "").trim() || null;
  const sourceImageUrl   = String(formData.get("sourceImageUrl") ?? "").trim() || null;
  const sourcePostId     = String(formData.get("sourcePostId") ?? "").trim() || null;
  const sourceCanteenId  = String(formData.get("sourceCanteenId") ?? "").trim() || null;
  const consented        = formData.get("consented") === "true";

  const validationError = validateQuoteInput({
    requesterName,
    requesterEmail:    requesterEmail ?? undefined,
    requesterPhone:    requesterPhone ?? undefined,
    message,
    targetTradeSlug,
    targetCanteenSlug,
    sourceImageUrl,
    sourcePostId,
    sourceCanteenId,
    consented
  });
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  }

  const ip = clientIp(req);
  if (await isQuoteRequestRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "rate-limited", message: "Too many requests from your IP in the last hour. Try again later." },
      { status: 429 }
    );
  }

  // Attachments — files under key `attachments[]` OR `attachments`.
  // Cap at QUOTE_MAX_ATTACHMENTS and upload each; failed uploads are
  // silently dropped so a bad file doesn't fail the whole submission.
  const rawFiles = formData.getAll("attachments").filter((f): f is File => f instanceof File);
  const filesToUpload = rawFiles.slice(0, QUOTE_MAX_ATTACHMENTS);
  const attachmentUrls: string[] = [];
  for (const file of filesToUpload) {
    if (file.size === 0) continue;
    const url = await uploadQuoteAttachment({ file, requesterName });
    if (url) attachmentUrls.push(url);
  }

  const userAgent = req.headers.get("user-agent");

  const row = await insertQuoteRequest({
    requesterName,
    requesterEmail,
    requesterPhone,
    message,
    attachmentUrls,
    targetTradeSlug,
    targetCanteenSlug,
    sourceImageUrl,
    sourcePostId,
    sourceCanteenId,
    ipAddress: ip,
    userAgent
  });

  if (!row) {
    return NextResponse.json({ ok: false, error: "db-insert-failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: row.id,
    attachmentCount: row.attachmentUrls.length
  });
}
