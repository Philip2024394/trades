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
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TRADE_OFF_TRADES, tradeLabel } from "@/lib/tradeOff";
import { FindSearchBar } from "@/components/xrated/find/FindSearchBar";
import { FindResultCard, type FindCardListing } from "@/components/xrated/find/FindResultCard";

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
}>;

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
  "slug, display_name, trading_name, primary_trade, city, country, avatar_url, rating_avg, rating_count, years_in_trade";

async function loadResults(opts: { trade: string; city: string; postcode: string }) {
  if (!opts.trade && !opts.city && !opts.postcode) {
    // No filters — return the featured slate in the order above.
    const res = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select(SELECT_COLS)
      .in("slug", FEATURED_SLUGS)
      .eq("status", "live");
    const rows = (res.data ?? []) as FindCardListing[];
    // Preserve FEATURED_SLUGS ordering.
    const byMap = new Map(rows.map((r) => [r.slug, r]));
    return FEATURED_SLUGS.map((s) => byMap.get(s)).filter(
      (r): r is FindCardListing => Boolean(r)
    );
  }

  let q = supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(SELECT_COLS)
    .eq("status", "live")
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

async function loadTotalMemberCount() {
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id", { count: "exact", head: true })
    .eq("status", "live");
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
  const hasFilter = Boolean(trade || city || postcode);

  const [results, totalMembers] = await Promise.all([
    loadResults({ trade, city, postcode }),
    loadTotalMemberCount()
  ]);

  const tradeText = trade ? tradeLabel(trade) : "";
  const headline = hasFilter
    ? buildSearchHeadline({ trade: tradeText, city, postcode, count: results.length })
    : "See who has an Xrated app near you.";

  return (
    <main className="bg-neutral-50 pb-24 md:pb-0">
      <XratedHeader />

      {/* Hero — black surface, yellow eyebrow + accent. */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-12 sm:px-6 sm:pb-14 sm:pt-16">
          <p
            className="text-[13px] font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            xratedtrades.com &middot; The customer portal
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            {hasFilter ? (
              headline
            ) : (
              <>
                See who has an{" "}
                <span style={{ color: XRATED_BRAND.accent }}>Xrated app</span>{" "}
                near you.
              </>
            )}
          </h1>
          {!hasFilter && (
            <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-white/80 sm:text-sm">
              Every result is a{" "}
              <span className="font-bold text-white">real tradesperson</span>{" "}
              with their own premium app &mdash; not a directory listing.
              Tap a card, land on their app, message them{" "}
              <span className="font-bold text-white">direct on WhatsApp</span>.
              We never sit between you and the trade. No quote forms, no
              lead routing, no middleman.
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/70 sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> {totalMembers.toLocaleString("en-GB")} live UK members
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Tap = the tradesperson&rsquo;s actual app
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> No middleman, no commission
            </span>
          </div>

          {/* Search bar — pulled up so it visually anchors the hero. */}
          <div className="mt-7">
            <Suspense fallback={null}>
              <FindSearchBar />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
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
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r) => (
              <li key={r.slug} className="h-full">
                <FindResultCard listing={r} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* "Why this isn't a directory" — the wedge explained. */}
      <section className="mx-auto max-w-5xl px-4 pt-14 sm:px-6 sm:pt-20">
        <div
          className="overflow-hidden rounded-2xl border-2 p-5 sm:p-8"
          style={{
            background: "#0A0A0A",
            borderColor: XRATED_BRAND.accent
          }}
        >
          <p
            className="text-[13px] font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Why this is different
          </p>
          <h2 className="mt-2 text-xl font-extrabold leading-tight text-white sm:text-2xl">
            Every result is a real app &mdash; not a listing.
          </h2>
          <ul className="mt-5 grid grid-cols-1 gap-3 text-[13px] text-white/85 sm:grid-cols-2 sm:text-sm">
            <li className="flex items-start gap-2.5">
              <Tick />
              <span>
                Tap a card and you land on the tradesperson&rsquo;s actual
                premium app &mdash; reviews, prices, photos, services.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Tick />
              <span>
                You message them{" "}
                <span className="font-bold text-white">direct on WhatsApp</span>{" "}
                using their button. We don&rsquo;t sit in the middle.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Tick />
              <span>
                No quote forms, no lead routing, no &ldquo;Three quotes
                will reach you in 24 hours.&rdquo; You pick one trade, you
                talk to that one trade.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Tick />
              <span>
                No commission, no &ldquo;featured&rdquo; ad slots.
                Results sort by completeness, distance and review
                quality &mdash; never by ad spend.
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* Closing CTA — for tradies. */}
      <section className="mx-auto mt-12 max-w-5xl px-4 pb-2 sm:px-6">
        <div
          className="overflow-hidden rounded-2xl px-5 py-8 text-center sm:px-10 sm:py-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-[13px] font-bold uppercase tracking-widest"
            style={{ color: XRATED_BRAND.accent }}
          >
            Tradesperson? Get listed here.
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Build your own Xrated app.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[13px] text-white/80 sm:text-sm">
            £14.99/mo. 14-day free trial, no card. Your premium profile
            goes live the moment you save &mdash; and you&rsquo;re
            auto-listed on xratedtrades.com so customers find you.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/trade-off/signup"
              className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.97] sm:text-sm"
              style={{
                background: XRATED_BRAND.accent,
                boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
              }}
            >
              Start 14-day trial
            </a>
            <a
              href="/trade-off/pricing"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 text-[13px] font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              See pricing
            </a>
          </div>
        </div>
      </section>

      <XratedFooter />
    </main>
  );
}

function buildSearchHeadline({
  trade,
  city,
  postcode,
  count
}: {
  trade: string;
  city: string;
  postcode: string;
  count: number;
}) {
  const where = city || postcode;
  const tradeText = trade.toLowerCase();
  if (count === 0) {
    return where
      ? `No ${tradeText || "members"} on Xrated in ${where} yet.`
      : `No matches yet.`;
  }
  if (trade && where) return `${count} ${tradeText}${count === 1 ? "" : "s"} on Xrated in ${where}.`;
  if (trade) return `${count} ${tradeText}${count === 1 ? "" : "s"} on Xrated.`;
  if (where) return `${count} member${count === 1 ? "" : "s"} on Xrated in ${where}.`;
  return `${count} member${count === 1 ? "" : "s"} on Xrated.`;
}

function NoResults({ trade, city }: { trade: string; city: string }) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
      <p
        className="text-[13px] font-bold uppercase tracking-widest"
        style={{ color: "#7A5300" }}
      >
        Nobody yet
      </p>
      <h3 className="mt-2 text-lg font-extrabold text-neutral-900">
        No {trade || "Xrated"} members in {city || "this area"} yet.
      </h3>
      <p className="mt-2 text-[13px] text-neutral-600">
        Our membership is growing &mdash; try a nearby city, or another
        trade. Or recommend Xrated to a tradie you know.
      </p>
      <a
        href="/trade-off/signup"
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.97]"
        style={{
          background: XRATED_BRAND.accent,
          boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
        }}
      >
        Get listed &rarr;
      </a>
    </div>
  );
}

function Tick() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={XRATED_BRAND.accent}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 shrink-0"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
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
