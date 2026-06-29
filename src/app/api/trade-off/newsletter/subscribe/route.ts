// POST /api/trade-off/newsletter/subscribe
// Public endpoint — the merchant-grade profile footer signup form.
// Body: { slug, email, consent_text }.
//
// UK GDPR + PECR notes:
//   - consent_text is required + non-empty; persisted verbatim as
//     the audit-trail string the subscriber actually agreed to.
//   - ip_hash is sha256(ip)[0..16] with a daily salt rotation so the
//     hash isn't a stable identifier across sessions. Stored for abuse
//     mitigation only — never reused for identification.
//   - Re-subscribe after unsubscribe → ON CONFLICT (listing_id, email)
//     DO UPDATE SET status='active' so the merchant's list quota
//     stays accurate (one row per email per listing, forever).
//
// Rate limit: 5 subscribe POSTs per IP per hour. In-memory Map of
// ip_hash → timestamps[]. Memory-only is acceptable here — at worst
// a determined attacker could rotate IPs, which is a higher bar than
// "hammer the endpoint from one machine".

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isMerchantGradeTrade } from "@/lib/tradeOff";
import { isNewsletterOn } from "@/lib/xratedAddons";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONSENT_MIN = 8;
const CONSENT_MAX = 600;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_MAX = 5; // subscribes per IP per hour
const RATE_BUCKET = new Map<string, number[]>();

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const first = xff.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "0.0.0.0";
}

function hashIp(ip: string): string {
  // Date-salt rotation — the hash is a stable identifier inside a
  // single UTC day, but rotates at midnight so we can't accidentally
  // build a long-term profile of an unauthenticated visitor.
  const today = new Date().toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`xrated-newsletter::${today}::${ip}`)
    .digest("hex")
    .slice(0, 16);
}

function shouldRateLimit(key: string): boolean {
  const now = Date.now();
  const arr = RATE_BUCKET.get(key) ?? [];
  // Drop entries outside the window.
  const recent = arr.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    RATE_BUCKET.set(key, recent);
    return true;
  }
  recent.push(now);
  RATE_BUCKET.set(key, recent);
  // Crude housekeeping — every ~200 keys, sweep stale entries.
  if (RATE_BUCKET.size > 200 && Math.random() < 0.05) {
    for (const [k, ts] of RATE_BUCKET) {
      const live = ts.filter((t) => now - t < RATE_WINDOW_MS);
      if (live.length === 0) RATE_BUCKET.delete(k);
      else RATE_BUCKET.set(k, live);
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400 }
    );
  }

  const slug = s(body.slug);
  const email = s(body.email).toLowerCase();
  const consent_text = s(body.consent_text);

  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "Missing listing." },
      { status: 400 }
    );
  }
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json(
      { ok: false, error: "Please enter a valid email." },
      { status: 400 }
    );
  }
  // Consent must be explicit + present. We don't enforce a specific
  // wording (the merchant might tweak phrasing later) but it MUST exist
  // and look like something a user actually opted into.
  if (
    consent_text.length < CONSENT_MIN ||
    consent_text.length > CONSENT_MAX
  ) {
    return NextResponse.json(
      { ok: false, error: "Tick the consent box to subscribe." },
      { status: 400 }
    );
  }

  const ipHash = hashIp(clientIp(req));
  if (shouldRateLimit(ipHash)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Too many signups from this network. Try again in an hour."
      },
      { status: 429 }
    );
  }

  // Resolve listing + enforce merchant-grade + newsletter-on gates so
  // a stale URL or an off-toggle profile can't be subscribed to.
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, status, primary_trade, addons_enabled")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing.data) {
    return NextResponse.json(
      { ok: false, error: "Listing not found." },
      { status: 404 }
    );
  }
  if (listing.data.status !== "live") {
    return NextResponse.json(
      { ok: false, error: "This profile is not accepting subscribers." },
      { status: 403 }
    );
  }
  if (!isMerchantGradeTrade(listing.data.primary_trade ?? null)) {
    return NextResponse.json(
      { ok: false, error: "Newsletter signup is not enabled here." },
      { status: 403 }
    );
  }
  const addonsMap =
    listing.data.addons_enabled && typeof listing.data.addons_enabled === "object"
      ? (listing.data.addons_enabled as Record<string, boolean>)
      : {};
  if (!isNewsletterOn({ addons_enabled: addonsMap })) {
    return NextResponse.json(
      { ok: false, error: "Newsletter signup is not enabled here." },
      { status: 403 }
    );
  }

  // Upsert by (listing_id, email). Re-subscribing after an unsubscribe
  // flips the existing row back to 'active' with a fresh consent_at +
  // consent_text. We never insert a duplicate row.
  const upsert = await supabaseAdmin
    .from("hammerex_xrated_newsletter_subscribers")
    .upsert(
      {
        listing_id: listing.data.id,
        email,
        consent_at: new Date().toISOString(),
        consent_text,
        ip_hash: ipHash,
        status: "active",
        unsubscribed_at: null
      },
      { onConflict: "listing_id,email" }
    )
    .select("id")
    .maybeSingle();

  if (upsert.error || !upsert.data) {
    console.error("[newsletter/subscribe] upsert failed:", upsert.error);
    return NextResponse.json(
      { ok: false, error: "Could not subscribe — try again later." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
