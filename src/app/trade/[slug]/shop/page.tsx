// Xrated Shop Mode Phase 3 — dedicated storefront page.
//
// Server shell at /<slug>/shop (exposed via next.config rewrite — the
// canonical public URL is /:slug/shop). Loads the listing, the first
// page of products (SSR for SEO + first-paint speed) and the filter
// facet counts, then hands off to <StorefrontBody> for the search +
// filter + load-more interactions.
//
// Gates: storefront only renders when the tradesperson is on a paid
// tier AND has shop_mode OR wholesale_mode on (isStorefrontOn). Anyone
// else gets redirected to the bare profile.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  supabase,
  type HammerexTradeOffListing,
  type HammerexXratedProduct
} from "@/lib/supabase";
import { absolute } from "@/lib/seo";
import { effectiveTier } from "@/lib/xratedTrades";
import { isStorefrontOn } from "@/lib/xratedAddons";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { ShopCartIsland } from "@/components/xrated/profile/ShopCartIsland";
import { StorefrontBody } from "@/components/xrated/profile/StorefrontBody";

export const revalidate = 60;

const PAGE_SIZE = 24;

async function loadListing(slug: string): Promise<HammerexTradeOffListing | null> {
  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  return (res.data ?? null) as HammerexTradeOffListing | null;
}

async function loadFirstPage(listingId: string): Promise<{
  products: HammerexXratedProduct[];
  total: number;
  has_more: boolean;
}> {
  const res = await supabase
    .from("hammerex_xrated_products")
    .select("*", { count: "exact" })
    .eq("listing_id", listingId)
    .eq("status", "live")
    .order("featured_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(0, PAGE_SIZE - 1);
  const products = (res.data ?? []) as HammerexXratedProduct[];
  const total = res.count ?? products.length;
  return {
    products,
    total,
    has_more: products.length < total
  };
}

async function loadFacets(listingId: string): Promise<{
  categories: { name: string; count: number }[];
  price_range: { min: number | null; max: number | null };
}> {
  const res = await supabase
    .from("hammerex_xrated_products")
    .select("category, price_pence")
    .eq("listing_id", listingId)
    .eq("status", "live");
  type Row = { category: string | null; price_pence: number };
  const rows = (res.data ?? []) as Row[];
  const counts: Record<string, number> = {};
  let priceMin: number | null = null;
  let priceMax: number | null = null;
  for (const r of rows) {
    const cat = (r.category ?? "").trim();
    if (cat.length > 0) counts[cat] = (counts[cat] ?? 0) + 1;
    if (typeof r.price_pence === "number") {
      if (priceMin === null || r.price_pence < priceMin) priceMin = r.price_pence;
      if (priceMax === null || r.price_pence > priceMax) priceMax = r.price_pence;
    }
  }
  return {
    categories: Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    price_range: { min: priceMin, max: priceMax }
  };
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) return { title: "Shop not found" };
  const firstName = listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const title = `${firstName}'s shop — products and prices | Xrated Trades`;
  const description = `Browse the full range of products from ${listing.display_name}, ${listing.city}. Search, filter and send an enquiry on WhatsApp.`;
  const url = absolute(`/${listing.slug}/shop`);
  return {
    title,
    description,
    alternates: { canonical: `/${listing.slug}/shop` },
    openGraph: {
      title,
      description,
      url,
      siteName: "Xrated Trades",
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export default async function StorefrontPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();

  const tier = effectiveTier(listing);
  const isPaid = tier === "app_trial" || tier === "app_paid";
  if (!isPaid || !isStorefrontOn(listing)) {
    redirect(`/${listing.slug}`);
  }

  const [page, facets] = await Promise.all([
    loadFirstPage(listing.id),
    loadFacets(listing.id)
  ]);

  const firstName = listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  // Possessive form — "Mike's", "James's". Keep it simple, English only.
  const possessive = `${firstName}'s`;

  return (
    <main className="flex flex-1 flex-col bg-white pb-20 md:pb-0">
      <XratedHeader />
      <section className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
        <a
          href={`/${listing.slug}`}
          className="inline-flex h-11 items-center gap-1 text-[13px] font-bold text-neutral-500 transition hover:text-neutral-900"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to {firstName}&rsquo;s profile
        </a>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pt-2 sm:px-6">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          {possessive.toUpperCase()} SHOP
        </p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
          {listing.display_name}&rsquo;s Shop
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] text-neutral-500 sm:text-sm">
          {page.total} product{page.total === 1 ? "" : "s"}. Send {firstName} an
          enquiry and they&rsquo;ll quote — no card payments in the app.
        </p>
      </section>

      <section className="mt-6 w-full">
        <StorefrontBody
          initialState={{
            slug: listing.slug,
            firstName,
            products: page.products,
            total: page.total,
            has_more: page.has_more,
            filter_counts: facets
          }}
        />
      </section>

      <div className="mt-auto">
        <XratedFooter />
      </div>

      {/* Sticky cart island — same component the bare profile uses. */}
      <div aria-hidden="true" className="h-[72px]" />
      <ShopCartIsland slug={listing.slug} />
    </main>
  );
}
