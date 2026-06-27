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
import { isStorefrontOn, isWholesaleModeOn } from "@/lib/xratedAddons";
import { tradeLabel } from "@/lib/tradeOff";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { ShopCartIsland } from "@/components/xrated/profile/ShopCartIsland";
import { ProductPageGallery } from "@/components/xrated/profile/ProductPageGallery";
import { ProductPageAddToCart } from "@/components/xrated/profile/ProductPageAddToCart";
import { ProductCardLink } from "@/components/xrated/profile/ProductCardLink";
import { BulkTierTable } from "@/components/xrated/profile/BulkTierTable";

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
  const firstName = listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const title = `${product.name} — ${formatGbp(product.price_pence)} | ${firstName}'s Shop`;
  const description = (product.description ?? "").trim().length > 0
    ? (product.description as string).slice(0, 160)
    : `${product.name} from ${listing.display_name}, ${listing.city}. ${formatGbp(product.price_pence)} — send an enquiry on WhatsApp.`;
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
  const isPaid = tier === "app_trial" || tier === "app_paid";
  if (!isPaid || !isStorefrontOn(listing)) {
    redirect(`/${listing.slug}`);
  }
  const product = await loadProduct(listing.id, productSlug);
  if (!product) notFound();
  const siblings = await loadSiblings(listing.id, product.id);

  const themeColor = listing.theme_color || "#FFB300";
  const firstName = listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const category = (product.category ?? "").trim().length > 0
    ? (product.category as string)
    : tradeLabel(listing.primary_trade);
  const stock = product.stock_count;
  const dispatchDays = product.dispatch_days;
  const bulkTiers = Array.isArray(product.bulk_tiers) ? product.bulk_tiers : [];
  const showBulkTiers = isWholesaleModeOn(listing) && bulkTiers.length > 0;
  const ref = refNumber(product);

  return (
    <main className="flex flex-1 flex-col bg-white pb-32 md:pb-0">
      <XratedHeader />
      <section className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
        <a
          href={`/${listing.slug}/shop`}
          className="inline-flex h-11 items-center gap-1 text-[13px] font-bold text-neutral-500 transition hover:text-neutral-900"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to {firstName}&rsquo;s shop
        </a>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pt-2 sm:px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
          {/* LEFT — gallery */}
          <div>
            <ProductPageGallery product={product} />
          </div>

          {/* RIGHT — buy column */}
          <div className="flex flex-col gap-4">
            <div>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-900"
                style={{ background: "#FFB300" }}
              >
                {category}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
              {product.name}
            </h1>
            <p className="text-[13px] font-bold text-neutral-500">
              Ref: <span className="font-mono text-neutral-700">{ref}</span>
            </p>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-extrabold text-neutral-900 sm:text-4xl">
                {formatGbp(product.price_pence)}
              </span>
              {showBulkTiers && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[13px] font-extrabold"
                  style={{ background: "#FFB30022", color: "#0A0A0A", borderColor: "#FFB300" }}
                >
                  Bulk tiers below
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <StockPill stock={stock} />
              {typeof dispatchDays === "number" && dispatchDays > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 font-bold text-neutral-700">
                  Ships in {dispatchDays} {dispatchDays === 1 ? "day" : "days"}
                </span>
              )}
            </div>

            {/* Bulk tiers (if Wholesale Mode is on AND tiers present). */}
            {showBulkTiers && <BulkTierTable tiers={bulkTiers} currentQty={1} />}

            <ProductPageAddToCart
              product={product}
              slug={listing.slug}
              themeColor={themeColor}
            />

            {product.description && (
              <div className="rounded-xl border border-neutral-200 bg-white p-4">
                <p
                  className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
                  style={{ color: "#FFB300" }}
                >
                  About this product
                </p>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
                  {product.description}
                </p>
              </div>
            )}

            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-[13px] font-extrabold text-neutral-900 sm:text-sm">
                Sold by {listing.display_name}
              </p>
              <p className="mt-1 text-[13px] text-neutral-500">
                {tradeLabel(listing.primary_trade)} · {listing.city}
              </p>
              <a
                href={`/${listing.slug}`}
                className="mt-3 inline-flex h-11 items-center gap-1 text-[13px] font-extrabold text-neutral-900 underline-offset-4 hover:underline"
              >
                View profile
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {siblings.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            You might also like
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-neutral-900 sm:text-2xl">
            More from {firstName}
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {siblings.map((s) => (
              <li key={s.id}>
                <ProductCardLink product={s} slug={listing.slug} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-auto">
        <XratedFooter />
      </div>

      {/* Sticky cart island. */}
      <div aria-hidden="true" className="h-[72px]" />
      <ShopCartIsland slug={listing.slug} />
    </main>
  );
}

function StockPill({ stock }: { stock: number | null }) {
  if (stock === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[13px] font-bold text-neutral-700">
        Available on enquiry
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
  if (stock <= 5) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-extrabold text-white" style={{ background: "#F97316" }}>
        Only {stock} left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-extrabold text-neutral-900" style={{ background: "#FFB300" }}>
      In stock
    </span>
  );
}
