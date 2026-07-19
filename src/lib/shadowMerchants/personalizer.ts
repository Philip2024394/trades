// Shadow-profile personalizer — merges scraped merchant data into
// an EmailContext consumable by templates.
//
// The scraped record often has partial data (no owner name, missing
// city, etc). Personalizer produces safe fallbacks so a template
// never produces awkward output like "Hi ,".

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ShadowMerchant, EmailContext } from "./types";

const BASE_URL       = process.env.NEXT_PUBLIC_SITE_URL || "https://thenetworkers.app";
const SENDER_NAME    = process.env.SHADOW_SENDER_NAME  || "Philip";
const SENDER_EMAIL   = process.env.SHADOW_SENDER_EMAIL || "philip@thenetworkers.app";
const SENDER_PHONE   = process.env.SHADOW_SENDER_PHONE || "";

/**
 * Extract a plausible first name from a business name. Handles
 * common UK trade-business patterns:
 *   "Joe's Plumbing" → "Joe"
 *   "Smith & Sons Roofing" → "Smith"
 *   "Manchester Bathroom Fitters Ltd" → null (no personal name)
 * Fallback: null → templates use "there" as greeting.
 */
export function firstNameFromBusinessName(businessName: string): string | null {
  const n = businessName.trim();

  // Pattern: "Joe's Plumbing" or "Joe`s Plumbing"
  const possessive = n.match(/^([A-Z][a-z]+)['`]s\s+/);
  if (possessive) return possessive[1];

  // Pattern: "Joe Smith Roofing" or "Joe & Sons" — first token if capitalised
  const firstToken = n.match(/^([A-Z][a-z]+)\b/);
  if (firstToken) {
    const skip = new Set([
      "The", "Manchester", "London", "Birmingham", "Leeds", "Liverpool",
      "Glasgow", "Edinburgh", "Cardiff", "Bristol", "Sheffield", "Newcastle",
      "Nottingham", "Southampton", "Portsmouth", "Cambridge", "Oxford",
      "Northern", "Southern", "Eastern", "Western", "Central", "National",
      "Global", "British", "Emergency", "Elite", "Premium", "Local", "City",
      "Trade", "Trades", "Pro", "Professional", "Quality", "Best", "Top"
    ]);
    if (!skip.has(firstToken[1])) return firstToken[1];
  }

  return null;
}

/**
 * Human-friendly trade label from the normalised trade_type slug.
 * "plumber" → "plumbing"
 * "electrician" → "electrical work"
 */
export function tradeLabelFromSlug(tradeSlug: string | null): string {
  if (!tradeSlug) return "your trade";
  const map: Record<string, string> = {
    plumber:       "plumbing",
    electrician:   "electrical work",
    roofer:        "roofing",
    carpenter:     "carpentry",
    joiner:        "joinery",
    bricklayer:    "brickwork",
    tiler:         "tiling",
    plasterer:     "plastering",
    painter:       "decorating",
    decorator:     "decorating",
    landscaper:    "landscaping",
    gardener:      "garden work",
    builder:       "building work",
    "gas-engineer": "gas work",
    "heating-engineer": "heating work",
    scaffolder:    "scaffolding",
    "drywall":     "drywall work",
    drywaller:     "drywall work"
  };
  return map[tradeSlug] || tradeSlug.replace(/-/g, " ");
}

/**
 * Count recent beacons in the merchant's city — for the Day 3 email
 * "3 leads posted in Manchester this week" personalization.
 * Returns null if no city or beacon table is empty.
 */
async function countRecentBeaconsForCity(city: string | null): Promise<number | null> {
  if (!city) return null;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const res = await supabaseAdmin
    .from("hammerex_beacons")
    .select("id", { count: "exact", head: true })
    .ilike("city", `%${city}%`)
    .gte("created_at", sevenDaysAgo);

  if (res.error) return null;
  return res.count ?? 0;
}

/**
 * Find a claimed nearby merchant in the same city + trade — for the
 * Day 14 "your competitor just claimed" pressure email.
 */
async function findNearbyClaimedMerchant(
  city:   string | null,
  trade:  string | null,
  excludeSlug: string
): Promise<{ name: string; slug: string } | null> {
  if (!city && !trade) return null;

  let query = supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("business_name, slug, trade_type, city")
    .eq("status", "live")
    .neq("slug", excludeSlug)
    .order("created_at", { ascending: false })
    .limit(5);

  if (city)  query = query.ilike("city",       `%${city}%`);
  if (trade) query = query.ilike("trade_type", `%${trade}%`);

  const res = await query;
  const row = (res.data || [])[0] as { business_name?: string; slug?: string } | undefined;
  if (!row || !row.slug) return null;
  return {
    name: row.business_name || row.slug,
    slug: row.slug
  };
}

/**
 * Build the EmailContext for a shadow merchant. Fires 2 lightweight
 * DB queries for beacon count + nearby claimed merchant. Safe to
 * call in the send-cron loop (both queries are indexed).
 */
export async function buildEmailContext(merchant: ShadowMerchant): Promise<EmailContext> {
  const firstName    = firstNameFromBusinessName(merchant.business_name);
  const cityLabel    = merchant.city || "your area";
  const tradeLabel   = tradeLabelFromSlug(merchant.trade_type);
  const reservedUrl  = `${BASE_URL}/${merchant.reserved_slug}`;
  const claimUrl     = `${BASE_URL}/claim/${merchant.claim_token || ""}`;
  const unsubUrl     = `${BASE_URL}/claim/${merchant.claim_token || ""}/unsubscribe`;
  const greetingName = firstName || merchant.business_name.split(/\s+/)[0] || "there";

  const [recentBeaconCount, nearbyClaimed] = await Promise.all([
    countRecentBeaconsForCity(merchant.city),
    findNearbyClaimedMerchant(merchant.city, merchant.trade_type, merchant.reserved_slug)
  ]);

  return {
    merchant,
    firstName:         firstName || "",
    greetingName,
    cityLabel,
    tradeLabel,
    reservedUrl,
    claimUrl,
    unsubscribeUrl:    unsubUrl,
    senderName:        SENDER_NAME,
    senderEmail:       SENDER_EMAIL,
    senderPhone:       SENDER_PHONE,
    recentBeaconCount,
    nearbyClaimedName: nearbyClaimed?.name || null,
    nearbyClaimedSlug: nearbyClaimed?.slug || null
  };
}
