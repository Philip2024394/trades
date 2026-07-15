// Quote requests — server-side helpers.
//
// Powers the "I like it, how much?" form on Site Interest cards and
// (later) every WhatsApp CTA gate + Trade Center contact form. One
// shared table, one insert path, one rate-limit source of truth.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type QuoteStatus = "submitted" | "delivered" | "replied" | "closed";

export type QuoteRequest = {
  id: string;
  requesterName:      string;
  requesterEmail:     string | null;
  requesterPhone:     string | null;
  message:            string;
  attachmentUrls:     string[];
  targetTradeSlug:    string;
  targetCanteenSlug:  string | null;
  sourceImageUrl:     string | null;
  sourcePostId:       string | null;
  sourceCanteenId:    string | null;
  ipAddress:          string | null;
  status:             QuoteStatus;
  deliveredAt:        string | null;
  repliedAt:          string | null;
  closedAt:           string | null;
  closedReason:       string | null;
  consentedAt:        string | null;
  createdAt:          string;
};

/** Validation — anything the endpoint would reject at the boundary.
 *  Returns first error encountered or null when the payload is valid. */
export type QuoteFormInput = {
  requesterName?:     string;
  requesterEmail?:    string;
  requesterPhone?:    string;
  message?:           string;
  targetTradeSlug?:   string;
  targetCanteenSlug?: string | null;
  sourceImageUrl?:    string | null;
  sourcePostId?:      string | null;
  sourceCanteenId?:   string | null;
  consented?:         boolean;
};

export const QUOTE_MIN_MESSAGE_LENGTH = 60;
export const QUOTE_MAX_MESSAGE_LENGTH = 4000;
export const QUOTE_MAX_ATTACHMENTS = 3;
export const QUOTE_MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024; // 4 MB per file
export const QUOTE_RATE_LIMIT_PER_HOUR = 3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_MIN_DIGITS = 7;

export function validateQuoteInput(input: QuoteFormInput): string | null {
  const name = (input.requesterName ?? "").trim();
  if (name.length < 2) return "name-too-short";
  if (name.length > 120) return "name-too-long";

  const email = (input.requesterEmail ?? "").trim();
  const phone = (input.requesterPhone ?? "").trim();
  const hasEmail = email.length > 0;
  const hasPhone = phone.replace(/[^0-9]/g, "").length >= PHONE_MIN_DIGITS;
  if (!hasEmail && !hasPhone) return "contact-required";
  if (hasEmail && !EMAIL_RE.test(email)) return "invalid-email";

  const message = (input.message ?? "").trim();
  if (message.length < QUOTE_MIN_MESSAGE_LENGTH) return "message-too-short";
  if (message.length > QUOTE_MAX_MESSAGE_LENGTH) return "message-too-long";

  const trade = (input.targetTradeSlug ?? "").trim();
  if (!trade) return "no-target-trade";

  if (input.consented !== true) return "consent-required";

  return null;
}

/** Rate limit check — has this IP submitted more than the allowed
 *  count in the last hour? Prevents drive-by form spam without
 *  needing a captcha. */
export async function isQuoteRequestRateLimited(ip: string | null): Promise<boolean> {
  if (!ip) return false; // Cannot rate-limit unknown IPs; endpoint decision.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const res = await supabaseAdmin
    .from("hammerex_quote_requests")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", hourAgo);
  if (res.error) return false;
  return (res.count ?? 0) >= QUOTE_RATE_LIMIT_PER_HOUR;
}

/** Insert a submitted quote request. Fires + returns the shaped row. */
export async function insertQuoteRequest(params: {
  requesterName:      string;
  requesterEmail:     string | null;
  requesterPhone:     string | null;
  message:            string;
  attachmentUrls:     string[];
  targetTradeSlug:    string;
  targetCanteenSlug:  string | null;
  sourceImageUrl:     string | null;
  sourcePostId:       string | null;
  sourceCanteenId:    string | null;
  ipAddress:          string | null;
  userAgent:          string | null;
}): Promise<QuoteRequest | null> {
  const res = await supabaseAdmin
    .from("hammerex_quote_requests")
    .insert({
      requester_name:      params.requesterName,
      requester_email:     params.requesterEmail,
      requester_phone:     params.requesterPhone,
      message:             params.message,
      attachment_urls:     params.attachmentUrls,
      target_trade_slug:   params.targetTradeSlug,
      target_canteen_slug: params.targetCanteenSlug,
      source_image_url:    params.sourceImageUrl,
      source_post_id:      params.sourcePostId,
      source_canteen_id:   params.sourceCanteenId,
      ip_address:          params.ipAddress,
      user_agent:          params.userAgent,
      status:              "submitted",
      consented_at:        new Date().toISOString()
    })
    .select("*")
    .single();

  if (res.error || !res.data) {
    // eslint-disable-next-line no-console
    console.error("[quoteRequests] insert failed", res.error);
    return null;
  }
  return shapeQuoteRequest(res.data);
}

/** Upload one attachment file to the quote-attachments bucket.
 *  Returns the public URL on success, null on failure. Caller
 *  aggregates URLs and passes them to insertQuoteRequest. */
export async function uploadQuoteAttachment(params: {
  file: File;
  requesterName: string;
}): Promise<string | null> {
  if (params.file.size > QUOTE_MAX_ATTACHMENT_BYTES) return null;
  if (!params.file.type.startsWith("image/")) return null;

  const ext = params.file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "jpg";
  const nameSlug = params.requesterName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "guest";
  const path = `${nameSlug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const buffer = await params.file.arrayBuffer();
  const up = await supabaseAdmin.storage
    .from("quote-attachments")
    .upload(path, buffer, {
      contentType: params.file.type,
      upsert: false
    });
  if (up.error) {
    // eslint-disable-next-line no-console
    console.error("[quoteRequests] upload failed", up.error);
    return null;
  }
  const publicUrl = supabaseAdmin.storage
    .from("quote-attachments")
    .getPublicUrl(up.data.path).data.publicUrl;
  return publicUrl ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeQuoteRequest(r: any): QuoteRequest {
  return {
    id:                r.id,
    requesterName:     r.requester_name,
    requesterEmail:    r.requester_email ?? null,
    requesterPhone:    r.requester_phone ?? null,
    message:           r.message,
    attachmentUrls:    (r.attachment_urls ?? []) as string[],
    targetTradeSlug:   r.target_trade_slug,
    targetCanteenSlug: r.target_canteen_slug ?? null,
    sourceImageUrl:    r.source_image_url ?? null,
    sourcePostId:      r.source_post_id ?? null,
    sourceCanteenId:   r.source_canteen_id ?? null,
    ipAddress:         r.ip_address ?? null,
    status:            r.status,
    deliveredAt:       r.delivered_at ?? null,
    repliedAt:         r.replied_at ?? null,
    closedAt:          r.closed_at ?? null,
    closedReason:      r.closed_reason ?? null,
    consentedAt:       r.consented_at ?? null,
    createdAt:         r.created_at
  };
}
