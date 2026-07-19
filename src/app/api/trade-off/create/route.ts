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
import bcrypt from "bcryptjs";
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
import { setTradeSessionCookie } from "@/lib/tradeSession";

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

  // Raw password — NEVER persisted in plaintext, NEVER logged. We hash
  // with bcryptjs (cost 10) below before the insert. Minimum 6 chars,
  // no complexity rules (tradespeople aren't security engineers).
  const rawPassword = typeof body.password === "string" ? body.password : "";
  if (!rawPassword || rawPassword.length < 6) {
    return NextResponse.json(
      { ok: false, error: "Password is required (minimum 6 characters)." },
      { status: 400 }
    );
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

  // Hash the password BEFORE any insert attempt so a retry loop doesn't
  // re-hash on every slug-collision retry. bcryptjs is synchronous-safe
  // for cost 10 in Node.js (≈80ms).
  const passwordHash = await bcrypt.hash(rawPassword, 10);

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
    status,
    password_hash: passwordHash
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
    // Affiliate-referrer stamp. Read the cookie set by middleware,
    // verify the affiliate exists + is active, and stamp the
    // sequential ID onto the new listing. Best-effort — bad cookies
    // don't block signup.
    let affiliateReferrerId: number | null = null;
    try {
      const ref = req.cookies.get("xrated_affiliate_ref")?.value;
      const refNum = ref ? Number(ref) : NaN;
      if (Number.isFinite(refNum) && refNum > 0) {
        const aff = await supabaseAdmin
          .from("hammerex_affiliates")
          .select("affiliate_id, status, email")
          .eq("affiliate_id", refNum)
          .maybeSingle();
        if (aff.data && aff.data.status === "active") {
          affiliateReferrerId = aff.data.affiliate_id;
        }
      }
    } catch (err) {
      console.warn("[trade-off/create] affiliate cookie read failed:", err);
    }

    const insert = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .insert({
        ...baseRow,
        slug,
        affiliate_referrer_id: affiliateReferrerId
      })
      .select("id, slug, edit_token, status, display_name")
      .maybeSingle();

    if (insert.data) {
      // Audit + notification on the affiliate side.
      if (affiliateReferrerId) {
        try {
          await supabaseAdmin
            .from("hammerex_affiliate_audit_log")
            .insert({
              actor_type: "system",
              actor_id: "trade-off.create",
              action: "referral.stamp",
              target_id: insert.data.id,
              details: {
                affiliate_id: affiliateReferrerId,
                slug: insert.data.slug
              }
            });
          const aff = await supabaseAdmin
            .from("hammerex_affiliates")
            .select("affiliate_id, email")
            .eq("affiliate_id", affiliateReferrerId)
            .maybeSingle();
          if (aff.data?.email) {
            const { sendNewReferralEmail } = await import("@/lib/affiliateEmails");
            await sendNewReferralEmail(
              { affiliate_id: aff.data.affiliate_id, email: aff.data.email },
              {
                slug: insert.data.slug,
                display_name: insert.data.display_name ?? null
              }
            );
          }
        } catch (err) {
          console.error("[trade-off/create] referral notify failed:", err);
        }
      }

      // Merchant-to-merchant referral attribution. Reads the `tn_mref`
      // cookie set by middleware, verifies the slug matches a live
      // listing, stamps merchant_referrer_slug on this row, queues a
      // signup reward for both sides, and emails the referrer. Never
      // blocks signup on error.
      try {
        const mrefRaw = req.cookies.get("tn_mref")?.value ?? null;
        const mref = mrefRaw && /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(mrefRaw) ? mrefRaw : null;
        if (mref && mref !== insert.data.slug) {
          const { attributeSignup } = await import("@/lib/merchantReferrals");
          const attribution = await attributeSignup({ newSlug: insert.data.slug, mrefSlug: mref });
          if (attribution.attributed) {
            const { sendReferralJoinedEmail } = await import("@/lib/merchantReferralEmails");
            await sendReferralJoinedEmail({
              referrerSlug: mref,
              referredSlug: insert.data.slug,
              referredName: insert.data.display_name ?? null
            });
          }
        }
      } catch (err) {
        console.error("[trade-off/create] merchant referral attribution failed:", err);
      }

      // Tier-3 beacon auto-forward. When the mref cookie starts with
      // `beacon-<baitLinkSlug>`, the new merchant arrived via an admin
      // acquisition bait link posted from /admin/beacon-residuals. If
      // the underlying beacon enquiry is still fresh (<48h), auto-
      // route the customer contact into this new merchant's inbox as
      // their first lead + fire the standard notification email +
      // mark the admin residual as `converted`. Closes the Tier-3
      // acquisition loop. Never blocks signup on error.
      try {
        const mrefRaw = req.cookies.get("tn_mref")?.value ?? "";
        const baitMatch = mrefRaw.match(/^beacon-([a-z0-9]{6,32})$/i);
        if (baitMatch) {
          const baitSlug = baitMatch[1];
          const residual = await supabaseAdmin
            .from("hammerex_beacon_admin_residuals")
            .select(`
              id, beacon_id, outreach_status,
              beacon:hammerex_xrated_project_beacons!inner (
                customer_name, customer_city, trade_slug, project_description, sent_at, claim_sla_hours
              )
            `)
            .eq("bait_link_slug", baitSlug)
            .maybeSingle();
          const b = residual.data as {
            id: string; beacon_id: string; outreach_status: string;
            beacon: { customer_name: string; customer_city: string | null; trade_slug: string; project_description: string; sent_at: string; claim_sla_hours: number };
          } | null;
          if (b && b.beacon) {
            const ageHours = (Date.now() - new Date(b.beacon.sent_at).getTime()) / 3600000;
            if (ageHours < 48) {
              const slaHours = b.beacon.claim_sla_hours ?? 2;
              const slaExpires = new Date(Date.now() + slaHours * 3600 * 1000);
              // Insert a fresh claim for the new merchant. wave_number
              // 99 = post-escalation admin-forward marker (distinct from
              // the natural fanout waves 1..4).
              await supabaseAdmin.from("hammerex_beacon_claims").insert({
                beacon_id:           b.beacon_id,
                merchant_slug:       insert.data.slug,
                merchant_listing_id: insert.data.id,
                assigned_at:         new Date().toISOString(),
                sla_expires_at:      slaExpires.toISOString(),
                status:              "assigned",
                readiness_tier:      1, // new signup gets full readiness assumption
                wave_number:         99
              });
              // Mark the admin residual as converted + attribute
              await supabaseAdmin
                .from("hammerex_beacon_admin_residuals")
                .update({
                  outreach_status: "converted",
                  outreach_at:     new Date().toISOString(),
                  outreach_notes:  `Auto-forwarded to new merchant ${insert.data.slug} (${Math.round(ageHours)}h old at signup)`
                })
                .eq("id", b.id);
              // Fire notification so the new merchant sees the lead
              const { notifyBeaconAssigned } = await import("@/lib/beaconNotify");
              await notifyBeaconAssigned({
                merchantId:    insert.data.id,
                merchantSlug:  insert.data.slug,
                readinessTier: 1,
                beaconId:      b.beacon_id,
                customerName:  b.beacon.customer_name,
                customerCity:  b.beacon.customer_city,
                tradeSlug:     b.beacon.trade_slug,
                description:   b.beacon.project_description,
                slaHours
              }).catch((err) => console.error("[trade-off/create] beacon auto-forward notify failed:", err));
              console.log(`[trade-off/create] Tier-3 beacon auto-forwarded: bait=${baitSlug} → merchant=${insert.data.slug}`);
            }
          }
        }
      } catch (err) {
        console.error("[trade-off/create] beacon auto-forward failed:", err);
      }

      // Auto-start the Xrated App trial — length comes from
      // `XRATED_PRICING.trialDays` (currently 14 days). Every new tradie
      // gets the premium tier free for the trial window — after that
      // effectiveTier() demotes them to 'app_expired' on render.
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

      const response = NextResponse.json({
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
      // Auto-log the new tradesperson in so they don't have to type
      // their password again right after signup.
      setTradeSessionCookie(response, insert.data.id, insert.data.slug);
      return response;
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
