// xratedtrades.com — the customer-facing showcase portal.
//
// Served at /find while the host-routing middleware is pending. When
// middleware ships, xratedtrades.com/ will serve this exact page.
//
// Positioning is critical: this is a SHOWCASE of paying Xrated members,
// not a directory. Every result is a real, live, premium app. The
// customer's only action is "tap a card → land on the tradesperson's
// app → use the tradesperson's WhatsApp button". We never insert a
// quote form, message routing or commission between the customer and
// the tradie — that's what makes this an app-seller business, not a
// lead-resale business.

import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { FindHeader } from "@/components/xrated/find/FindHeader";
import { FindFooter } from "@/components/xrated/find/FindFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TRADE_OFF_TRADES, tradeLabel } from "@/lib/tradeOff";
import { FindSearchBar } from "@/components/xrated/find/FindSearchBar";
import { type FindCardListing } from "@/components/xrated/find/FindResultCard";
import { FindResultRow } from "@/components/xrated/find/FindResultRow";

export const revalidate = 300;

export const metadata: Metadata = {
  title:
    "Find a UK trade with an Xrated app | xratedtrades.com",
  description:
    "See who has a live Xrated app near you. Bricklayer, plumber, electrician, scaffolder, drywaller, roofer — every result is a real tradesperson with a premium profile. Tap a card and talk to them direct on WhatsApp. No middleman, no quote form, no lead routing.",
  alternates: { canonical: "/find" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Find a UK trade with an Xrated app",
    description:
      "Every result is a real tradesperson's live app. Tap, land on their profile, WhatsApp them direct. No middleman.",
    url: absolute("/find")
  }
};

const VALID_TRADE_SLUGS = new Set(TRADE_OFF_TRADES.map((t) => t.slug));

type SearchParams = Promise<{
  trade?: string | string[];
  city?: string | string[];
  postcode?: string | string[];
  country?: string | string[];
}>;

// Map ISO 3166-1 alpha-2 codes to the human country label we store on
// the listings table. UK gets two codes because "GB" is the official
// ISO code but "UK" is what we put on demo seeds.
const COUNTRY_CODE_TO_LABEL: Record<string, string> = {
  GB: "UK",
  UK: "UK",
  IE: "Ireland",
  US: "United States",
  AU: "Australia",
  NZ: "New Zealand",
  CA: "Canada",
  ZA: "South Africa",
  AE: "United Arab Emirates",
  SG: "Singapore"
};

// Display name used in copy: "Search across {label}." — keeps the
// article ("the UK", "the US", "the UAE") natural without forcing the
// reader to mentally insert it.
const COUNTRY_STRAP_LABEL: Record<string, string> = {
  GB: "the UK",
  UK: "the UK",
  IE: "Ireland",
  US: "the US",
  AU: "Australia",
  NZ: "New Zealand",
  CA: "Canada",
  ZA: "South Africa",
  AE: "the UAE",
  SG: "Singapore"
};

// Read the visitor's country from common edge-CDN headers. Cloudflare
// adds `cf-ipcountry`, Vercel adds `x-vercel-ip-country`. Local dev
// has neither, so we fall back to GB (UK).
async function detectCountry(): Promise<string> {
  try {
    const h = await headers();
    const fromCf = h.get("cf-ipcountry");
    if (fromCf && fromCf.length === 2) return fromCf.toUpperCase();
    const fromVercel = h.get("x-vercel-ip-country");
    if (fromVercel && fromVercel.length === 2) return fromVercel.toUpperCase();
  } catch {
    // headers() throws outside a request context — just default.
  }
  return "GB";
}

function readParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return (v ?? "").trim();
}

// Featured slate — surfaces when no filters are applied. Mike Watson
// leads (he's the reference profile with the richest data); the rest
// give a spread of trade + city diversity so a first-time visitor
// sees the portal isn't a one-trick pony.
const FEATURED_SLUGS: string[] = [
  "demo-mike-watson-drywall-manchester",
  "demo-billy-ahmed-scaffolder-birmingham",
  "demo-james-oconnor-electrical-london",
  "demo-sara-khan-plastering-birmingham",
  "demo-gary-singh-roofer-leicester",
  "demo-rachel-osullivan-joiner-glasgow"
];

const SELECT_COLS =
  "slug, display_name, trading_name, primary_trade, city, country, avatar_url, rating_avg, rating_count, years_in_trade, bio";

async function loadResults(opts: {
  trade: string;
  city: string;
  postcode: string;
  country: string;
}) {
  const countryLabel = COUNTRY_CODE_TO_LABEL[opts.country] ?? "UK";

  if (!opts.trade && !opts.city && !opts.postcode) {
    // No explicit filters — featured slate scoped to the country.
    //
    // UK: use the curated FEATURED_SLUGS ordering (Mike Watson leads,
    // hand-picked for trade/city diversity).
    // Other countries: live members in that country sorted by rating.
    // If the country has no live members yet, the empty state takes
    // over with the "Updating soon" message.
    if (countryLabel === "UK") {
      const res = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select(SELECT_COLS)
        .in("slug", FEATURED_SLUGS)
        .eq("status", "live");
      const rows = (res.data ?? []) as FindCardListing[];
      const byMap = new Map(rows.map((r) => [r.slug, r]));
      return FEATURED_SLUGS.map((s) => byMap.get(s)).filter(
        (r): r is FindCardListing => Boolean(r)
      );
    }
    const res = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select(SELECT_COLS)
      .eq("status", "live")
      .eq("country", countryLabel)
      .order("rating_avg", { ascending: false, nullsFirst: false })
      .order("rating_count", { ascending: false, nullsFirst: false })
      .limit(6);
    return (res.data ?? []) as FindCardListing[];
  }

  let q = supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(SELECT_COLS)
    .eq("status", "live")
    .eq("country", countryLabel)
    .order("rating_avg", { ascending: false, nullsFirst: false })
    .order("rating_count", { ascending: false, nullsFirst: false })
    .limit(24);

  if (opts.trade && VALID_TRADE_SLUGS.has(opts.trade)) {
    q = q.eq("primary_trade", opts.trade);
  }
  if (opts.city) q = q.ilike("city", `%${opts.city}%`);
  if (opts.postcode) {
    q = q.ilike("postcode_prefix", `${opts.postcode}%`);
  }

  const res = await q;
  return (res.data ?? []) as FindCardListing[];
}

async function loadMemberCountForCountry(countryLabel: string): Promise<number> {
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id", { count: "exact", head: true })
    .eq("status", "live")
    .eq("country", countryLabel);
  return res.count ?? 0;
}

export default async function FindPortalPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const trade = readParam(sp.trade);
  const city = readParam(sp.city);
  const postcode = readParam(sp.postcode);
  const detectedCountry = await detectCountry();
  const country = readParam(sp.country) || detectedCountry;
  // Filter chrome only flips on for explicit user-applied filters —
  // country defaulting from IP stays invisible so visitors feel "this
  // page knows where I am" rather than "search active".
  const hasFilter = Boolean(trade || city || postcode);

  const countryLabel = COUNTRY_CODE_TO_LABEL[country] ?? "UK";
  const countryStrap = COUNTRY_STRAP_LABEL[country] ?? COUNTRY_STRAP_LABEL.GB;

  const [results, totalMembers] = await Promise.all([
    loadResults({ trade, city, postcode, country }),
    loadMemberCountForCountry(countryLabel)
  ]);

  const tradeText = trade ? tradeLabel(trade) : "";

  return (
    <main className="bg-neutral-50 pb-24 md:pb-0">
      <FindHeader />

      {/* Hero — full-bleed background image with dark overlay for text
          legibility. Text + search bar overlay on top. Search bar still
          floats over the hero/results boundary at the bottom. */}
      <section className="relative overflow-hidden border-b border-neutral-200">
        {/* Background image — covers the entire hero */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2025,%202026,%2011_02_32%20AM.png?updatedAt=1782360173013"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Dark gradient overlay — left side darker for text contrast,
            fading to allow image detail to show through on the right. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.75) 45%, rgba(10,10,10,0.3) 100%)"
          }}
        />

        <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
          <p
            className="text-[13px] font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Find a trade
          </p>
          <h1
            className="mt-3 max-w-3xl text-4xl font-extrabold leading-[1.05] text-white sm:text-5xl md:text-6xl lg:text-7xl"
            style={{ textShadow: "0 4px 18px rgba(0,0,0,0.6)" }}
          >
            Find{" "}
            <span style={{ color: XRATED_BRAND.accent }}>Trades</span>{" "}
            Near You
          </h1>
          <p
            className="mt-3 text-sm font-extrabold uppercase tracking-[0.18em] text-white sm:text-base"
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}
          >
            Search across {countryStrap}.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-bold text-white sm:text-sm" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> {totalMembers.toLocaleString("en-GB")} live members in {countryLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> No middleman
            </span>
          </div>
        </div>
      </section>

      {/* Search bar — floats over the hero/results boundary, matched
          to the premium-app PremiumHero overlap (-mt-10 / -14) so the
          two heroes feel like part of the same design system. */}
      <section className="relative z-10 -mt-10 mb-2 px-4 sm:-mt-14 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Suspense fallback={null}>
            <FindSearchBar detectedCountry={detectedCountry} />
          </Suspense>
        </div>
      </section>

      {/* Results */}
      <section className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-10">
        {!hasFilter ? (
          <p className="text-[13px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
            Featured Xrated members
          </p>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
              {results.length === 0 ? "No matches yet" : `${results.length} member${results.length === 1 ? "" : "s"} found`}
            </h2>
            <p className="text-[13px] text-neutral-500 sm:text-sm">
              {tradeText && city
                ? `${tradeText.toLowerCase()} in ${city}`
                : tradeText
                  ? tradeText.toLowerCase()
                  : city
                    ? `in ${city}`
                    : postcode
                      ? `near ${postcode}`
                      : ""}
            </p>
          </div>
        )}

        {results.length === 0 ? (
          <NoResults trade={tradeText} city={city || postcode} />
        ) : (
          // Landscape rows for every view — featured slate and search
          // results both read like the same continuous list. Reinforces
          // the "this is a search site, not a catalogue" feel.
          <ul className="mt-4 divide-y divide-dashed divide-neutral-300">
            {results.map((r) => (
              <li key={r.slug}>
                <FindResultRow listing={r} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <FindFooter />
    </main>
  );
}

function NoResults({ trade, city }: { trade: string; city: string }) {
  return (
    <div className="mt-8 overflow-hidden rounded-2xl border-2 bg-white p-8 text-center sm:p-12" style={{ borderColor: `${XRATED_BRAND.accent}40` }}>
      <p
        className="text-[13px] font-extrabold uppercase tracking-[0.22em]"
        style={{ color: XRATED_BRAND.accent }}
      >
        Updating soon
      </p>
      <h3 className="mt-3 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
        Come back soon &mdash; data is being updated.
      </h3>
      <p className="mt-3 text-[13px] text-neutral-600 sm:text-sm">
        {trade || city
          ? `We&rsquo;re adding more ${trade ? trade.toLowerCase() + "s" : "members"}${city ? ` in ${city}` : ""} this week. Check back shortly.`
          : "New tradespeople are joining every day. Check back shortly."}
      </p>
    </div>
  );
}

function Dot({ accent = false }: { accent?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{
        background: accent ? XRATED_BRAND.accent : "rgba(255,255,255,0.6)"
      }}
    />
  );
}
