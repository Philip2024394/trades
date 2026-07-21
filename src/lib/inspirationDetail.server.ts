// inspirationDetail — server-side data layer for the
// /trade-off/inspiration/[id] detail page.
//
// Unifies both image sources (curated hero-library entries + trade
// submissions), finds the 3 nearest WhatsApp-opted-in trades that
// match the image's trade keywords, and surfaces store availability
// so the "buy this image" CTA knows the price + link.
//
// SERVER-ONLY.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { heroById, heroSiblings, type HeroEntry } from "@/lib/heroLibrary";
import { submissionById, type ImageSubmission } from "@/lib/imageSubmissions";

export type InspirationDetail = {
  id:            string;
  source:        "curated" | "submission";
  imageUrl:      string;
  subject:       string;
  keywords:      string[];
  widthPx:       number | null;
  heightPx:      number | null;
  siblingGroup:  string | null;
  submitter:     { slug: string; display: string | null; avatarUrl: string | null } | null;
  sourcePostId:  string | null;
  sourceCanteen: string | null;
};

export type NearestTrade = {
  slug:            string;
  displayName:     string;
  tradingName:     string | null;
  primaryTrade:    string;
  city:            string;
  avatarUrl:       string | null;
  whatsapp:        string;      // stripped to digits, ready for wa.me
  ratingAvg:       number | null;
  ratingCount:     number;
  verified:        boolean;
};

/** Load a hero-library entry OR a submission by ID. Detects source
 *  by ID shape: submissions are UUIDs (hyphenated 8-4-4-4-12), hero
 *  entries are kebab slugs. */
export async function loadInspirationDetail(id: string): Promise<InspirationDetail | null> {
  if (!id) return null;

  // UUID pattern → submission
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (isUuid) {
    const sub = await submissionById(id);
    if (!sub) return null;
    return {
      id:            sub.id,
      source:        "submission",
      imageUrl:      sub.imageUrl,
      subject:       sub.altText ?? (sub.keywords.join(", ") || "Community submission"),
      keywords:      sub.keywords,
      widthPx:       null,
      heightPx:      null,
      siblingGroup:  null,
      submitter:     {
        slug:      sub.submitterSlug,
        display:   sub.submitterDisplay,
        avatarUrl: sub.submitterAvatarUrl
      },
      sourcePostId:  sub.sourcePostId,
      sourceCanteen: sub.sourceCanteenId
    };
  }

  // Otherwise: curated hero entry
  const hero = heroById(id);
  if (!hero) return null;
  return {
    id:            hero.id,
    source:        "curated",
    imageUrl:      hero.image_url,
    subject:       hero.subject,
    keywords:      hero.keywords_strict,
    widthPx:       hero.width_px  ?? null,
    heightPx:      hero.height_px ?? null,
    siblingGroup:  hero.sibling_group_id ?? null,
    submitter:     null,
    sourcePostId:  null,
    sourceCanteen: null
  };
}

/** Related images sharing the sibling_group. Curated only — submissions
 *  don't carry sibling groups. */
export function loadRelated(detail: InspirationDetail, limit = 8): HeroEntry[] {
  if (detail.source !== "curated" || !detail.siblingGroup) return [];
  const hero = heroById(detail.id);
  if (!hero) return [];
  return heroSiblings(hero, limit);
}

/** Find up to N trades matching the image's keywords who have opted
 *  in to WhatsApp contact. Opt-in = `whatsapp` column populated + is
 *  a plausible number (≥8 digits). Sort by rating_count DESC + rating
 *  DESC — busiest, best-rated trades surface first. City filter is
 *  best-effort: exact match preferred; if <N in the city, fall back
 *  to any UK match. */
export async function nearestWhatsappTrades(input: {
  keywords: string[];
  city?:    string | null;
  limit?:   number;
}): Promise<NearestTrade[]> {
  const limit = input.limit ?? 3;
  if (input.keywords.length === 0) return [];

  // Trade slug matches — the image's keywords include the trade slugs
  // (electrician, plumber, etc.). Match against primary_trade OR
  // secondary_trades containment.
  const orFilter = input.keywords
    .map((k) => `primary_trade.eq.${k},secondary_trades.cs.{${k}}`)
    .join(",");

  const base = supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug, display_name, trading_name, primary_trade, city, avatar_url, whatsapp, rating_avg, rating_count, hammerex_standard_verified")
    .eq("status", "live")
    .not("whatsapp", "is", null)
    .not("whatsapp", "eq", "")
    .or(orFilter)
    .order("rating_count", { ascending: false })
    .order("rating_avg",   { ascending: false, nullsFirst: false });

  // City-first pass — try exact case-insensitive city match.
  let rows: Array<Record<string, unknown>> = [];
  if (input.city) {
    const cityRes = await base.ilike("city", input.city).limit(limit);
    rows = (cityRes.data ?? []) as Array<Record<string, unknown>>;
  }
  if (rows.length < limit) {
    // Broaden to any UK match (already scoped by trade + WhatsApp).
    const wider = await base.limit(limit * 2);
    const extraRows = (wider.data ?? []) as Array<Record<string, unknown>>;
    const seen = new Set(rows.map((r) => r.slug as string));
    for (const r of extraRows) {
      if (rows.length >= limit) break;
      const slug = r.slug as string;
      if (seen.has(slug)) continue;
      rows.push(r);
      seen.add(slug);
    }
  }

  return rows.slice(0, limit).map((r) => {
    const rawWa = (r.whatsapp as string | null) ?? "";
    return {
      slug:         r.slug as string,
      displayName:  (r.display_name as string) ?? "",
      tradingName:  (r.trading_name as string | null) ?? null,
      primaryTrade: (r.primary_trade as string) ?? "",
      city:         (r.city as string) ?? "",
      avatarUrl:    (r.avatar_url as string | null) ?? null,
      whatsapp:     rawWa.replace(/\D/g, ""),
      ratingAvg:    (r.rating_avg as number | null) ?? null,
      ratingCount:  (r.rating_count as number | null) ?? 0,
      verified:     Boolean(r.hammerex_standard_verified)
    };
  }).filter((t) => t.whatsapp.length >= 8);
}

