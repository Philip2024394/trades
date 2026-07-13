// /market — the customer-facing e-commerce marketplace.
//
// Fully public. Anyone can browse without an account. Every card lets
// the shopper:
//   • Enquire on WhatsApp (deep-links wa.me/<seller>?text=…)
//   • Add to cart (per-seller localStorage cart — the checkout at
//     /<seller-slug>/cart hands off to Stripe)
//   • Open the seller's shop (each trade has their own /market hub
//     mirrored at /<slug>/shop)
//
// This is the "shop everything" surface — separate from /trade-off/*
// (the business platform for trades). Trade-off surfaces are for
// managing a business; /market is for buying.

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ShoppingBag,
  Info,
  Eye,
  TrendingUp,
  SlidersHorizontal,
  Tag,
  Store,
  ChevronDown,
  MapPin
} from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tradeLabel } from "@/lib/tradeOff";
import { MarketplaceGrid, type MarketRow } from "./MarketplaceGrid";

export const dynamic = "force-dynamic";
export const revalidate = 60;

// Hero banner — user-supplied ImageKit URL. Recorded in
// scripts/hero-library.json under id `market-hero-2026-07-09`.
const MARKET_HERO_IMAGE =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%209,%202026,%2001_45_19%20AM.png";

export const metadata: Metadata = {
  title:
    "Thenetworkers — buy direct from UK trades on WhatsApp + Stripe",
  description:
    "Browse products and services from thousands of UK trades. Add to cart, pay with Stripe, or enquire on WhatsApp — direct with the trade, no middleman markup.",
  alternates: { canonical: "/market" },
  openGraph: {
    type: "website",
    title: "Thenetworkers — buy direct from UK trades",
    description:
      "Every product from every UK trade in one place. Cart to Stripe or WhatsApp handoff."
  }
};

async function loadMarketplace(): Promise<MarketRow[]> {
  // Pull live products from sellers whose storefront is switched on.
  // Two queries: sellers first (filtered by addons_enabled.shop_mode
  // OR wholesale_mode), then products in one shot. Server-side join —
  // no per-row round trips at render time.
  const { data: sellers } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, slug, display_name, trading_name, whatsapp, primary_trade, city, addons_enabled, tier, status"
    )
    .eq("status", "live")
    .limit(1000);
  const sellerMap = new Map<
    string,
    NonNullable<typeof sellers>[number]
  >();
  const eligibleIds: string[] = [];
  for (const s of sellers ?? []) {
    const addons =
      (s.addons_enabled as Record<string, unknown> | null) ?? {};
    if (addons.shop_mode !== true && addons.wholesale_mode !== true) continue;
    sellerMap.set(s.id, s);
    eligibleIds.push(s.id);
  }
  if (eligibleIds.length === 0) return [];

  const { data: products } = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select(
      "id, listing_id, kind, name, description, price_pence, cover_url, category, unit, stock_count, created_at"
    )
    .in("listing_id", eligibleIds)
    .order("created_at", { ascending: false })
    .limit(240);

  const rows: MarketRow[] = [];
  for (const p of products ?? []) {
    const seller = sellerMap.get(p.listing_id);
    if (!seller) continue;
    rows.push({
      productId: p.id,
      kind: p.kind,
      name: p.name,
      description: p.description ?? null,
      pricePence: p.price_pence,
      coverUrl: p.cover_url,
      category: p.category,
      unit: p.unit ?? null,
      stockCount: p.stock_count ?? null,
      sellerSlug: seller.slug,
      sellerName:
        seller.trading_name?.trim() || seller.display_name || "Trade",
      sellerTrade: tradeLabel(seller.primary_trade),
      sellerTradeSlug: seller.primary_trade,
      sellerCity: seller.city ?? null,
      sellerWhatsapp: (seller.whatsapp ?? "").replace(/\D/g, ""),
      sellerTier: seller.tier ?? null
    });
  }
  return rows;
}

export default async function MarketPage() {
  const rows = await loadMarketplace();
  const productCount = rows.filter((r) => r.kind === "product").length;
  const serviceCount = rows.filter((r) => r.kind === "service").length;
  const sellerCount = new Set(rows.map((r) => r.sellerSlug)).size;

  return (
    <main className="min-h-screen bg-[#FBF6EC] pb-24 text-[#1B1A17]">
      {/* Category strip — matches the reference hero mockup layout.
          Sits directly under the AppShell top bar. Postcode picker on
          the right is a placeholder for now (routes to Yard filter
          when live); category dropdowns are visual stubs until each
          taxonomy hub route lands. */}
      <nav
        aria-label="Marketplace categories"
        className="border-b border-[#1B1A17]/10 bg-[#FBF6EC]"
      >
        <div className="mx-auto flex w-full max-w-6xl items-center gap-1 px-3 py-3.5 md:px-8 md:py-4">
          <CategoryLink
            href="/market"
            icon={<Store className="h-4 w-4" aria-hidden />}
            label="Merchants"
            active
          />
          {/* Products + Services stay visible everywhere — they're the
              two primary browse axes. The rest get hidden on narrow
              viewports so the strip fits on one line without needing a
              scrollbar; from md+ the full nav is back. */}
          <CategoryLink href="/market?kind=product" label="Products" dropdown />
          <CategoryLink href="/market?kind=service" label="Services" dropdown />
          <span className="hidden md:contents">
            <CategoryLink href="/market?trade=plant-hire" label="Plant Hire" dropdown />
            <CategoryLink href="/market?deals=1" label="Deals" dropdown />
            <CategoryLink href="/market?tab=suppliers" label="Suppliers" dropdown />
            <CategoryLink href="/market?tab=brands" label="Brands" dropdown />
            <CategoryLink href="/trade-off/how" label="How it works" dropdown />
          </span>
          <span className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-full border border-[#1B1A17]/10 bg-white px-3.5 py-2 text-[13px] font-black text-[#1B1A17]/80 md:inline-flex">
            <MapPin className="h-4 w-4 text-amber-700" aria-hidden />
            Deliver to
            <span className="ml-1 rounded-md bg-[#FBF6EC] px-1.5 py-0.5 font-black tabular-nums text-[#1B1A17]">
              Any UK
            </span>
            <ChevronDown className="h-3 w-3 text-[#1B1A17]/50" aria-hidden />
          </span>
        </div>
      </nav>

      {/* Hero — mobile-first, full-bleed banner behind the copy.
          On mobile the scrim runs top-to-bottom so the image shows
          along the lower edge under the stats overlay; on desktop
          the scrim runs left-to-right so the image's subject stays
          fully visible on the right half. */}
      <section className="relative isolate overflow-hidden border-b border-[#1B1A17]/10 bg-[#FBF6EC]">
        {MARKET_HERO_IMAGE && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={MARKET_HERO_IMAGE}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover object-right md:object-center"
          />
        )}
        {/* Mobile scrim — vertical: dense cream over the copy, fades
            near the bottom so the image + stats overlay both breathe. */}
        <div
          aria-hidden
          className="absolute inset-0 md:hidden"
          style={{
            background:
              "linear-gradient(180deg, rgba(251,246,236,0.96) 0%, rgba(251,246,236,0.88) 50%, rgba(10,10,10,0.30) 100%)"
          }}
        />
        {/* Desktop scrim — horizontal: dense cream on the left where
            the text sits, transparent on the right so the banner's
            subject stays visible. */}
        <div
          aria-hidden
          className="absolute inset-0 hidden md:block"
          style={{
            background:
              "linear-gradient(90deg, rgba(251,246,236,0.94) 0%, rgba(251,246,236,0.82) 40%, rgba(251,246,236,0.35) 70%, rgba(251,246,236,0) 100%)"
          }}
        />

        {/* Content grid — single column on mobile (natural flow),
            2-col on desktop. Extra bottom padding leaves room for the
            stats overlay strip below. */}
        <div className="relative mx-auto grid w-full max-w-6xl gap-8 px-4 pb-28 pt-10 md:min-h-[460px] md:grid-cols-2 md:gap-10 md:px-8 md:pb-32 md:pt-20">
          <div className="flex flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[10.5px] font-black uppercase tracking-[0.20em] text-amber-800">
              <ShoppingBag className="h-3 w-3" aria-hidden />
              Thenetworkers Marketplace
            </span>
            <h1 className="mt-5 text-[30px] font-black leading-[1.05] tracking-tight text-[#1B1A17] sm:text-[38px] md:text-[52px]">
              Every UK trade.{" "}
              <span className="text-amber-500">One marketplace.</span>
            </h1>
            <p className="mt-4 max-w-[52ch] text-[14px] leading-[1.55] text-[#1B1A17]/75 md:text-[16px]">
              Browse products and services from trades across the country.
              Message on WhatsApp, add to cart, checkout with Stripe — you
              choose how to buy, and every pound goes direct to the trade.
            </p>

            <ul className="mt-6 flex flex-nowrap items-center justify-between gap-x-2 sm:gap-x-5 sm:justify-start">
              <HeroChip
                icon={<Eye className="h-4 w-4" aria-hidden />}
                label="Independent trades"
                shortLabel="Independent"
              />
              <HeroChip
                icon={<TrendingUp className="h-4 w-4" aria-hidden />}
                label="Live prices"
                shortLabel="Prices"
              />
              <HeroChip
                icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
                label="Filter by trade"
                shortLabel="Filter"
              />
              <HeroChip
                icon={<Tag className="h-4 w-4" aria-hidden />}
                label="No middleman fee"
                shortLabel="No fees"
              />
            </ul>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="#browse"
                className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-amber-400 px-5 text-[14px] font-black text-[#0A0A0A] shadow-sm transition hover:bg-amber-300"
              >
                Start browsing
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/trade-off/how"
                className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-[#1B1A17]/15 bg-white/90 px-5 text-[14px] font-black text-[#1B1A17] transition hover:border-[#1B1A17]/40 hover:bg-white"
              >
                See How It Works
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          {/* Right column is intentionally empty on desktop — the
              banner image behind the whole section fills the space via
              the transparent right edge of the desktop scrim. Hidden
              on mobile since the natural flow already stacks the copy
              full-width. */}
          <div aria-hidden className="hidden md:block" />
        </div>

        {/* Live counts overlay — sits ON the hero image at the
            bottom, with a 20% dark scrim behind the numbers for
            legibility. Container has left+right padding via the
            standard max-w-6xl + px-4 md:px-8 pattern. */}
        <div className="absolute inset-x-0 bottom-0 z-20">
          <div className="mx-auto w-full max-w-6xl px-4 pb-4 md:px-8 md:pb-6">
            <div className="flex items-center justify-around gap-4 rounded-2xl px-5 py-4 backdrop-blur-md md:gap-6 md:px-8 md:py-5"
              style={{ background: "rgba(10,10,10,0.20)" }}
            >
              <Stat label="Products live" value={productCount} />
              <Stat label="Services live" value={serviceCount} />
              <Stat label="Trades" value={sellerCount} />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 pt-8 md:px-8 md:pt-10">
        {rows.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-[#1B1A17]/15 bg-white px-6 py-12 text-center">
            <p className="text-[15px] font-black text-[#1B1A17]">
              No products live yet.
            </p>
            <p className="mt-2 text-[13px] text-[#1B1A17]/60">
              The first UK trades are wiring up their shops right now.
              Check back in a day, or list your own.
            </p>
            <Link
              href="/trade-off/sell"
              className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-amber-400 px-5 text-[13px] font-black text-[#0A0A0A] hover:bg-amber-300"
            >
              List your products
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </section>
        ) : (
          <>
            <MarketplaceGrid rows={rows} />

            <section
              className="mt-10 rounded-2xl border p-5"
              style={{
                borderColor: "rgba(27,26,23,0.10)",
                background: "white"
              }}
            >
              <div className="flex items-start gap-3">
                <Info
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#1B1A17]/60"
                  aria-hidden
                />
                <div>
                  <p className="text-[13px] font-black text-[#1B1A17]">
                    How Thenetworkers works
                  </p>
                  <p className="mt-1 text-[12.5px] leading-[1.5] text-[#1B1A17]/70">
                    Every product has two buy paths:{" "}
                    <b>WhatsApp Enquire</b> hands you straight to the
                    trade for stock check + arrangements, and{" "}
                    <b>Add to cart</b> collects everything on that
                    trade&apos;s cart page — checkout runs through
                    Stripe when the trade&apos;s connected. Cart is
                    per-seller: two lines from two different trades =
                    two carts (kept separate so you can pay each
                    independently).
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/75 drop-shadow-sm sm:text-[10.5px]">
        {label}
      </p>
      <p className="mt-0.5 text-[22px] font-black leading-none text-white tabular-nums drop-shadow-md sm:text-[26px]">
        {value.toLocaleString("en-GB")}
      </p>
    </div>
  );
}

function HeroChip({
  icon,
  label,
  shortLabel
}: {
  icon: React.ReactNode;
  label: string;
  /** Compact copy shown on narrow viewports so all chips stay on one
   *  row without scrolling. Defaults to the full label. */
  shortLabel?: string;
}) {
  return (
    <li className="inline-flex items-center gap-2 whitespace-nowrap text-[12.5px] font-semibold text-[#1B1A17]/80">
      <span
        aria-hidden
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
      >
        {icon}
      </span>
      <span className="sm:hidden">{shortLabel ?? label}</span>
      <span className="hidden sm:inline">{label}</span>
    </li>
  );
}

function CategoryLink({
  href,
  icon,
  label,
  active,
  dropdown
}: {
  href: string;
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  dropdown?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13.5px] transition ${
        active
          ? "font-black text-[#0A0A0A]"
          : "font-black text-[#1B1A17]/75 hover:bg-black/[0.04]"
      }`}
    >
      {icon && (
        <span
          aria-hidden
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
        >
          {icon}
        </span>
      )}
      {label}
      {dropdown && (
        <ChevronDown className="h-3 w-3 text-[#1B1A17]/45" aria-hidden />
      )}
    </Link>
  );
}
