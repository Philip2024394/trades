// POST /api/trade-off/reviews
// Customer-side review submission for a trade profile. Inserts with
// status='pending' so the review enters the 24h cool-down before going
// public — the customer can withdraw in that window via the email
// confirmation link (TODO: confirmation email).
//
// Server-side validates structured ratings, a 100-2000 character body,
// a valid UK postcode, and a valid email. Photo uploads reuse the
// existing /api/trade-off/lead-photos endpoint (which already handles
// listing-id scoping + bucket placement).

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UK_POSTCODE_RE = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/;
const PROJECT_TYPES = new Set(["new_build", "renovation", "repair"]);
// Mirrors the product-stats route's UUID regex — case-insensitive 8-4-4-4-12.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip")?.trim() || null;
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function rating(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  if (n < 1 || n > 5) return null;
  return n;
}

function maybeInt(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
  return Math.round(v);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const listing_id = s(body.listing_id);
  const customer_name = s(body.customer_name);
  const customer_email = s(body.customer_email);
  const customer_postcode = s(body.customer_postcode).toUpperCase().replace(/\s+/g, " ");
  const project_type = s(body.project_type);
  const project_finish = s(body.project_finish);
  const service_name = s(body.service_name);
  // A review is about ONE thing — either a service (string name) or a
  // product (uuid). The form enforces this client-side; we re-validate
  // mutual exclusion below.
  const product_id = s(body.product_id);
  const review_body = s(body.body);
  const attempted_resolution =
    typeof body.attempted_resolution === "boolean" ? body.attempted_resolution : null;

  const overall = rating(body.overall_rating);
  const workmanship = rating(body.workmanship_rating);
  const communication = rating(body.communication_rating);
  const value = rating(body.value_rating);
  const timeliness = rating(body.timeliness_rating);

  const quoted_days = maybeInt(body.timeframe_quoted_days);
  const actual_days = maybeInt(body.timeframe_actual_days);

  const photo_urls = Array.isArray(body.photo_urls)
    ? body.photo_urls.filter((u: unknown): u is string => typeof u === "string").slice(0, 6)
    : [];

  if (!listing_id) {
    return NextResponse.json({ ok: false, error: "Missing listing id." }, { status: 400 });
  }
  if (customer_name.length < 2 || customer_name.length > 80) {
    return NextResponse.json(
      { ok: false, error: "Name must be 2–80 characters." },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(customer_email) || customer_email.length > 120) {
    return NextResponse.json(
      { ok: false, error: "Please enter a valid email." },
      { status: 400 }
    );
  }
  if (customer_postcode && !UK_POSTCODE_RE.test(customer_postcode)) {
    return NextResponse.json(
      { ok: false, error: "Please enter a valid UK postcode." },
      { status: 400 }
    );
  }
  if (project_type && !PROJECT_TYPES.has(project_type)) {
    return NextResponse.json({ ok: false, error: "Invalid project type." }, { status: 400 });
  }
  if (overall === null) {
    return NextResponse.json(
      { ok: false, error: "Please choose an overall star rating." },
      { status: 400 }
    );
  }
  if (review_body.length < 100 || review_body.length > 2000) {
    return NextResponse.json(
      { ok: false, error: "Review must be 100–2000 characters." },
      { status: 400 }
    );
  }

  // Mutual exclusion: a review is about ONE thing. Reject up-front so
  // the client can't accidentally double-tag.
  if (service_name && product_id) {
    return NextResponse.json(
      { ok: false, error: "Pick one — service or product." },
      { status: 400 }
    );
  }

  // Product id must be a syntactically valid uuid (the ownership check
  // below confirms it belongs to this listing).
  if (product_id && !UUID_RE.test(product_id)) {
    return NextResponse.json(
      { ok: false, error: "Invalid product id." },
      { status: 400 }
    );
  }

  // Listing exists + accepts reviews (gated by status='live').
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, status")
    .eq("id", listing_id)
    .maybeSingle();
  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (listing.data.status !== "live") {
    return NextResponse.json(
      { ok: false, error: "This listing is not accepting reviews." },
      { status: 403 }
    );
  }

  // Product ownership check — the product must (a) exist and (b) belong
  // to the same listing the review targets. Defends against tagging a
  // review with someone else's product uuid.
  if (product_id) {
    const product = await supabaseAdmin
      .from("hammerex_xrated_products")
      .select("id, listing_id")
      .eq("id", product_id)
      .maybeSingle();
    if (!product.data || product.data.listing_id !== listing.data.id) {
      return NextResponse.json(
        { ok: false, error: "Unknown product." },
        { status: 400 }
      );
    }
  }

  const ip = clientIp(req);
  const ip_hash = ip
    ? createHash("sha256").update(ip).digest("hex").slice(0, 16)
    : null;

  const insert = await supabaseAdmin
    .from("hammerex_xrated_reviews")
    .insert({
      listing_id,
      customer_name,
      customer_email,
      customer_postcode: customer_postcode || null,
      project_type: project_type || null,
      project_finish: project_finish || null,
      service_name: service_name || null,
      product_id: product_id || null,
      timeframe_quoted_days: quoted_days,
      timeframe_actual_days: actual_days,
      attempted_resolution,
      overall_rating: overall,
      workmanship_rating: workmanship,
      communication_rating: communication,
      value_rating: value,
      timeliness_rating: timeliness,
      body: review_body,
      photo_urls,
      ip_hash
    })
    .select("id")
    .maybeSingle();

  if (insert.error || !insert.data) {
    console.error("[trade-off/reviews] insert failed:", insert.error);
    return NextResponse.json(
      { ok: false, error: "Could not submit your review — please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: insert.data.id });
}
