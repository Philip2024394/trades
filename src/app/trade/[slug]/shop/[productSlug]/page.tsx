// Xrated Shop Mode Phase 3 — per-product detail page.
//
// Lives at /<slug>/shop/<productSlug> (exposed via next.config rewrite).
// This is the canonical share-target — every WhatsApp/Instagram/X share
// of a product lands here, so we generate a per-product OG image via
// /api/trade-off/product-og and set Twitter card metadata that quotes
// the price + tradesperson.
//
// Layout follows the brief:
//   - Back link to /<slug>/shop
//   - Gallery (cover + thumbnails)
//   - Trade-pill category chip, h1 name, ref number
//   - Price (large) + bulk-tier table if applicable
//   - Stock + dispatch metadata
//   - Variant picker + quantity + sticky CTA (ProductPageAddToCart)
//   - Description
//   - "You might also like" siblings rail

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  supabase,
  type HammerexTradeOffListing,
  type HammerexXratedProduct
} from "@/lib/supabase";
import { absolute } from "@/lib/seo";
import { effectiveTier } from "@/lib/xratedTrades";
import {
  isCompareSectionOn,
  isDeliveryTabOn,
  isQAOn,
  isSpecTabOn,
  isStorefrontOn,
  isWarrantyReturnsOn,
  isWholesaleModeOn
} from "@/lib/xratedAddons";
import { tradeLabel } from "@/lib/tradeOff";
import { TradeProfileHeader } from "@/components/xrated/TradeProfileHeader";
import { TradeProfileFooter } from "@/components/xrated/TradeProfileFooter";
import { ProductPageGallery } from "@/components/xrated/profile/merchant/ProductPageGallery";
import { ProductPageAddToCart } from "@/components/xrated/profile/merchant/ProductPageAddToCart";
import { MaterialCalculator } from "@/components/calculators/MaterialCalculator";
import { resolveCalculator, getCategory } from "@/lib/merchantCategories";
import {
  BuyColumnFlip,
  CalcOpenButton
} from "@/components/xrated/profile/merchant/BuyColumnFlip";
import { Breadcrumbs } from "@/components/xrated/profile/merchant/Breadcrumbs";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo";
// TradeConnectionsCarousel + loadTradeConnections + isTradeConnectionsOn
// retired 2026-07-09 — the endorsement-implying "Trade Circle" rail
// was swapped for the disclaimer-first NearbyInstallers strip in
// Phase A of the Nearby Installers pattern.
import { SiblingsWithCompare } from "@/components/xrated/profile/merchant/SiblingsWithCompare";
import { BulkTierTable } from "@/components/xrated/profile/merchant/BulkTierTable";
import { StarsRating } from "@/components/xrated/profile/StarsRating";
import { BuyColumnDetails } from "@/components/xrated/profile/merchant/BuyColumnDetails";
import { PaymentIconsRow } from "@/components/xrated/profile/merchant/PaymentIconsRow";
import { CurrencyDropdown } from "@/components/xrated/profile/merchant/CurrencyDropdown";
import { PriceDisplay } from "@/components/xrated/profile/merchant/PriceDisplay";
import { ProductReviewsBlock } from "@/components/xrated/profile/merchant/ProductReviewsBlock";
import { TradeKeyFeatures } from "@/components/xrated/profile/merchant/TradeKeyFeatures";
import { TradeProductFAQ } from "@/components/xrated/profile/merchant/TradeProductFAQ";
import { TradeProductVideo } from "@/components/xrated/profile/merchant/TradeProductVideo";
import { TradeDispatchBadge } from "@/components/xrated/profile/merchant/TradeDispatchBadge";
import { TradeWhatsAppFAB } from "@/components/xrated/profile/merchant/TradeWhatsAppFAB";
import { TradeShippingReturns } from "@/components/xrated/profile/merchant/TradeShippingReturns";
import { TradeWarrantyTimeline } from "@/components/xrated/profile/merchant/TradeWarrantyTimeline";
import {
  TradePairsWith,
  type TradePairsWithRow
} from "@/components/xrated/profile/merchant/TradePairsWith";
import { TradeInTheBox } from "@/components/xrated/profile/merchant/TradeInTheBox";
import { TradeQABlock } from "@/components/xrated/profile/merchant/TradeQABlock";
import {
  NearbyInstallers,
  type InstallerRow
} from "@/components/xrated/profile/merchant/NearbyInstallers";
import type {
  HammerexXratedWhatInBox,
  HammerexXratedQuestion,
  HammerexXratedAnswer
} from "@/lib/supabase";
import { ProductQABlock } from "@/components/xrated/profile/merchant/ProductQABlock";
import { StickyBuyBar } from "@/components/xrated/profile/merchant/StickyBuyBar";
import { QtyStepper } from "@/components/xrated/profile/merchant/QtyStepper";

export const revalidate = 60;

async function loadListing(slug: string): Promise<HammerexTradeOffListing | null> {
  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  return (res.data ?? null) as HammerexTradeOffListing | null;
}

async function loadProduct(
  listingId: string,
  productSlug: string
): Promise<HammerexXratedProduct | null> {
  const res = await supabase
    .from("hammerex_xrated_products")
    .select("*")
    .eq("listing_id", listingId)
    .eq("slug", productSlug)
    .eq("status", "live")
    .maybeSingle();
  return (res.data ?? null) as HammerexXratedProduct | null;
}

async function loadSiblings(
  listingId: string,
  excludeId: string
): Promise<HammerexXratedProduct[]> {
  const res = await supabase
    .from("hammerex_xrated_products")
    .select("*")
    .eq("listing_id", listingId)
    .eq("status", "live")
    .neq("id", excludeId)
    .order("featured_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(4);
  return (res.data ?? []) as HammerexXratedProduct[];
}

/** Load every live product on the merchant that has merchant_subcategory
 *  set — feeds the calculator's cross-sell engine. Capped at 50 so a
 *  huge catalogue doesn't bloat the PDP server payload. */
async function loadCrossSellCandidates(
  listingId: string,
  excludeId: string
): Promise<
  Array<{
    id: string;
    slug: string | null;
    name: string;
    price_pence: number;
    cover_url: string | null;
    merchant_subcategory: string | null;
  }>
> {
  const res = await supabase
    .from("hammerex_xrated_products")
    .select("id, slug, name, price_pence, cover_url, merchant_subcategory")
    .eq("listing_id", listingId)
    .eq("status", "live")
    .neq("id", excludeId)
    .not("merchant_subcategory", "is", null)
    .limit(50);
  return (res.data ?? []) as Array<{
    id: string;
    slug: string | null;
    name: string;
    price_pence: number;
    cover_url: string | null;
    merchant_subcategory: string | null;
  }>;
}

// Up to 2 hand-picked compare targets — paired with the current product
// to render a side-by-side compare-3 strip under the buy column. IDs
// live in product.compare_with (seeded automatically per the "compare on
// by default" rule).
async function loadCompareTargets(
  ids: string[]
): Promise<HammerexXratedProduct[]> {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const res = await supabase
    .from("hammerex_xrated_products")
    .select("*")
    .in("id", ids.slice(0, 2))
    .eq("status", "live");
  return (res.data ?? []) as HammerexXratedProduct[];
}

// Batch-fetch review aggregates for many products in one round trip.
// Used to seed the stars row on sibling + compare cards on the PDP. We
// pull every live `overall_rating` for the given IDs, aggregate locally,
// and return a plain Record so the client SiblingsWithCompare can do a
// constant-time lookup per card. Failures degrade silently to {} so the
// PDP never crashes when the reviews infra is offline.
async function loadProductsStats(
  productIds: string[]
): Promise<Record<string, { rating: number | null; count: number }>> {
  if (productIds.length === 0) return {};
  const res = await supabase
    .from("hammerex_xrated_reviews")
    .select("product_id, overall_rating")
    .in("product_id", productIds)
    .eq("status", "live")
    // 24h cool-down + admin-Hide gate. Goes_live_at <= now() is the
    // canonical "publicly visible" filter post-migration.
    .lte("goes_live_at", new Date().toISOString());
  if (res.error) return {};
  const rows = (res.data ?? []) as {
    product_id: string;
    overall_rating: number | null;
  }[];
  const buckets = new Map<string, { sum: number; count: number; rated: number }>();
  for (const r of rows) {
    if (!r.product_id) continue;
    const bucket = buckets.get(r.product_id) ?? { sum: 0, count: 0, rated: 0 };
    bucket.count += 1;
    if (Number.isFinite(r.overall_rating)) {
      bucket.sum += Number(r.overall_rating);
      bucket.rated += 1;
    }
    buckets.set(r.product_id, bucket);
  }
  const out: Record<string, { rating: number | null; count: number }> = {};
  for (const [pid, bucket] of buckets) {
    out[pid] = {
      rating: bucket.rated > 0 ? bucket.sum / bucket.rated : null,
      count: bucket.count
    };
  }
  return out;
}

// Aggregate review stats for the in-page StarsRating row. Reviews live
// in `hammerex_xrated_reviews` (status='live'), with the per-axis rating
// columns documented in /api/trade-off/reviews/product-stats. We only
// need overall_rating + count here. Failures degrade silently to 0
// reviews so a PDP never crashes when the reviews infra is offline.
async function loadProductStats(
  productId: string
): Promise<{ rating: number | null; count: number }> {
  const res = await supabase
    .from("hammerex_xrated_reviews")
    .select("overall_rating", { count: "exact" })
    .eq("product_id", productId)
    .eq("status", "live")
    // 24h cool-down + admin-Hide gate.
    .lte("goes_live_at", new Date().toISOString());
  if (res.error) return { rating: null, count: 0 };
  const rows = (res.data ?? []) as { overall_rating: number | null }[];
  if (rows.length === 0) {
    return { rating: null, count: res.count ?? 0 };
  }
  const valid = rows
    .map((r) => Number(r.overall_rating))
    .filter((n) => Number.isFinite(n));
  if (valid.length === 0) return { rating: null, count: res.count ?? 0 };
  const avg = valid.reduce((s, n) => s + n, 0) / valid.length;
  return { rating: avg, count: res.count ?? rows.length };
}

function refNumber(product: HammerexXratedProduct): string {
  // Use the first 6 hex chars of the UUID, uppercased. Stable, unique
  // enough per listing for human-quoting, and never collides with the
  // visible slug. Matches the pattern Hammerex products use ("Ref:").
  const id = (product.id || "").replace(/[^0-9a-f]/gi, "").slice(0, 6);
  return id.toUpperCase() || "—";
}

function formatGbp(pence: number): string {
  if (!Number.isFinite(pence) || pence <= 0) return "£0";
  const pounds = pence / 100;
  return pounds % 1 === 0
    ? `£${pounds.toLocaleString("en-GB")}`
    : `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Retail delivery summary — one-line copy that sits DIRECTLY UNDER the
// VAT row in the buy column. Mirrors the BuyColumnDetails Delivery body
// labels but condensed to a single muted neutral line.
function shippingSummaryLine(
  listing: HammerexTradeOffListing
): { primary: string; intl: boolean } {
  const mode = listing.retail_shipping_mode;
  const intlRows = Array.isArray(listing.retail_shipping_international)
    ? listing.retail_shipping_international
    : [];
  const intl = intlRows.length > 0;
  if (mode === "free") return { primary: "Free UK delivery", intl };
  if (mode === "uk_flat") {
    const pence = listing.retail_shipping_uk_pence ?? 0;
    return { primary: `UK delivery ${formatGbp(pence)}`, intl };
  }
  if (mode === "uk_areas") {
    const rows = Array.isArray(listing.retail_shipping_uk_areas)
      ? listing.retail_shipping_uk_areas
      : [];
    if (rows.length >= 1) {
      const min = Math.min(...rows.map((r) => r.price_pence ?? 0));
      return { primary: `UK delivery from ${formatGbp(min)}`, intl };
    }
    return { primary: "Delivery confirmed by WhatsApp", intl };
  }
  return { primary: "Delivery confirmed by WhatsApp", intl };
}

// VAT helper line — renders as small grey text under the price row (not
// a badge). NULL VAT columns ⇒ tradesperson isn't VAT registered. The
// dominant <PriceDisplay> figure on the PDP is now the gross (inc-VAT)
// price for any VAT-registered seller, per UK Price Marking Order 2004,
// so the sub-line here is the smaller ex-VAT figure aimed at trade
// buyers — flipped from the legacy "ex headline + inc sub" order.
function vatLine(product: HammerexXratedProduct): { label: string; sub?: string } {
  if (product.vat_rate_pct === null || product.vat_inclusive === null) {
    return { label: "Price does not include VAT — seller is not VAT registered" };
  }
  const ratePct = product.vat_rate_pct;
  const rateStr = Number.isInteger(ratePct) ? String(ratePct) : ratePct.toFixed(1);
  if (product.vat_inclusive) {
    return { label: `Price includes VAT ${rateStr}%` };
  }
  return {
    label: `Price includes VAT ${rateStr}%`,
    sub: `${formatGbp(product.price_pence)} ex VAT (trade)`
  };
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const listing = await loadListing(slug);
  if (!listing) return { title: "Product not found" };
  const product = await loadProduct(listing.id, productSlug);
  if (!product) return { title: "Product not found" };
  const appName = `${tradeLabel(listing.primary_trade)} Service`;
  const title = `${product.name} — ${formatGbp(product.price_pence)} | ${appName}`;
  const description = (product.description ?? "").trim().length > 0
    ? (product.description as string).slice(0, 160)
    : `${product.name} from ${appName}, ${listing.city}. ${formatGbp(product.price_pence)} — send an enquiry on WhatsApp.`;
  const ogImage = absolute(
    `/api/trade-off/product-og?slug=${encodeURIComponent(listing.slug)}&productSlug=${encodeURIComponent(productSlug)}`
  );
  const url = absolute(`/${listing.slug}/shop/${productSlug}`);
  return {
    title,
    description,
    alternates: { canonical: `/${listing.slug}/shop/${productSlug}` },
    openGraph: {
      title,
      description,
      url,
      siteName: "Xrated Trades",
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630 }]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage]
    }
  };
}

export default async function ProductDetailPage({
  params
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}) {
  const { slug, productSlug } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();
  const tier = effectiveTier(listing);
  const isPaid = tier === "app_trial" || tier === "app_paid" || tier === "app_verified";
  if (!isPaid || !isStorefrontOn(listing)) {
    redirect(`/${listing.slug}`);
  }
  const product = await loadProduct(listing.id, productSlug);
  if (!product) notFound();
  const compareIds = Array.isArray(product.compare_with) ? product.compare_with : [];
  // Phase A of the Nearby Installers pattern retired the previous
  // "Trade Circle" carousel. It implied platform endorsement of the
  // listed trades — a liability we're not set up to carry. The new
  // strip (NearbyInstallers below) is pure discovery + WhatsApp
  // handoff with an inline disclaimer.
  const [siblings, compareTargets, stats, crossSellSiblings] = await Promise.all([
    loadSiblings(listing.id, product.id),
    loadCompareTargets(compareIds),
    loadProductStats(product.id),
    loadCrossSellCandidates(listing.id, product.id)
  ]);
  // Batch the sibling + compare-target review aggregates in one
  // round-trip after the products are known. Keeps the rail from
  // firing N + M independent queries.
  const railIds = Array.from(
    new Set([...siblings.map((s) => s.id), ...compareTargets.map((c) => c.id)])
  );
  const siblingStats = await loadProductsStats(railIds);

  // Customer Q&A — questions + answers loaded in two shots and
  // stitched into the {...q, answers: []} shape TradeQABlock renders.
  // Deleted / moderation-hidden rows filtered out at query time.
  const qRes = await supabase
    .from("hammerex_xrated_questions")
    .select("id, product_id, asked_by, body, flag_count, moderation_status, moderated_at, deleted_at, created_at")
    .eq("product_id", product.id)
    .is("deleted_at", null)
    .eq("moderation_status", "live")
    .order("created_at", { ascending: false })
    .limit(30);
  const qRows = qRes.data ?? [];
  let qaThread: HammerexXratedQuestion[] = [];
  if (qRows.length > 0) {
    const qIds = qRows.map((q) => q.id as string);
    const aRes = await supabase
      .from("hammerex_xrated_answers")
      .select("id, question_id, body, by_vendor, by_name, moderation_status, deleted_at, created_at")
      .in("question_id", qIds)
      .is("deleted_at", null)
      .eq("moderation_status", "live")
      .order("created_at", { ascending: true });
    const answersByQ = new Map<string, HammerexXratedAnswer[]>();
    for (const a of aRes.data ?? []) {
      const arr = answersByQ.get(a.question_id as string) ?? [];
      arr.push({
        id: a.id as string,
        question_id: a.question_id as string,
        body: a.body as string,
        by_vendor: a.by_vendor as boolean,
        by_name: (a.by_name as string | null) ?? null,
        moderation_status: a.moderation_status as
          | "live"
          | "hidden"
          | "spam",
        deleted_at: (a.deleted_at as string | null) ?? null,
        created_at: a.created_at as string
      });
      answersByQ.set(a.question_id as string, arr);
    }
    qaThread = qRows.map((q) => ({
      id: q.id as string,
      product_id: q.product_id as string,
      asked_by: (q.asked_by as string | null) ?? null,
      body: q.body as string,
      flag_count: q.flag_count as number,
      moderation_status: q.moderation_status as "live" | "hidden" | "spam",
      moderated_at: (q.moderated_at as string | null) ?? null,
      deleted_at: (q.deleted_at as string | null) ?? null,
      created_at: q.created_at as string,
      answers: answersByQ.get(q.id as string) ?? []
    }));
  }

  // What's in the box — single small query. Auto-hides when empty.
  const boxRes = await supabase
    .from("hammerex_xrated_what_in_box")
    .select("id, product_id, label, qty, image_url, sort_order, created_at")
    .eq("product_id", product.id)
    .order("sort_order", { ascending: true })
    .limit(30);
  const whatInBox: HammerexXratedWhatInBox[] = (boxRes.data ?? []).map(
    (r) => ({
      id: r.id as string,
      product_id: r.product_id as string,
      label: r.label as string,
      qty: r.qty as number,
      image_url: (r.image_url as string | null) ?? null,
      sort_order: r.sort_order as number,
      created_at: r.created_at as string
    })
  );

  // Nearby installers (Phase A) — only runs when this product declared
  // an install category. Finds live service rows on other trades
  // tagged with the same category, prefers same-city, caps at 3.
  // Same-country filter keeps a UK product from showing an
  // international install offer.
  let nearbyInstallers: InstallerRow[] = [];
  if (product.install_service_category) {
    const svcRes = await supabase
      .from("hammerex_xrated_products")
      .select(
        "id, name, slug, price_pence, unit, listing_id, service_category, status, kind"
      )
      .eq("service_category", product.install_service_category)
      .eq("kind", "service")
      .eq("status", "live")
      .limit(24);
    const svcRows = svcRes.data ?? [];
    if (svcRows.length > 0) {
      const listingIds = Array.from(
        new Set(svcRows.map((r) => r.listing_id as string))
      );
      const listingsRes = await supabase
        .from("hammerex_trade_off_listings")
        .select("id, slug, display_name, trading_name, city, country, whatsapp, status")
        .in("id", listingIds)
        .eq("status", "live");
      const listingMap = new Map(
        (listingsRes.data ?? []).map((l) => [l.id as string, l])
      );

      // Aggregate review stats per listing so the card can render
      // "★ 4.7 (32)". Only public reviews count.
      const reviewsRes = await supabase
        .from("hammerex_trade_off_reviews")
        .select("listing_id, rating")
        .in("listing_id", listingIds)
        .eq("status", "live");
      const reviewAgg = new Map<
        string,
        { count: number; sum: number }
      >();
      for (const rv of reviewsRes.data ?? []) {
        const key = rv.listing_id as string;
        const cur = reviewAgg.get(key) ?? { count: 0, sum: 0 };
        cur.count += 1;
        cur.sum += (rv.rating as number) ?? 0;
        reviewAgg.set(key, cur);
      }

      const anchorCity = listing.city ?? null;
      const anchorCountry = listing.country ?? "UK";
      const scored: Array<{
        row: (typeof svcRows)[number];
        listing: NonNullable<ReturnType<typeof listingMap.get>>;
        score: number;
      }> = [];
      for (const row of svcRows) {
        const trade = listingMap.get(row.listing_id as string);
        if (!trade) continue;
        if ((trade.country ?? "UK") !== anchorCountry) continue;
        // Skip the merchant recommending themselves — awkward UX.
        if (trade.id === listing.id) continue;
        // Same-city ⇒ score 0 (nearest). Same-country ⇒ score 1.
        // Random tiebreak so a trade with 20 services doesn't always win.
        const cityScore =
          anchorCity && trade.city && trade.city === anchorCity ? 0 : 1;
        scored.push({ row, listing: trade, score: cityScore + Math.random() });
      }
      scored.sort((a, b) => a.score - b.score);
      nearbyInstallers = scored.slice(0, 3).map(({ row, listing: trade }) => {
        const stats = reviewAgg.get(trade.id as string);
        return {
          serviceId: row.id as string,
          serviceName: row.name as string,
          serviceSlug: (row.slug as string | null) ?? null,
          pricePence: row.price_pence as number,
          unit: (row.unit as string | null) ?? null,
          sellerSlug: trade.slug as string,
          sellerName:
            (trade.trading_name as string | null)?.trim() ||
            (trade.display_name as string) ||
            "Trade",
          sellerCity: (trade.city as string | null) ?? null,
          sellerWhatsapp: (trade.whatsapp as string | null) ?? "",
          reviewCount: stats?.count ?? 0,
          averageRating:
            stats && stats.count > 0 ? stats.sum / stats.count : null
        } satisfies InstallerRow;
      });
    }
  }

  // Pairs-with rail — two-hop query: fetch the pair rows for this
  // anchor product, then resolve accessory data in one shot. Filters
  // to same-listing accessories at the DB level so a rogue pair row
  // pointing at another trade's product silently drops out.
  const pairsRes = await supabase
    .from("hammerex_xrated_pair_with")
    .select("id, accessory_product_id, reason, sort_order")
    .eq("product_id", product.id)
    .order("sort_order", { ascending: true })
    .limit(6);
  const pairRows = pairsRes.data ?? [];
  let pairsWithRail: TradePairsWithRow[] = [];
  if (pairRows.length > 0) {
    const accessoryIds = pairRows.map((r) => r.accessory_product_id);
    const accRes = await supabase
      .from("hammerex_xrated_products")
      .select("id, name, slug, cover_url, price_pence, listing_id")
      .in("id", accessoryIds)
      .eq("listing_id", listing.id);
    const accMap = new Map(
      (accRes.data ?? []).map((a) => [a.id as string, a])
    );
    pairsWithRail = pairRows
      .map((r) => {
        const acc = accMap.get(r.accessory_product_id);
        if (!acc) return null;
        return {
          id: r.id as string,
          reason: r.reason ?? null,
          accessory: {
            id: acc.id as string,
            name: acc.name as string,
            slug: (acc.slug as string | null) ?? null,
            coverUrl: (acc.cover_url as string | null) ?? null,
            pricePence: acc.price_pence as number
          },
          sellerSlug: listing.slug
        } satisfies TradePairsWithRow;
      })
      .filter((row): row is TradePairsWithRow => row !== null);
  }

  const themeColor = listing.theme_color || "#FFB300";
  const appName = `${tradeLabel(listing.primary_trade)} Service`;
  const category = (product.category ?? "").trim().length > 0
    ? (product.category as string)
    : tradeLabel(listing.primary_trade);
  const stock = product.stock_count;
  const dispatchDays = product.dispatch_days;
  const bulkTiers = Array.isArray(product.bulk_tiers) ? product.bulk_tiers : [];
  const showBulkTiers = isWholesaleModeOn(listing) && bulkTiers.length > 0;
  const ref = refNumber(product);
  // Resolve the calculator type once at the top so the BuyColumnFlip
  // wrapper (front face / back face) and the in-content render share
  // the same decision.
  const calcType = resolveCalculator({
    merchant_category: product.merchant_category,
    calculator_override: product.calculator_override
  });

  // UK install-services flow: stair / kitchen fitters etc. sell labour by
  // measurement, so the buying journey ends at "Request site visit" on
  // WhatsApp instead of add-to-cart. The DB-backed product_kind decides.
  const isInstall = product.product_kind === "install";
  const installDigits = listing.whatsapp.replace(/[^0-9]/g, "");
  const installSurveyMsg = `Hi ${listing.display_name}, I'd like to book a site visit for "${product.name}" (Ref: ${ref}). Could you let me know your next availability and confirm if you cover my postcode?`;
  const installSurveyHref = `https://wa.me/${installDigits}?text=${encodeURIComponent(installSurveyMsg)}`;
  // Sticky bottom "Chat now" CTA — opens WhatsApp with the product name
  // + ref so the tradesperson lands on the right thread.
  const stickyChatHref = `https://wa.me/${installDigits}?text=${encodeURIComponent(
    `Hi ${listing.display_name}, I'd like to chat about "${product.name}" (Ref: ${ref}).`
  )}`;

  // Breadcrumb trail — Home › {Trade} Service › {Category} › {Product}.
  // Visible nav strip above the gallery PLUS BreadcrumbList JSON-LD so
  // Google can render rich-snippet breadcrumbs in SERPs.
  const categoryDef = getCategory(product.merchant_category ?? null);
  const productUrl = `/${listing.slug}/shop/${product.slug ?? product.id}`;
  const shopUrl = `/${listing.slug}/shop`;
  const breadcrumbTrail: { name: string; url?: string }[] = [
    { name: "Home", url: "/" },
    { name: appName, url: shopUrl }
  ];
  if (categoryDef) {
    breadcrumbTrail.push({ name: categoryDef.label, url: shopUrl });
  }
  breadcrumbTrail.push({ name: product.name });

  // Product JSON-LD — drives the price + ★ rich snippet on SERPs. Pulls
  // stock state from product.stock_count (null = treat as in-stock) and
  // aggregateRating from the live stats we already loaded for the page.
  const availability =
    typeof stock === "number" && stock <= 0 ? "OutOfStock" : "InStock";
  const productImages = [
    product.cover_url,
    ...(product.gallery_urls ?? [])
  ].filter((u): u is string => typeof u === "string" && u.length > 0);

  return (
    <main className="flex flex-1 flex-col bg-white pb-32 md:pb-0">
      <TradeProfileHeader
        listing={listing}
        appName={appName}
        backHref={`/${listing.slug}/shop`}
      />

      <Breadcrumbs trail={breadcrumbTrail} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd(
              breadcrumbTrail.map((t) => ({ name: t.name, url: t.url ?? productUrl }))
            )
          )
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            productJsonLd({
              name: product.name,
              description: product.description ?? "",
              url: productUrl,
              image: productImages.length > 0 ? productImages.map((u) => absolute(u)) : [absolute("/")],
              sku: ref,
              brandName: listing.display_name ?? listing.slug,
              pricePence:
                product.vat_inclusive === false &&
                typeof product.vat_rate_pct === "number"
                  ? Math.round(product.price_pence * (1 + product.vat_rate_pct / 100))
                  : product.price_pence,
              currency: "GBP",
              availability,
              ratingAvg: stats.rating,
              reviewCount: stats.count
            })
          )
        }}
      />

      <section className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
          {/* LEFT — gallery */}
          <div>
            <ProductPageGallery
              product={product}
              listingLat={listing.lat}
              listingLng={listing.lng}
              listingCity={listing.city}
              refCode={ref}
            />
          </div>

          {/* RIGHT — buy column. The flip wrapper lets the calculator
           *  icon next to the product name flip this column 3D-style to
           *  reveal the Material Calculator; close in the calc header
           *  flips it back. Ref code now overlays the gallery image. */}
          <div id="buy-column">
            <BuyColumnFlip
              hasCalculator={!!calcType}
              back={
                calcType ? (
                  <MaterialCalculator
                    type={calcType}
                    product={{
                      id: product.id,
                      name: product.name,
                      price_pence: product.price_pence,
                      cover_url: product.cover_url,
                      calculator_config: null,
                      service_trade_type: product.service_trade_type,
                      service_rate_pence: product.service_rate_pence,
                      service_rate_unit: product.service_rate_unit
                    }}
                    listingSlug={listing.slug}
                    productSlug={product.slug ?? product.id}
                    productRef={ref}
                    merchantName={listing.display_name ?? listing.slug}
                    merchantWhatsappDigits={(listing.whatsapp ?? "").replace(/[^0-9]/g, "")}
                    siblings={crossSellSiblings.map((s) => ({
                      id: s.id,
                      slug: s.slug,
                      name: s.name,
                      price_pence: s.price_pence,
                      cover_url: s.cover_url,
                      status: "live" as const,
                      merchant_subcategory: s.merchant_subcategory
                    }))}
                  />
                ) : null
              }
            >
            <div className="flex items-center justify-between gap-3">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-900"
                style={{ background: "#FFB300" }}
              >
                {category}
              </span>
              {/* Calculator open button — sits across from the trade
               *  badge on the same line. Hidden via context when the
               *  product has no calculator. Flips the buy column 3D-
               *  style to reveal the Material Calculator. */}
              <CalcOpenButton />
            </div>
            {(() => {
              // Split off a trailing parenthetical so qualifiers like
              // "(per linear metre)" sit on their own line beneath the
              // main product name in a smaller muted weight.
              const m = product.name.match(/^(.*?)\s*(\([^()]+\))\s*$/);
              const main = m ? m[1].trim() : product.name;
              const tail = m ? m[2] : "";
              return (
                <h1 className="break-words pr-3 text-2xl font-extrabold leading-tight text-neutral-900 sm:pr-0 sm:text-3xl">
                  {main}
                  {tail && (
                    <span className="mt-1 block text-base font-bold text-neutral-500 sm:text-lg">
                      {tail}
                    </span>
                  )}
                </h1>
              );
            })()}
            <StarsRating rating={stats.rating} reviewCount={stats.count} />
            {/* Compact Description / Spec / Delivery toggle. Replaces
                the old full-width ProductDetailsTabs panel — the buy
                column now carries the same info inline. */}
            <BuyColumnDetails
              product={product}
              specTabOn={isSpecTabOn(listing)}
              deliveryTabOn={isDeliveryTabOn(listing)}
              shipsFromCity={listing.city}
              dispatchDays={product.dispatch_days}
              returnsText={product.returns_text}
              shippingMode={listing.retail_shipping_mode}
              shippingUkPence={listing.retail_shipping_uk_pence}
              shippingUkAreas={listing.retail_shipping_uk_areas}
              shippingIntl={listing.retail_shipping_international}
            />
            <div className="flex flex-wrap items-center gap-3">
              <CurrencyDropdown />
              <PriceDisplay
                pricePence={
                  // PMO 2004 — dominant figure is VAT-inclusive when
                  // the seller is VAT-registered and stored the price
                  // ex-VAT. Inline rather than importing the cart
                  // helper to keep this server component free of the
                  // "use client" boundary in xratedCart.
                  product.vat_inclusive === false &&
                  typeof product.vat_rate_pct === "number"
                    ? Math.round(
                        product.price_pence * (1 + product.vat_rate_pct / 100)
                      )
                    : product.price_pence
                }
                installPrefix={isInstall}
              />
              {!isInstall && <StockPill stock={stock} />}
              {!isInstall && (
                <TradeDispatchBadge dispatchDays={product.dispatch_days} />
              )}
              {!isInstall && bulkTiers.length > 0 && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[13px] font-extrabold"
                  style={{ background: "#FFB30022", color: "#0A0A0A", borderColor: "#FFB300" }}
                >
                  Bulk tiers below
                </span>
              )}
            </div>

            {(() => {
              const vat = vatLine(product);
              const ship = shippingSummaryLine(listing);
              return (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13px] text-neutral-500">
                      {vat.label}
                    </span>
                    {vat.sub && (
                      <span className="text-[13px] font-bold text-neutral-500">
                        {vat.sub}
                      </span>
                    )}
                    {/* One-line retail-delivery summary — stacks under VAT
                        in the same column so QtyStepper on the right is
                        untouched. Reads from listing.retail_shipping_*. */}
                    <span className="text-[13px] text-neutral-500">
                      {ship.primary}
                      {ship.intl && (
                        <span className="text-neutral-400">
                          {" "}· ships internationally
                        </span>
                      )}
                    </span>
                  </div>
                  {/* Qty stepper sits to the right of the VAT line —
                      below the price row so the buyer reads VAT first,
                      then dials in quantity. Stock kind only. */}
                  {!isInstall && (
                    <div className="shrink-0">
                      <QtyStepper productId={product.id} />
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              {isInstall ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[13px] font-bold text-neutral-800">
                  Site survey first · Lead time on request
                </span>
              ) : (
                <>
                  {typeof dispatchDays === "number" && dispatchDays >= 0 && dispatchDays <= 2 && (
                    /* FAST badge — green pill, ⚡ prefix. dispatch_days
                       of 0 reads "Ships same day", 1/2 use the standard
                       singular/plural day(s). */
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-extrabold text-white"
                      style={{ background: "#0F7A3F" }}
                    >
                      ⚡ FAST · {dispatchDays === 0
                        ? "Ships same day"
                        : `Ships in ${dispatchDays} ${dispatchDays === 1 ? "day" : "days"}`}
                    </span>
                  )}
                  {typeof dispatchDays === "number" && dispatchDays > 2 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 font-bold text-neutral-700">
                      Ships in {dispatchDays} {dispatchDays === 1 ? "day" : "days"}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Bulk tiers — appears for ANY product with bulk_tiers
                set on the row (data-driven, not Wholesale-Mode gated).
                Previously hidden silently for merchants who hadn't
                toggled the add-on. Skipped on install services — those
                are priced after survey. */}
            {!isInstall && bulkTiers.length > 0 && (
              <BulkTierTable tiers={bulkTiers} productId={product.id} />
            )}

            {/* MaterialCalculator moved to the BuyColumnFlip back face —
             *  the calc icon in BuyColumnDetails (rightSlot) flips this
             *  whole column to reveal it. No inline render here. */}

            {isInstall ? (
              <div className="flex flex-col gap-1">
                <a
                  href={installSurveyHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-extrabold uppercase tracking-wider text-white"
                  style={{
                    background: "#0F7A3F",
                    boxShadow: "0 8px 22px rgba(15,122,63,0.45)"
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Z" />
                  </svg>
                  Request site visit
                </a>
                <p className="text-[13px] text-neutral-500">
                  No payment now — we&rsquo;ll quote after the survey.
                </p>
              </div>
            ) : (
              <>
                {/* Side-by-side CTAs — ProductPageAddToCart owns the
                    2-col grid internally when enquireHref is passed.
                    Cart button is yellow (Add-to-enquiry); Enquiry is
                    solid green (#0F7A3F) so the WhatsApp CTA reads as
                    the canonical action. */}
                <ProductPageAddToCart
                  product={product}
                  slug={listing.slug}
                  themeColor={themeColor}
                  enquireHref={(() => {
                    const digits = listing.whatsapp.replace(/[^0-9]/g, "");
                    const msg = `Hi ${listing.display_name}, I'd like to ask about "${product.name}" (Ref: ${ref}). Is it available?`;
                    return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
                  })()}
                />
                {/* Payments-accepted card — now ALSO hosts the compact
                    reviews block in its bottomSlot, merging payments
                    trust + social proof into one bordered surface. */}
                <PaymentIconsRow
                  selected={listing.payment_methods}
                  bottomSlot={
                    <ProductReviewsBlock
                      productId={product.id}
                      listingSlug={listing.slug}
                    />
                  }
                />
              </>
            )}

            </BuyColumnFlip>
          </div>
        </div>
      </section>

      {/* Reviews have moved INTO the buy column (under Add-to-cart) so
       *  social proof sits next to the conversion CTA — the Amazon
       *  pattern. The full-width slot here is now reserved for the
       *  Trade Connections rail. */}

      {/* Nearby Installers (Phase A) — replaces the previous Trade
          Connections carousel. Framed as pure discovery: independent
          local trades who offer the install this product needs,
          proximity-sorted, disclaimer above the grid so the shopper
          is clear the platform doesn't vet or vouch for these trades.
          WhatsApp handoff — we introduce, they book. */}
      {product.install_service_category && nearbyInstallers.length > 0 && (
        <NearbyInstallers
          installers={nearbyInstallers}
          installCategory={product.install_service_category}
          anchor={{
            productId: product.id,
            name: product.name,
            pricePence: product.price_pence,
            coverUrl: product.cover_url,
            unit: product.unit,
            sellerSlug: listing.slug,
            sellerName: listing.display_name ?? listing.slug
          }}
        />
      )}

      {/* Phase 1–5 port from thenetworkers.app PDP — visual bumps that
          read existing fields on hammerex_xrated_products / _listings
          with no schema change. Each renders nothing when the
          underlying field is null / empty so PDPs without curated
          content stay clean. */}
      <TradeProductVideo url={product.video_url} title={product.name} />
      <TradeInTheBox items={whatInBox} fallbackImage={product.cover_url} />
      <TradeKeyFeatures features={product.features} />
      <TradeProductFAQ faq={product.faq} />
      <TradeShippingReturns
        shippingMode={listing.retail_shipping_mode}
        shippingUkPence={listing.retail_shipping_uk_pence}
        shippingUkAreas={listing.retail_shipping_uk_areas}
        shippingIntl={listing.retail_shipping_international}
        shipsFromCity={listing.city}
        dispatchDays={product.dispatch_days}
        warrantyYears={product.warranty_years}
      />
      <TradeWarrantyTimeline warrantyYears={product.warranty_years} />
      <TradePairsWith pairs={pairsWithRail} />

      {/* "More from {appName}" / "You might also like" siblings rail
       *  removed from the PDP per spec — Trade Connections now sits in
       *  that visual slot, and the wider catalogue is one tap away via
       *  the shop link in the header. */}

      {/* Reviews block moved up — now renders above Trade Connections.
       *  Section intentionally empty here so the page-order spec stays
       *  greppable. */}

      {/* Q&A — off by default (per-listing toggle in addons_enabled.qa).
          Phase 9a upgrade: replaced the empty-state ProductQABlock
          with the schema-backed TradeQABlock. Public visitors can ask;
          trades reply from their editor (Phase 9b). */}
      {isQAOn(listing) && (
        <TradeQABlock
          productId={product.id}
          productName={product.name}
          initialQuestions={qaThread}
          tradeDisplayName={listing.display_name ?? listing.slug}
        />
      )}

      {/* Warranty / Returns — collapsed to a single-line strip above the
          footer. The full-width WarrantyReturnsBlock was eating real
          estate for what is essentially three short clauses; the
          long-form copy now lives only in the Delivery tab's Returns
          row inside BuyColumnDetails. Per-listing override gate
          retained. */}
      {isWarrantyReturnsOn(listing) && (
        <div className="mx-auto mt-10 w-full max-w-6xl px-4 sm:px-6">
          <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-center text-[12px] font-bold text-neutral-600">
            Manufacturer&rsquo;s warranty applies · Unused items returnable
            within the stated window for a full refund · Faulty product?
            We&rsquo;ll handle the manufacturer claim directly.
          </p>
        </div>
      )}

      <div className="mt-auto">
        <TradeProfileFooter listing={listing} appName={appName} />
      </div>

      {/* Sticky footer rebuy bar — reveals once the buy column scrolls
          off screen. Uses the scroll-anchor fallback (smooth-scroll to
          #buy-column) rather than wiring a custom event back into
          ProductPageAddToCart's add handler. */}
      {!isInstall && (
        <StickyBuyBar product={product} stats={stats} whatsappHref={stickyChatHref} />
      )}

      {/* Phase 4 port — floating WhatsApp FAB. Hidden while the buy
          column is in view; slides in once it scrolls off. Falls back
          to invisible when the trade has no WhatsApp on file. */}
      <TradeWhatsAppFAB
        sellerWhatsapp={listing.whatsapp}
        sellerName={listing.display_name ?? listing.slug}
        productName={product.name}
        productRef={ref}
      />
    </main>
  );
}

function StockPill({ stock }: { stock: number | null }) {
  // No-badge styling for in-stock states — plain bold text in green so it
  // reads as a status word, not a marketing pill. Out-of-stock keeps the
  // red badge for urgency.
  if (stock === null) {
    return (
      <span className="text-[13px] font-extrabold" style={{ color: "#0F7A3F" }}>
        In stock
      </span>
    );
  }
  if (stock <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-extrabold text-white" style={{ background: "#DC2626" }}>
        Out of stock
      </span>
    );
  }
  // Live count — shows the actual number the trade entered.
  return (
    <span className="text-[13px] font-extrabold" style={{ color: "#0F7A3F" }}>
      In stock {stock}
    </span>
  );
}

