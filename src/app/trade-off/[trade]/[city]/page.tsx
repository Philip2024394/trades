import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabase, type HammerexTradeOffListing } from "@/lib/supabase";
import { BRAND, absolute, breadcrumbJsonLd, localBusinessJsonLd } from "@/lib/seo";
import { TRADE_OFF_TRADES, tradeLabel } from "@/lib/tradeOff";
import { XratedViewTracker } from "@/components/trade-off/XratedViewTracker";

export const revalidate = 300;

function titleCase(input: string): string {
  return input
    .split(/\s+|-/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

async function loadTradeCity(tradeSlug: string, citySlug: string) {
  if (!TRADE_OFF_TRADES.find((t) => t.slug === tradeSlug)) return null;
  const cityLower = decodeURIComponent(citySlug).toLowerCase();
  const orFilter = `primary_trade.eq.${tradeSlug},secondary_trades.cs.{${tradeSlug}}`;
  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("status", "live")
    .or(orFilter)
    .order("hammerex_standard_verified", { ascending: false })
    .order("joined_at", { ascending: false });
  const all = (res.data ?? []) as HammerexTradeOffListing[];
  return {
    cityLower,
    cityLabel: titleCase(cityLower),
    listings: all.filter((l) => l.city.toLowerCase() === cityLower)
  };
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ trade: string; city: string }>;
}): Promise<Metadata> {
  const { trade, city } = await params;
  if (!TRADE_OFF_TRADES.find((t) => t.slug === trade)) return { title: "Trade not found" };
  const label = tradeLabel(trade);
  const cityLabel = titleCase(decodeURIComponent(city));
  const title = `${label}s in ${cityLabel} — Xrated Trades`;
  const data = await loadTradeCity(trade, city);
  const n = data?.listings.length ?? 0;
  const description = n
    ? `${n} ${label.toLowerCase()}${n === 1 ? "" : "s"} in ${cityLabel} on Xrated Trades. Free WhatsApp quotation, Hammerex Standard verified pros first. Powered by Hammerex.`
    : `Looking for a ${label.toLowerCase()} in ${cityLabel}? List your trade free on Xrated Trades — powered by Hammerex.`;
  return {
    title,
    description,
    alternates: { canonical: `/trade-off/${trade}/${city}` },
    openGraph: {
      type: "website",
      title: `${title} | ${BRAND.name}`,
      description,
      url: absolute(`/trade-off/${trade}/${city}`),
      siteName: BRAND.name
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export default async function TradeOffCityPage({
  params
}: {
  params: Promise<{ trade: string; city: string }>;
}) {
  const { trade, city } = await params;
  const data = await loadTradeCity(trade, city);
  if (!data) notFound();
  const { cityLabel, listings } = data;
  const label = tradeLabel(trade);

  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", url: "/" },
    { name: "Trade Off", url: "/trade-off" },
    { name: label, url: `/trade-off/${trade}` },
    { name: cityLabel, url: `/trade-off/${trade}/${city}` }
  ]);

  return (
    <main>
      <XratedViewTracker page="trade_city" listingId={null} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      {listings.map((l) => (
        <script
          key={l.id}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localBusinessJsonLd(l, tradeLabel(l.primary_trade)))
          }}
        />
      ))}
      <XratedHeader />

      <nav className="mx-auto max-w-6xl px-4 pt-4 text-xs text-brand-muted" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li><a href="/" className="hover:text-brand-text">Home</a></li>
          <li>/</li>
          <li><a href="/trade-off" className="hover:text-brand-text">Trade Off</a></li>
          <li>/</li>
          <li><a href={`/trade-off/${trade}`} className="hover:text-brand-text">{label}</a></li>
          <li>/</li>
          <li className="text-brand-text">{cityLabel}</li>
        </ol>
      </nav>

      <section className="border-b border-brand-line">
        <div className="mx-auto max-w-5xl px-4 pb-8 pt-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#FFB300]">
            Xrated Trades
          </p>
          <h1 className="mt-3 text-2xl font-bold leading-tight text-brand-text sm:text-4xl">
            {label}s in {cityLabel}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-muted">
            {listings.length > 0 ? (
              <>
                {listings.length} live {listings.length === 1 ? "pro" : "pros"} — WhatsApp quotation, Hammerex Standard verified first.
              </>
            ) : (
              <>No {label.toLowerCase()}s listed in {cityLabel} yet. Be the first.</>
            )}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        {listings.length === 0 ? (
          <EmptyState trade={trade} tradeLabel={label} cityLabel={cityLabel} />
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

function EmptyState({
  trade,
  tradeLabel: tLabel,
  cityLabel
}: {
  trade: string;
  tradeLabel: string;
  cityLabel: string;
}) {
  const siblingTrades = TRADE_OFF_TRADES.filter((t) => t.slug !== trade).slice(0, 6);
  return (
    <div className="rounded-2xl border border-dashed border-brand-line bg-brand-surface p-8 sm:p-10">
      <p className="text-sm font-semibold text-brand-text">
        No {tLabel.toLowerCase()}s in {cityLabel} on Trade Off — yet.
      </p>
      <p className="mt-1 text-xs text-brand-muted">
        Are you a {tLabel.toLowerCase()} in {cityLabel}? List your trade — free, takes two minutes.
      </p>
      <a
        href="/trade-off/signup"
        className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#FFB300] px-5 text-xs font-bold text-white transition hover:bg-[#E5A500]"
      >
        List your trade here — free
      </a>
      <div className="mt-6 border-t border-brand-line pt-5">
        <p className="text-xs font-bold uppercase tracking-widest text-[#FFB300]">
          Try a nearby trade
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {siblingTrades.map((t) => (
            <li key={t.slug}>
              <a
                href={`/trade-off/${t.slug}`}
                className="inline-flex h-11 items-center rounded-full border border-brand-line bg-brand-surface px-4 text-xs font-semibold text-brand-text transition hover:border-[#FFB300] hover:text-[#FFB300]"
              >
                {t.label}s
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
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
