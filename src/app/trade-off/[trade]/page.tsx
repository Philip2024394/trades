import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabase, type HammerexTradeOffListing } from "@/lib/supabase";
import { BRAND, absolute, breadcrumbJsonLd } from "@/lib/seo";
import { TRADE_OFF_TRADES, tradeLabel } from "@/lib/tradeOff";
import { tradeHeroFor } from "@/lib/tradeOffHeroes";
import { XratedViewTracker } from "@/components/trade-off/XratedViewTracker";

export const revalidate = 300;

async function loadTrade(slug: string) {
  if (!TRADE_OFF_TRADES.find((t) => t.slug === slug)) return null;
  // Pull live listings where the trade is either primary or secondary.
  // We OR via two filters since Supabase's array contains needs the cs operator.
  const orFilter = `primary_trade.eq.${slug},secondary_trades.cs.{${slug}}`;
  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("status", "live")
    .or(orFilter)
    .order("hammerex_standard_verified", { ascending: false })
    .order("joined_at", { ascending: false });
  return (res.data ?? []) as HammerexTradeOffListing[];
}

export async function generateMetadata({ params }: { params: Promise<{ trade: string }> }): Promise<Metadata> {
  const { trade } = await params;
  if (!TRADE_OFF_TRADES.find((t) => t.slug === trade)) return { title: "Trade not found" };
  const label = tradeLabel(trade);
  const title = `${label}s — Xrated Trades`;
  const description = `Find a ${label.toLowerCase()} on Xrated Trades. Free WhatsApp quotation. Verified Hammerex Standard tradies first. Powered by Hammerex.`;
  return {
    title,
    description,
    alternates: { canonical: `/trade-off/${trade}` },
    openGraph: {
      type: "website",
      title: `${title} | ${BRAND.name}`,
      description,
      url: absolute(`/trade-off/${trade}`),
      siteName: BRAND.name
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export default async function TradeOffByTradePage({ params }: { params: Promise<{ trade: string }> }) {
  const { trade } = await params;
  const listings = await loadTrade(trade);
  if (listings === null) notFound();
  const label = tradeLabel(trade);

  // Build dynamic city chips from the loaded set.
  const cityMap = new Map<string, { label: string; slug: string; count: number }>();
  for (const l of listings) {
    const slug = l.city.toLowerCase();
    const ex = cityMap.get(slug);
    if (ex) ex.count += 1;
    else cityMap.set(slug, { label: l.city, slug, count: 1 });
  }
  const cities = Array.from(cityMap.values()).sort((a, b) => a.label.localeCompare(b.label));

  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", url: "/" },
    { name: "Trade Off", url: "/trade-off" },
    { name: label, url: `/trade-off/${trade}` }
  ]);

  return (
    <main>
      <XratedViewTracker page="trade_filter" listingId={null} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <XratedHeader />

      {tradeHeroFor(trade) && (
        <section className="relative bg-black">
          <div className="relative h-48 w-full overflow-hidden sm:h-64 md:h-80">
            <img
              src={tradeHeroFor(trade) as string}
              alt={`${label}s on Xrated Trades`}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/0" />
            <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-5">
              <p className="text-xs font-bold uppercase tracking-widest text-[#FFB300]">
                Xrated Trades
              </p>
              <h1 className="mt-1.5 text-2xl font-extrabold leading-tight text-white drop-shadow-md sm:text-3xl">
                {label}s on Xrated Trades
              </h1>
            </div>
          </div>
        </section>
      )}

      <nav className="mx-auto max-w-6xl px-4 pt-4 text-xs text-brand-muted" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li><a href="/" className="hover:text-brand-text">Home</a></li>
          <li>/</li>
          <li><a href="/trade-off" className="hover:text-brand-text">Trade Off</a></li>
          <li>/</li>
          <li className="text-brand-text">{label}</li>
        </ol>
      </nav>

      <section className="border-b border-brand-line">
        <div className="mx-auto max-w-5xl px-4 pb-8 pt-6">
          {!tradeHeroFor(trade) && (
            <>
              <p className="text-xs font-bold uppercase tracking-widest text-[#FFB300]">
                Xrated Trades
              </p>
              <h1 className="mt-3 text-2xl font-bold leading-tight text-brand-text sm:text-4xl">
                {label}s on Xrated Trades
              </h1>
            </>
          )}
          <p className={tradeHeroFor(trade) ? "max-w-2xl text-sm leading-relaxed text-brand-muted" : "mt-3 max-w-2xl text-sm leading-relaxed text-brand-muted"}>
            {listings.length} live {listings.length === 1 ? "tradie" : "tradies"} — free WhatsApp quotation, verified Hammerex Standard tradies first.
          </p>
          <div className="mt-5">
            <a
              href="/trade-off/signup"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#FFB300] px-5 text-xs font-bold text-white transition hover:bg-[#E5A500]"
            >
              List your trade (free)
            </a>
          </div>
        </div>
      </section>

      {cities.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#FFB300]">
            Filter by city
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {cities.map((c) => (
              <li key={c.slug}>
                <a
                  href={`/trade-off/${trade}/${encodeURIComponent(c.slug)}`}
                  className="inline-flex h-11 items-center rounded-full border border-brand-line bg-brand-surface px-4 text-xs font-semibold text-brand-text transition hover:border-[#FFB300] hover:text-[#FFB300]"
                >
                  {c.label}
                  <span className="ml-2 text-brand-muted">{c.count}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        {listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-brand-line bg-brand-surface p-10 text-center">
            <p className="text-sm font-semibold text-brand-text">
              No {label.toLowerCase()}s listed yet — be the first.
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              List your trade in under two minutes. Free for life.
            </p>
            <a
              href="/trade-off/signup"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#FFB300] px-5 text-xs font-bold text-white transition hover:bg-[#E5A500]"
            >
              List your trade (free)
            </a>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <li key={l.id}>
                <ListingCard listing={l} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <XratedFooter />
    </main>
  );
}

function ListingCard({ listing }: { listing: HammerexTradeOffListing }) {
  const photo = listing.photos[0] ?? listing.avatar_url ?? BRAND.logo;
  const primary = tradeLabel(listing.primary_trade);
  const initial = (listing.display_name.charAt(0) || "?").toUpperCase();
  return (
    <a
      href={`/trade/${listing.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-brand-line bg-brand-surface transition hover:border-[#FFB300]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
        <img
          src={photo}
          alt={listing.display_name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
        />
        {listing.hammerex_standard_verified && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#FFB300] px-2.5 py-1 text-xs font-bold text-white shadow-lg">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
            Standard
          </span>
        )}
        <div className="absolute bottom-3 left-3 h-14 w-14 overflow-hidden rounded-full border-2 border-brand-bg bg-brand-surface shadow-lg">
          {listing.avatar_url ? (
            <img
              src={listing.avatar_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#FFB300] text-base font-bold text-white">
              {initial}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-semibold text-brand-text group-hover:text-[#FFB300]">
          {listing.display_name}
        </h3>
        {listing.trading_name && (
          <p className="mt-0.5 text-xs text-brand-muted">{listing.trading_name}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-brand-line bg-brand-surface px-2.5 py-1 text-xs font-semibold text-brand-text">
            {primary}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-brand-muted">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {listing.city}
          </span>
        </div>
      </div>
    </a>
  );
}
