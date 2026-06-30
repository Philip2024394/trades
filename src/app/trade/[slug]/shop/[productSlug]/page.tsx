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
import { resolveCalculator } from "@/lib/merchantCategories";
import { SiblingsWithCompare } from "@/components/xrated/profile/merchant/SiblingsWithCompare";
import { BulkTierTable } from "@/components/xrated/profile/merchant/BulkTierTable";
import { StarsRating } from "@/components/xrated/profile/StarsRating";
import { BuyColumnDetails } from "@/components/xrated/profile/merchant/BuyColumnDetails";
import { PaymentIconsRow } from "@/components/xrated/profile/merchant/PaymentIconsRow";
import { WarrantyReturnsBlock } from "@/components/xrated/profile/merchant/WarrantyReturnsBlock";
import { CurrencyDropdown } from "@/components/xrated/profile/merchant/CurrencyDropdown";
import { PriceDisplay } from "@/components/xrated/profile/merchant/PriceDisplay";
import { ProductReviewsBlock } from "@/components/xrated/profile/merchant/ProductReviewsBlock";
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

  return (
    <main className="flex flex-1 flex-col bg-white pb-32 md:pb-0">
      <TradeProfileHeader
        listing={listing}
        appName={appName}
        backHref={`/${listing.slug}/shop`}
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
            />
          </div>

          {/* RIGHT — buy column. No description / Ref here; both move to
              the full-width ProductDetailsTabs panel below. */}
          <div id="buy-column" className="flex flex-col gap-3">
            <div>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-900"
                style={{ background: "#FFB300" }}
              >
                {category}
              </span>
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
              refCode={ref}
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

            {/* Material Calculator — renders when the product's
             *  merchant_category resolves to a CalculatorType (or the
             *  per-product override forces one). Picks the right calc
             *  component server-side and hydrates it client-side with
             *  the product's pricing snapshot. */}
            {(() => {
              const calcType = resolveCalculator({
                merchant_category: product.merchant_category,
                calculator_override: product.calculator_override
              });
              if (!calcType) return null;
              return (
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
              );
            })()}

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
                {/* Payments-accepted container — bordered card showing
                    the card-network brand pills the tradesperson honours.
                    Lives UNDER the CTAs (visible trust signal after the
                    buyer has read the CTA copy). */}
                <PaymentIconsRow selected={listing.payment_methods} />
              </>
            )}

          </div>
        </div>
      </section>

      {/* "More from {appName}" — siblings rail with an in-place Compare
          toggle. The Compare button only renders when the per-listing
          Compare addon is on AND at least one compareTargets row was
          loaded; otherwise it auto-hides and the section behaves as a
          plain siblings rail. */}
      <SiblingsWithCompare
        current={product}
        siblings={siblings}
        compareTargets={isCompareSectionOn(listing) ? compareTargets : []}
        appName={appName}
        listingSlug={listing.slug}
        siblingStats={siblingStats}
      />

      {/* Reviews — server-fetched, up to 10 latest 'live' rows. Renders
          an empty-state CTA to /<slug>/review when there are no reviews
          yet. Sits BELOW the You-might-also-like rail per spec. */}
      <ProductReviewsBlock productId={product.id} listingSlug={listing.slug} />

      {/* Q&A — off by default (per-listing toggle in addons_enabled.qa).
          When on, surfaces an "Ask on WhatsApp" CTA tied to this
          product's ref. No backing table yet. */}
      {isQAOn(listing) && <ProductQABlock product={product} listing={listing} />}

      {/* Warranty & Returns — standalone full-width block, end of page.
          Per-listing override columns drive the gate; copy lives inside
          the single-container WarrantyReturnsBlock. */}
      {isWarrantyReturnsOn(listing) && <WarrantyReturnsBlock product={product} />}

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

