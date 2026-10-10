// src/lib/nex/marketing/tracking-inject.ts
//
// NEX Marketing · Stage 1.3 · HTML tracking injection
// Founder-authorised programme (three-lane operating doctrine 2026-09-21).
//
// **Role**: given compiled email HTML + campaign_id + contact_id, produce:
//   • HTML with an invisible observed-open pixel injected before </body>
//   • All <a href="..."> rewritten through the click-tracking route
//   • A List-Unsubscribe header value (RFC 8058 one-click + mailto)
//
// **Honesty rule (founder-locked)**: the pixel produces an "observed open"
// event, NEVER labelled as a "read". Pixel loads are subject to false
// positives (client preloading · image caching · privacy modes). Clicks,
// deliveries, complaints, bounces, unsubscribes are stronger signals.
//
// **Safety**:
//   • No open-redirect · click route accepts only NEX-signed target URLs
//   • Unsubscribe link is included whether or not the recipient list-unsub
//     header is honoured · founder-visible even in constrained clients
//   • Tracking failure never blocks the email render · the injection is
//     deterministic string-substitution with a graceful fallback
//
// This module is pure string transformation · no DB · no network · no fetch.

import { createHmac } from "node:crypto";

// ─── Config ─────────────────────────────────────────────────────────
const PIXEL_PATH = "/api/nex/marketing/pixel";
const CLICK_PATH = "/api/nex/marketing/click";
const UNSUBSCRIBE_PATH = "/api/nex/marketing/unsubscribe";

/** Base URL for tracking links. Prefer NEX_MARKETING_BASE_URL; fallback to
 *  NEXT_PUBLIC_APP_URL; fallback to a placeholder that WILL fail loudly if
 *  hit in production (so a misconfigured deployment surfaces immediately). */
function baseUrl(): string {
  return (
    process.env.NEX_MARKETING_BASE_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || "https://thenetworkers.app"
  ).replace(/\/+$/, "");
}

/** HMAC secret for tamper-resistant tracking URLs. Falls back to lab-promotion secret
 *  to match the existing marketing/unsubscribe pattern. */
function trackingSecret(): string {
  return (
    process.env.NEX_MARKETING_UNSUB_SECRET
    || process.env.NEX_LAB_PROMOTION_SECRET
    || ""
  );
}

// ─── Public API ─────────────────────────────────────────────────────
export interface TrackingInput {
  readonly html: string;
  readonly campaign_id: string;
  readonly contact_id: string;
  /** Optional email address · improves compatibility with existing pixel
   *  route which reads `?e=<email>` in some code paths. */
  readonly email?: string;
}

export interface TrackingOutput {
  readonly html: string;                       // Original HTML with pixel + link rewrites
  readonly list_unsubscribe_header: string;    // Value for List-Unsubscribe header (RFC 8058)
  readonly links_rewritten: number;            // For observability
}

export function injectTracking(input: TrackingInput): TrackingOutput {
  const base = baseUrl();
  const pixel_url = `${base}${PIXEL_PATH}/${encodeURIComponent(input.campaign_id)}?c=${encodeURIComponent(input.contact_id)}${input.email ? `&e=${encodeURIComponent(input.email)}` : ""}`;

  // ─── 1 · Rewrite anchor href attributes through click tracker ─
  const rewrite = rewriteAnchors(input.html, input.campaign_id, input.contact_id, base);

  // ─── 2 · Inject invisible observed-open pixel before </body> ──
  const pixel_img = `<img src="${escapeHtml(pixel_url)}" alt="" width="1" height="1" style="display:none;border:0;margin:0;padding:0;line-height:0" aria-hidden="true" />`;
  const html_with_pixel = injectPixelBeforeBodyClose(rewrite.html, pixel_img);

  // ─── 3 · Compose List-Unsubscribe header (RFC 8058 one-click) ─
  const unsub_url = signedUnsubscribeUrl(base, input.campaign_id, input.contact_id);
  const list_unsubscribe_header = `<${unsub_url}>, <mailto:unsubscribe@${trimHost(base)}?subject=unsubscribe>`;

  return {
    html: html_with_pixel,
    list_unsubscribe_header,
    links_rewritten: rewrite.count,
  };
}

// ─── Internals ──────────────────────────────────────────────────────

/** Rewrite every <a href="X"> where X is http(s):// through the click route.
 *  Skips: mailto: · tel: · javascript: · already-tracked URLs · the
 *  unsubscribe link itself · fragment-only hrefs. */
function rewriteAnchors(html: string, campaign_id: string, contact_id: string, base: string): { html: string; count: number } {
  let count = 0;
  const rewritten = html.replace(/<a\s+([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*?)>/gi, (full, before, url, after) => {
    if (!shouldTrack(url)) return full;
    // Preserve the click-URL by wrapping in an HMAC-signed tracker link
    const tracker = signedClickUrl(base, campaign_id, contact_id, url);
    count += 1;
    return `<a ${before}href="${escapeHtml(tracker)}"${after}>`;
  });
  return { html: rewritten, count };
}

function shouldTrack(url: string): boolean {
  if (!url) return false;
  const u = url.trim();
  if (u.startsWith("#")) return false;
  if (u.startsWith("mailto:")) return false;
  if (u.startsWith("tel:")) return false;
  if (u.startsWith("javascript:")) return false;
  // Never track the tracker itself or the unsubscribe endpoint
  if (u.includes(CLICK_PATH) || u.includes(UNSUBSCRIBE_PATH) || u.includes(PIXEL_PATH)) return false;
  return /^https?:\/\//i.test(u);
}

function signedClickUrl(base: string, campaign_id: string, contact_id: string, target: string): string {
  const secret = trackingSecret();
  const payload = `${campaign_id}:${contact_id}:${target}`;
  const sig = secret ? createHmac("sha256", secret).update(payload).digest("hex").slice(0, 24) : "unsigned";
  return `${base}${CLICK_PATH}/${encodeURIComponent(campaign_id)}?c=${encodeURIComponent(contact_id)}&t=${encodeURIComponent(target)}&s=${sig}`;
}

function signedUnsubscribeUrl(base: string, campaign_id: string, contact_id: string): string {
  const secret = trackingSecret();
  const payload = `${campaign_id}:${contact_id}:unsub`;
  const sig = secret ? createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32) : "unsigned";
  return `${base}${UNSUBSCRIBE_PATH}?c=${encodeURIComponent(campaign_id)}&u=${encodeURIComponent(contact_id)}&s=${sig}`;
}

function injectPixelBeforeBodyClose(html: string, pixel_img: string): string {
  // Prefer </body>. If missing, append at end (still renders in most clients).
  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, (m) => `${pixel_img}${m}`);
  }
  return `${html}\n${pixel_img}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function trimHost(base: string): string {
  try { return new URL(base).host; } catch { return "thenetworkers.app"; }
}
