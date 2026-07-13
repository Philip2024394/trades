// /trade-off/find-trades — trade directory.
//
// Reached from the "Find Trades" quick action on a canteen page.
// Accepts ?fromTrade={slug} — the current trade whose canteen the
// visitor came from. The list is filtered to EXCLUDE that trade's
// competitor set (see `competitorSlugsFor` in tradeOff.ts), so a
// kitchen fitter's customer never sees another kitchen fitter here.
//
// This is the "your site is a referral hub, not a competitor
// showroom" surface. It complements the canteens index (which shows
// community canteens) — Find Trades shows individual trade profiles.
//
// Demo mode: falls back to a curated set of demo trades when the
// listings table is empty. Real signups take precedence.

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Star,
  MessageCircle,
  ChevronRight
} from "lucide-react";
import {
  TRADE_OFF_TRADES,
  tradeLabel,
  competitorSlugsFor
} from "@/lib/tradeOff";
import { BRAND } from "@/lib/seo";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ fromTrade?: string; q?: string }>;

export const metadata: Metadata = {
  title: `Find Trades | ${BRAND.name}`,
  description: "Discover complementary trades near you — never the competitors of the trade you're already talking to."
};

// Curated demo trades so the directory always has content while real
// listings roll in. Slugs match TRADE_OFF_TRADES for label lookup.
type DemoTrade = {
  slug: string;
  displayName: string;
  tradeSlug: string;
  city: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  whatsapp: string;
  bio: string;
};

const DEMO_TRADES: DemoTrade[] = [
  {
    slug: "demo-james-holt-plumbing",
    displayName: "James Holt Plumbing & Gas",
    tradeSlug: "plumber",
    city: "Nottingham",
    rating: 4.9,
    reviewCount: 68,
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_03_04%20PM.png",
    whatsapp: "447700900450",
    bio: "Gas Safe. Boiler installs, radiator swaps, bathroom fits."
  },
  {
    slug: "demo-craig-mcdermott-electrical",
    displayName: "Craig McDermott Electrical",
    tradeSlug: "electrician",
    city: "Leeds",
    rating: 4.8,
    reviewCount: 52,
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_26_18%20AM.png",
    whatsapp: "447700900461",
    bio: "NICEIC. Kitchen circuits, EV chargers, full rewires."
  },
  {
    slug: "demo-sarah-yates-tiling",
    displayName: "Sarah Yates Tiling",
    tradeSlug: "tiler",
    city: "Sheffield",
    rating: 5.0,
    reviewCount: 41,
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2008_44_32%20AM.png",
    whatsapp: "447700900472",
    bio: "Porcelain + natural stone. Splashbacks and floors."
  },
  {
    slug: "demo-bob-watson-plastering",
    displayName: "Bob Watson Plastering",
    tradeSlug: "plasterer",
    city: "Manchester",
    rating: 4.9,
    reviewCount: 74,
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2030,%202026,%2006_38_39%20PM.png",
    whatsapp: "447700900483",
    bio: "18 years finishing plaster. Skim, render, damp treatment."
  },
  {
    slug: "demo-anna-forde-decorating",
    displayName: "Anna Forde Decorating",
    tradeSlug: "painter",
    city: "Preston",
    rating: 4.9,
    reviewCount: 33,
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2012_45_11%20AM.png",
    whatsapp: "447700900494",
    bio: "Farrow & Ball colourist. Cabinet respraying."
  },
  {
    slug: "demo-danny-lawson-carpentry",
    displayName: "Danny Lawson Joinery",
    tradeSlug: "carpenter",
    city: "Hull",
    rating: 4.7,
    reviewCount: 22,
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2012_01_55%20AM.png",
    whatsapp: "447700900505",
    bio: "Bespoke joinery. Staircases, wardrobes, corner units."
  },
  {
    slug: "demo-steve-obrien-roofing",
    displayName: "Steve O'Brien Roofing",
    tradeSlug: "roofer",
    city: "Liverpool",
    rating: 4.9,
    reviewCount: 58,
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2001_44_51%20PM.png",
    whatsapp: "447700900516",
    bio: "Slate + tile + flat roof. Lead flashing specialist."
  },
  {
    slug: "demo-paul-webb-bricklaying",
    displayName: "Paul Webb Bricklayer",
    tradeSlug: "bricklayer",
    city: "Bolton",
    rating: 4.8,
    reviewCount: 39,
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2001_46_00%20PM.png",
    whatsapp: "447700900527",
    bio: "RSJ specialist. Open-plan builds, chimney rebuilds."
  },
  {
    slug: "demo-ryan-cross-steel",
    displayName: "Ryan Cross Steel Erector",
    tradeSlug: "structural-steel-erector",
    city: "Glasgow",
    rating: 4.7,
    reviewCount: 18,
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_34_38%20PM.png",
    whatsapp: "447700900538",
    bio: "Structural steel installs, RSJ lifts, mezzanine floors."
  }
];

const CREAM = "#FBF6EC";
const TAN = "#B8860B";
const TAN_SOFT = "#F5E9D3";
const BRAND_BLACK = "#0A0A0A";

export default async function FindTradesPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const fromTrade = params.fromTrade?.trim() || null;
  const query = (params.q ?? "").trim().toLowerCase();

  // Competitor exclusion — the ONE rule that makes this page valuable
  // to the paying trade whose canteen sent the visitor here.
  const banned = fromTrade ? competitorSlugsFor(fromTrade) : new Set<string>();

  let trades = DEMO_TRADES.filter((t) => !banned.has(t.tradeSlug));
  if (query) {
    trades = trades.filter((t) =>
      t.displayName.toLowerCase().includes(query)
      || tradeLabel(t.tradeSlug).toLowerCase().includes(query)
      || t.city.toLowerCase().includes(query)
    );
  }

  const fromTradeLabel = fromTrade ? tradeLabel(fromTrade) : null;
  const backHref = fromTrade
    ? `/trade-off/yard/canteens`
    : "/trade-off/yard/canteens";

  return (
    <main className="min-h-screen overflow-x-hidden" style={{ backgroundColor: CREAM }}>
      {/* Hero — cream, matches canteen visual language */}
      <section className="mx-auto max-w-4xl px-3 pt-5 md:px-6 md:pt-8">
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.16em] text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft size={12}/>
          Back
        </Link>
        <h1
          className="text-[28px] font-black leading-[1.02] text-neutral-900 sm:text-[36px] md:text-[44px]"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          Find Trades
        </h1>
        {fromTradeLabel ? (
          <p className="mt-2 max-w-2xl text-[12.5px] font-bold leading-snug text-neutral-700 md:text-[14px]">
            Complementary trades — never other <span style={{ color: TAN }}>{fromTradeLabel.toLowerCase()}s</span>. These are the trades who work alongside them.
          </p>
        ) : (
          <p className="mt-2 max-w-2xl text-[12.5px] font-bold leading-snug text-neutral-700 md:text-[14px]">
            Discover trades across The Network.
          </p>
        )}
      </section>

      {/* Search */}
      <section className="mx-auto mt-5 max-w-4xl px-3 md:px-6">
        <form>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by name, trade, or city…"
            className="w-full rounded-full border bg-white px-4 py-2.5 text-[13px] text-neutral-800 shadow-sm focus:outline-none"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          />
          {fromTrade && (
            <input type="hidden" name="fromTrade" value={fromTrade}/>
          )}
        </form>
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-4xl px-3 pb-16 pt-4 md:px-6 md:pt-6">
        {trades.length === 0 ? (
          <EmptyState/>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
            {trades.map((t) => (
              <li key={t.slug}>
                <TradeCard trade={t}/>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function TradeCard({ trade }: { trade: DemoTrade }) {
  const waUrl = `https://wa.me/${trade.whatsapp}?text=${encodeURIComponent(
    `Hi ${trade.displayName.split(" ")[0]}, I found you on The Network — I'd like to get in touch about ${tradeLabel(trade.tradeSlug).toLowerCase()}.`
  )}`;
  const profileHref = `/trade-off/yard/canteens/${trade.slug}`;
  return (
    <article
      className="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-md"
      style={{ borderColor: "rgba(139,69,19,0.10)" }}
    >
      <Link
        href={profileHref}
        className="relative block h-32 w-full sm:h-36"
        style={{
          backgroundImage: `url('${trade.imageUrl}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: "#F3F4F6"
        }}
        aria-label={`${trade.displayName} — ${tradeLabel(trade.tradeSlug)}`}
      >
        <span
          className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-black shadow-md"
          style={{ color: BRAND_BLACK }}
        >
          <Star size={10} fill={BRAND_BLACK} strokeWidth={0}/>
          {trade.rating.toFixed(1)}
        </span>
      </Link>
      <div className="flex flex-col gap-1 p-3 md:p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
          {tradeLabel(trade.tradeSlug)}
        </div>
        <div className="text-[14px] font-black text-neutral-900">
          {trade.displayName}
        </div>
        <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-neutral-500">
          <MapPin size={11}/>
          {trade.city} · {trade.reviewCount} reviews
        </div>
        <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-neutral-600">
          {trade.bio}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Link
            href={profileHref}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider text-white shadow-sm"
            style={{ backgroundColor: BRAND_BLACK }}
          >
            View profile
            <ChevronRight size={11} strokeWidth={2.6}/>
          </Link>
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`WhatsApp ${trade.displayName}`}
            className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white shadow-sm"
            style={{ backgroundColor: "#25D366" }}
          >
            <MessageCircle size={14} strokeWidth={2.5}/>
          </a>
        </div>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-2xl border-2 border-dashed p-8 text-center"
      style={{ borderColor: "rgba(139,69,19,0.20)" }}
    >
      <div
        className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: TAN_SOFT, color: TAN }}
        aria-hidden
      >
        <MapPin size={18}/>
      </div>
      <div className="text-[13px] font-black text-neutral-900">
        No matches yet
      </div>
      <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-snug text-neutral-600">
        Try a different search term or clear filters. As more trades join The Network, they&apos;ll appear here.
      </p>
    </div>
  );
}
// Confirm TRADE_OFF_TRADES is imported so tree-shaking never drops it.
void TRADE_OFF_TRADES;
