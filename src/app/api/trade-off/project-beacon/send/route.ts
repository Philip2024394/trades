// POST /api/trade-off/project-beacon/send
//
// Customer-side endpoint behind the /find page's Project Beacon toggle.
// Body: { name, whatsapp, city, postcode (optional), trade_slug,
// project_description, country (optional, default 'UK') }.
//
// We pick the 3 nearest paid+verified live members in the requested
// trade + country, fire a Lead Alerts push to each of their devices,
// log an audit row, and return a confirmation. We DO NOT store the
// customer's WhatsApp past the push payload — it's transient routing.
// The trade WhatsApps the customer direct; Xrated is never in the
// money flow or the conversation.
//
// Anti-spam: hash the caller IP and rate-limit to 3 beacons per 10
// minutes per IP.

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TRADE_OFF_TRADES, tradeLabel } from "@/lib/tradeOff";
import { sendLeadAlert } from "@/lib/leadAlerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TRADE_SLUGS = new Set(TRADE_OFF_TRADES.map((t) => t.slug));
const COUNTRY_CODE_TO_LABEL: Record<string, string> = {
  GB: "UK",
  UK: "UK",
  IE: "Ireland",
  US: "United States",
  AU: "Australia",
  NZ: "New Zealand",
  CA: "Canada"
};

function s(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256")
    .update(`xrated-beacon::${ip}`)
    .digest("hex")
    .slice(0, 32);
}

function readIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

const TEN_MIN_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const customer_name = s(payload.name, 80);
  const customer_whatsapp = s(payload.whatsapp, 32).replace(/\s+/g, "");
  const customer_city = s(payload.city, 80);
  const postcode = s(payload.postcode, 16).toUpperCase();
  const trade_slug = s(payload.trade_slug, 60);
  const project_description = s(payload.project_description, 240);
  const countryCode = s(payload.country, 4).toUpperCase() || "GB";

  if (!customer_name) {
    return NextResponse.json(
      { ok: false, error: "Your name is required" },
      { status: 400 }
    );
  }
  if (!/^\+?\d[\d\s-]{6,20}$/.test(customer_whatsapp)) {
    return NextResponse.json(
      { ok: false, error: "WhatsApp number doesn't look right" },
      { status: 400 }
    );
  }
  if (!customer_city) {
    return NextResponse.json(
      { ok: false, error: "City / area is required" },
      { status: 400 }
    );
  }
  if (!VALID_TRADE_SLUGS.has(trade_slug)) {
    return NextResponse.json(
      { ok: false, error: "Pick a trade" },
      { status: 400 }
    );
  }
  if (project_description.length < 12) {
    return NextResponse.json(
      { ok: false, error: "Describe the project (12+ characters)" },
      { status: 400 }
    );
  }

  // Rate limit by IP — 3 beacons per 10 mins so a single visitor can't
  // mass-ping the network.
  const ip = readIp(req);
  const ipHash = hashIp(ip);
  if (ipHash) {
    const since = new Date(Date.now() - TEN_MIN_MS).toISOString();
    const recent = await supabaseAdmin
      .from("hammerex_xrated_project_beacons")
      .select("id", { count: "exact", head: true })
      .eq("customer_ip_hash", ipHash)
      .gte("sent_at", since);
    if ((recent.count ?? 0) >= 3) {
      return NextResponse.json(
        {
          ok: false,
          error: "Too many beacons in a short window. Try again in 10 minutes."
        },
        { status: 429 }
      );
    }
  }

  // Country label as stored on listings table.
  const countryLabel = COUNTRY_CODE_TO_LABEL[countryCode] ?? "UK";

  // Pick the 3 nearest paid members in this trade + country. "Nearest"
  // here is city or postcode-prefix match, ordered by rating then
  // review count. When we add lat/lng search in Phase 2, swap in a
  // haversine ORDER BY.
  let q = supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name, whatsapp, tier")
    .eq("status", "live")
    .eq("primary_trade", trade_slug)
    .eq("country", countryLabel)
    .in("tier", ["app_paid", "app_trial", "verified", "verified_plus"])
    .order("rating_avg", { ascending: false, nullsFirst: false })
    .order("rating_count", { ascending: false, nullsFirst: false })
    .limit(3);

  // Prefer postcode-prefix match when supplied, fall back to city ILIKE.
  if (postcode) {
    q = q.ilike("postcode_prefix", `${postcode.slice(0, 4)}%`);
  } else {
    q = q.ilike("city", `%${customer_city}%`);
  }

  const recipientsRes = await q;
  let recipients = recipientsRes.data ?? [];

  // If postcode-prefix gave nothing, fall back to city match.
  if (recipients.length === 0 && postcode) {
    const fallback = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, display_name, whatsapp, tier")
      .eq("status", "live")
      .eq("primary_trade", trade_slug)
      .eq("country", countryLabel)
      .in("tier", ["app_paid", "app_trial", "verified", "verified_plus"])
      .ilike("city", `%${customer_city}%`)
      .order("rating_avg", { ascending: false, nullsFirst: false })
      .order("rating_count", { ascending: false, nullsFirst: false })
      .limit(3);
    recipients = fallback.data ?? [];
  }

  const trade_label = tradeLabel(trade_slug);
  const project_excerpt = project_description.slice(0, 80);

  // Fire push to each recipient's subscriptions.
  let pushDelivered = 0;
  for (const r of recipients) {
    const result = await sendLeadAlert(r.id as string, {
      type: "project_beacon",
      data: {
        customer_name,
        customer_whatsapp,
        customer_city,
        trade_label,
        project_excerpt
      }
    });
    pushDelivered += result.delivered;
  }

  // Audit row — note we DO NOT store the customer's WhatsApp.
  await supabaseAdmin.from("hammerex_xrated_project_beacons").insert({
    customer_name,
    customer_city,
    customer_postcode_prefix: postcode || null,
    trade_slug,
    project_description,
    country: countryLabel,
    recipient_listing_ids: recipients.map((r) => r.id as string),
    recipient_count: recipients.length,
    push_delivered: pushDelivered,
    customer_ip_hash: ipHash
  });

  return NextResponse.json({
    ok: true,
    recipients_pinged: recipients.length,
    push_delivered: pushDelivered,
    trade_label,
    city: customer_city
  });
}
