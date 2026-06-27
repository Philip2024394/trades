// Xrated Shop Mode Phase 3 — profile teaser.
//
// Server component. Replaces the inline ProductCardGrid block on the
// public profile when storefront is on (shop_mode OR wholesale_mode).
// Renders the yellow "SHOP" eyebrow + heading + up to 6 featured product
// tiles + a "Browse all →" link to the dedicated /<slug>/shop page.
//
// Card-tap behaviour: on this teaser the ProductCard opens the existing
// ProductModal (fast quick-view) because the customer is mid-scroll on
// the profile and a page-jump would lose context. The full storefront
// page swaps in a page-navigating variant (ProductCardLink) instead.
//
// Self-hides when the listing has zero live products — no empty
// "we sell nothing" container.

import {
  supabase,
  type HammerexTradeOffListing,
  type HammerexXratedProduct
} from "@/lib/supabase";
import { ProductCard } from "./ProductCard";

const FEATURED_LIMIT = 6;

async function loadTeaserData(listingId: string): Promise<{
  featured: HammerexXratedProduct[];
  total: number;
}> {
  // Featured rail — newest-featured first, then fall back to newest
  // overall so a listing with zero featured picks still shows the most
  // recent six rather than nothing. Single round-trip; we cap server-
  // side instead of fetching the full catalogue.
  const featuredRes = await supabase
    .from("hammerex_xrated_products")
    .select("*")
    .eq("listing_id", listingId)
    .eq("status", "live")
    .order("featured_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(FEATURED_LIMIT);
  const featured = (featuredRes.data ?? []) as HammerexXratedProduct[];

  // Totals — counted separately so the header reads accurately even
  // when the listing has >6 live products.
  const countRes = await supabase
    .from("hammerex_xrated_products")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId)
    .eq("status", "live");
  const total = countRes.count ?? featured.length;

  return { featured, total };
}

export async function ShopTeaser({
  listing
}: {
  listing: HammerexTradeOffListing;
}) {
  const { featured, total } = await loadTeaserData(listing.id);
  const firstName = listing.display_name.split(/\s+/)[0] ?? listing.display_name;

  if (featured.length === 0) {
    return <EmptyShopTeaser slug={listing.slug} firstName={firstName} whatsapp={listing.whatsapp} />;
  }

  const themeColor = listing.theme_color || "#FFB300";

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            Shop
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-neutral-900 sm:text-2xl">
            {total} product{total === 1 ? "" : "s"} from {firstName}
          </h2>
          <p className="mt-1 text-[13px] text-neutral-500 sm:text-sm">
            Add what you need to your cart and {firstName} will confirm the
            final price by WhatsApp. No card payments in the app.
          </p>
        </div>
        <a
          href={`/${listing.slug}/shop`}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border-2 px-4 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:h-12"
          style={{ borderColor: "#FFB300", background: "#FFB300" }}
          aria-label={`Browse all ${total} products in ${firstName}'s shop`}
        >
          Browse all
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </a>
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
        {featured.map((p) => {
          // Reuse the same "compare with siblings" logic the inline grid
          // used — populated from the tradesperson's hand-picked
          // compare_with array. The teaser card still routes to the
          // modal so we pass siblings through.
          const siblings = featured.filter(
            (s) => (p.compare_with ?? []).includes(s.id) && s.id !== p.id
          );
          return (
            <li key={p.id}>
              <ProductCard
                product={p}
                slug={listing.slug}
                siblings={siblings}
                themeColor={themeColor}
                acceptingJobs={Boolean(listing.accepting_jobs)}
                operatingHours={listing.operating_hours ?? null}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EmptyShopTeaser({
  slug,
  firstName,
  whatsapp
}: {
  slug: string;
  firstName: string;
  whatsapp: string;
}) {
  const digits = whatsapp.replace(/[^0-9]/g, "");
  const waHref = `https://wa.me/${digits}?text=${encodeURIComponent(
    `Hi ${firstName}, I found your shop on Xrated — could you share what you sell?`
  )}`;
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-12">
      <p
        className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
        style={{ color: "#FFB300" }}
      >
        Shop
      </p>
      <h2 className="mt-1 text-xl font-extrabold text-neutral-900 sm:text-2xl">
        Shop coming soon
      </h2>
      <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center sm:p-8">
        <p className="text-[13px] font-extrabold text-neutral-900 sm:text-sm">
          This trade is setting up their shop.
        </p>
        <p className="mt-1 text-[13px] text-neutral-500 sm:text-sm">
          Products will appear here soon — meanwhile send {firstName} a quick
          message.
        </p>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-5 text-[13px] font-extrabold uppercase tracking-wider text-white shadow-lg transition active:scale-[0.98] sm:text-sm"
          style={{ background: "#0F7A3F", boxShadow: "0 8px 22px rgba(15,122,63,0.45)" }}
          aria-label={`Send ${firstName} a WhatsApp message about their shop`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Z" />
          </svg>
          Send an enquiry on WhatsApp
        </a>
        <p className="mt-3 text-[11px] text-neutral-400">
          Profile: <span className="font-mono">/{slug}</span>
        </p>
      </div>
    </section>
  );
}
