// POST /api/trade-off/create
// Accepts a JSON payload from the Trade Off signup wizard, inserts a new
// hammerex_trade_off_listings row, and immediately runs the auto Hammerex
// Standard match against historical quote requests.
//
// Status is auto-decided from completeness:
//   - all TRADE_OFF_REQUIRED_FIELDS set + at least 1 photo => 'live'
//   - otherwise => 'draft' (still saved, visible only via the edit link)
//
// Slug is built from display_name + city via buildListingSlug(); on a
// unique-constraint collision we retry with a short random suffix up to
// 5 times before giving up.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  TRADE_OFF_REQUIRED_FIELDS,
  TRADE_OFF_TRADES,
  buildListingSlug,
  isReservedSlug
} from "@/lib/tradeOff";
import { recomputeHammerexStandard } from "@/lib/tradeOffStandard";
import { geocodeListing } from "@/lib/tradeOffGeocode";
import { startTrialFor } from "@/lib/xratedTier";
import {
  generateVoucherCode,
  WELCOME_KNIFE_PRODUCT_SLUG
} from "@/lib/xratedVoucher";

export const runtime = "nodejs";

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function arrStr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === "string")
    .map((x) => (x as string).trim())
    .filter((x) => x.length > 0);
}

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function shortSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const payload = {
    display_name: s(body.display_name).slice(0, 120),
    trading_name: s(body.trading_name).slice(0, 160) || null,
    primary_trade: s(body.primary_trade),
    secondary_trades: arrStr(body.secondary_trades).slice(0, 3),
    city: s(body.city).slice(0, 80),
    country: s(body.country).slice(0, 80) || "United Kingdom",
    postcode_prefix: s(body.postcode_prefix).slice(0, 16) || null,
    service_postcodes: arrStr(body.service_postcodes).slice(0, 40),
    whatsapp: s(body.whatsapp).slice(0, 40),
    phone: s(body.phone).slice(0, 40) || null,
    email: s(body.email).slice(0, 160),
    website: s(body.website).slice(0, 240) || null,
    instagram: s(body.instagram).slice(0, 240) || null,
    facebook: s(body.facebook).slice(0, 240) || null,
    tiktok: s(body.tiktok).slice(0, 240) || null,
    youtube: s(body.youtube).slice(0, 240) || null,
    bio: s(body.bio).slice(0, 1200),
    years_in_trade: intOrNull(body.years_in_trade),
    start_year: intOrNull(body.start_year),
    avatar_url: s(body.avatar_url) || null,
    photos: arrStr(body.photos).slice(0, 6)
  };

  // Optional vanity slug picked by the tradie. We validate against the
  // reserved list and the existing-listings table; if blank or invalid,
  // we fall back to the auto-generated displayName+city slug below.
  const requestedSlug = s(body.slug).toLowerCase();
  if (requestedSlug && isReservedSlug(requestedSlug)) {
    return NextResponse.json(
      { ok: false, error: "That URL is reserved or invalid — pick another." },
      { status: 400 }
    );
  }

  // primary_trade must be a known slug
  if (payload.primary_trade && !TRADE_OFF_TRADES.some((t) => t.slug === payload.primary_trade)) {
    return NextResponse.json({ ok: false, error: "Unknown primary trade." }, { status: 400 });
  }

  // Completeness check determines status.
  const missing: string[] = [];
  for (const field of TRADE_OFF_REQUIRED_FIELDS) {
    const v = (payload as Record<string, unknown>)[field];
    if (typeof v !== "string" || v.trim().length === 0) missing.push(field);
  }
  if (payload.photos.length < 1) missing.push("photos");

  // Even drafts need at least a display_name + city to build a slug.
  if (!payload.display_name || !payload.city) {
    return NextResponse.json(
      { ok: false, error: "Display name and city are required to save a draft." },
      { status: 400 }
    );
  }
  // Email is required as the magic-link anchor even for drafts.
  if (!payload.email) {
    return NextResponse.json(
      { ok: false, error: "Email is required so we can give you an edit link." },
      { status: 400 }
    );
  }
  // WhatsApp is required for the same reason — it's the only contact method
  // for customers; a draft without it is unusable.
  if (!payload.whatsapp) {
    return NextResponse.json(
      { ok: false, error: "WhatsApp is required." },
      { status: 400 }
    );
  }

  const status = missing.length === 0 ? "live" : "draft";

  // Best-effort geocode — never blocks the listing on failure.
  let lat: number | null = null;
  let lng: number | null = null;
  try {
    const coords = await geocodeListing({
      postcode_prefix: payload.postcode_prefix,
      city: payload.city,
      country: payload.country
    });
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  } catch (err) {
    console.warn("[trade-off/create] geocoding failed:", err);
  }

  const baseRow = {
    ...payload,
    lat,
    lng,
    bio: payload.bio || "(draft)", // bio is NOT NULL — placeholder for drafts
    primary_trade: payload.primary_trade || "general-builder",
    status
  };

  let lastError: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    // If the tradie picked a vanity slug, try it first; on collision we
    // fall back to the auto slug + suffix for retries.
    let slug: string;
    if (requestedSlug && attempt === 0) {
      slug = requestedSlug;
    } else {
      slug = buildListingSlug(
        payload.display_name,
        payload.city,
        attempt === 0 ? undefined : shortSuffix()
      );
    }
    const insert = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .insert({ ...baseRow, slug })
      .select("id, slug, edit_token, status")
      .maybeSingle();

    if (insert.data) {
      // Auto-start the 30-day Xrated App trial. Per spec, every new tradie
      // gets the premium tier free for 30 days — after that effectiveTier()
      // demotes them to 'app_expired' on render.
      let trial: { trial_started_at: string; trial_expires_at: string } | null = null;
      try {
        trial = await startTrialFor(insert.data.id);
      } catch (err) {
        console.error("[trade-off/create] startTrialFor failed:", err);
      }
      // Fire-and-await the Hammerex Standard recompute. Failure here should
      // not block the response — log + carry on.
      try {
        await recomputeHammerexStandard(insert.data.id);
      } catch (err) {
        console.error("[trade-off/create] recomputeHammerexStandard failed:", err);
      }

      // Issue the Welcome Knife voucher when the listing goes live on
      // first submit. Best-effort — failure here MUST NOT block the
      // signup response. Retry up to 3x on the rare unique-code collision.
      let voucherCode: string | null = null;
      if (insert.data.status === "live") {
        for (let attempt = 0; attempt < 3; attempt++) {
          const code = generateVoucherCode();
          try {
            const voucherInsert = await supabaseAdmin
              .from("hammerex_xrated_vouchers")
              .insert({
                listing_id: insert.data.id,
                code,
                product_slug: WELCOME_KNIFE_PRODUCT_SLUG
              })
              .select("code")
              .maybeSingle();
            if (voucherInsert.data) {
              voucherCode = voucherInsert.data.code;
              break;
            }
            if (voucherInsert.error?.code !== "23505") {
              console.error(
                "[trade-off/create] voucher insert failed:",
                voucherInsert.error
              );
              break;
            }
            // 23505 = unique violation — retry with a fresh code.
          } catch (err) {
            console.error("[trade-off/create] voucher insert threw:", err);
            break;
          }
        }
      }

      return NextResponse.json({
        ok: true,
        slug: insert.data.slug,
        edit_token: insert.data.edit_token,
        status: insert.data.status,
        tier: trial ? "app_trial" : "standard",
        trial_started_at: trial?.trial_started_at ?? null,
        trial_expires_at: trial?.trial_expires_at ?? null,
        voucher_code: voucherCode,
        missing
      });
    }
    if (insert.error?.code === "23505") {
      lastError = "slug-collision";
      continue;
    }
    console.error("[trade-off/create] insert failed:", insert.error);
    return NextResponse.json(
      { ok: false, error: insert.error?.message ?? "Insert failed" },
      { status: 500 }
    );
  }
  return NextResponse.json(
    { ok: false, error: `Could not create listing (${lastError ?? "unknown"}).` },
    { status: 500 }
  );
}
