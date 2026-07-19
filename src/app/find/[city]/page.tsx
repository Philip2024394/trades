// /find/[city] — City-specific homeowner landing page.
//
// SEO-optimised local surface. The existing /find portal already
// supports `?city=` as a query param, but query params rank poorly
// on Google — path-based URLs (`/find/manchester`) do much better,
// which is what actually matters for homeowner discovery.
//
// Every supported city gets:
//   - Rich metadata (title / description / canonical / OG)
//   - LocalBusiness JSON-LD aggregate for structured data
//   - The same merchant-loading logic as the main /find portal
//   - Two clear CTAs: "Post a project in {city}" and "Trade in
//     {city}? Join the network"
//
// City param is validated against a whitelist so 404s don't leak
// arbitrary strings into search indexes.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, ShieldCheck, MessageCircle, Send } from "lucide-react";
import { FindHeader } from "@/components/xrated/find/FindHeader";
import { FindFooter } from "@/components/xrated/find/FindFooter";
import { FindResultRow } from "@/components/xrated/find/FindResultRow";
import { type FindCardListing } from "@/components/xrated/find/FindResultCard";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";
import { UK_CITY_BY_SLUG } from "@/lib/uk-cities";
import { SmartVisitorHook } from "@/components/homepage/SmartVisitorHook";

export const revalidate = 600;

// City catalog now lives in src/lib/uk-cities.ts — shared with sitemap.ts
// and /trade-off/[trade]/[city] so adding a city once unlocks every SEO
// surface for that city. Unknown slugs still 404 by design.
const SUPPORTED_CITIES = UK_CITY_BY_SLUG;

const SELECT_COLS =
  "slug, display_name, trading_name, primary_trade, city, country, avatar_url, rating_avg, rating_count, years_in_trade, bio, tier, verified_plus_status";

export async function generateMetadata({
  params
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const meta = SUPPORTED_CITIES[city];
  if (!meta) return { title: "City not found | Thenetworkers" };
  const title = `Verified UK trades in ${meta.displayName} | Thenetworkers.app`;
  const description = `Real ${meta.displayName} trades with live profiles — plumbers, electricians, kitchen fitters, plasterers, roofers, joiners. Every listing is a verified merchant. Contact them directly on WhatsApp. No middleman, no lead fees, no bidding wars.`;
  return {
    title,
    description,
    alternates: { canonical: `/find/${city}` },
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      title,
      description,
      url: absolute(`/find/${city}`),
      locale: "en_GB"
    }
  };
}

async function loadCityMerchants(city: string): Promise<FindCardListing[]> {
  // Case-insensitive match on the city column. Live merchants only.
  // Sort: verified/paid tiers first, then rating desc, then review
  // count desc. Free-tier merchants are still shown here because
  // this is a discovery surface, not the paid-only search on /find.
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(SELECT_COLS)
    .ilike("city", city)
    .eq("status", "live")
    .order("rating_avg", { ascending: false, nullsFirst: false })
    .order("rating_count", { ascending: false, nullsFirst: false })
    .limit(24);
  return (res.data ?? []) as FindCardListing[];
}

async function loadCityMerchantCount(city: string): Promise<number> {
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id", { count: "exact", head: true })
    .ilike("city", city)
    .eq("status", "live");
  return res.count ?? 0;
}

export default async function CityLandingPage({
  params,
  searchParams
}: {
  params: Promise<{ city: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { city } = await params;
  const _visitorParams = searchParams ? await searchParams : {};
  const meta = SUPPORTED_CITIES[city];
  if (!meta) notFound();

  const [merchants, totalCount] = await Promise.all([
    loadCityMerchants(meta.displayName),
    loadCityMerchantCount(meta.displayName)
  ]);

  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: `Verified UK trades in ${meta.displayName} — Thenetworkers.app`,
    description: `Directory of verified UK trades operating in ${meta.displayName}. Every listing is a real, live merchant with WhatsApp contact and reviews.`,
    areaServed: {
      "@type": "City",
      name: meta.displayName,
      containedInPlace: {
        "@type": "AdministrativeArea",
        name: meta.county
      }
    },
    url: absolute(`/find/${city}`),
    provider: {
      "@type": "Organization",
      name: BRAND.name,
      url: absolute("/")
    }
  };

  return (
    <main className="bg-neutral-50 pb-24 md:pb-0">
      <SmartVisitorHook searchParams={_visitorParams}/>
      <FindHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-neutral-200 bg-[#0A0A0A]">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <p
            className="text-[13px] font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            <MapPin size={12} strokeWidth={2.5} className="mr-1 inline-block"/>
            Trades in {meta.displayName}
          </p>
          <h1 className="mt-3 text-[32px] font-black leading-tight text-white sm:text-[42px] md:text-[48px]">
            Verified UK trades in{" "}
            <span style={{ color: XRATED_BRAND.accent }}>{meta.displayName}</span>.
          </h1>
          <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-white/80 sm:text-[15px]">
            Every profile below is a real merchant with a live app on Thenetworkers.app, covering {meta.regionLabel}. Tap a card, land on their page, contact them directly on WhatsApp. No middleman, no lead fees, no bidding — you talk to the trade, not to us.
          </p>

          {/* Trust bar */}
          <div className="mt-6 flex flex-wrap gap-4 text-[11px] font-black uppercase tracking-[0.14em] text-white/70 sm:text-[12px]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} strokeWidth={2.5} style={{ color: XRATED_BRAND.accent }}/>
              {totalCount} live trade{totalCount === 1 ? "" : "s"}
            </span>
            <span aria-hidden className="text-white/30">·</span>
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle size={14} strokeWidth={2.5} style={{ color: XRATED_BRAND.accent }}/>
              Direct WhatsApp — no forms
            </span>
            <span aria-hidden className="text-white/30">·</span>
            <span className="inline-flex items-center gap-1.5">
              Zero lead fees
            </span>
          </div>
        </div>
      </section>

      {/* Merchants list */}
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        {merchants.length === 0 ? (
          <div
            className="rounded-2xl border-2 border-dashed p-8 text-center"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
          >
            <div className="text-[16px] font-black text-neutral-900">
              We&apos;re still growing in {meta.displayName}.
            </div>
            <p className="mx-auto mt-2 max-w-md text-[12.5px] leading-relaxed text-neutral-600">
              No live trades in {meta.displayName} yet. If you&apos;re a trade in {meta.displayName}, this is a chance to be first on a new local surface.
            </p>
            <Link
              href={`/trade-off/signup?city=${encodeURIComponent(meta.displayName)}`}
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-full px-5 text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97]"
              style={{ backgroundColor: XRATED_BRAND.accent }}
            >
              Claim your spot
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {merchants.map((m) => (
              <FindResultRow key={m.slug} listing={m}/>
            ))}
          </div>
        )}
      </section>

      {/* Post-a-project CTA */}
      <section className="border-y bg-white" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div
              className="rounded-2xl border p-5 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
                Have a project in {meta.displayName}?
              </div>
              <h2 className="mt-1 text-[22px] font-black leading-tight text-neutral-900">
                Post it once. Matched trades reply.
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">
                Tell us what you&apos;re doing, when, and roughly what budget. We surface 1–5 matched trades in your postcode area. You pick who to talk to — everyone contacts you on WhatsApp. No bidding, no chase.
              </p>
              <Link
                href={`/project?city=${encodeURIComponent(meta.displayName)}`}
                className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-[13px] font-black uppercase tracking-wider text-white shadow-md transition active:scale-[0.97]"
                style={{ backgroundColor: "#166534" }}
              >
                <Send size={14} strokeWidth={2.5}/>
                Post a project
              </Link>
            </div>

            {/* Trade-side CTA */}
            <div
              className="rounded-2xl border p-5 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
                Trade in {meta.displayName}?
              </div>
              <h2 className="mt-1 text-[22px] font-black leading-tight text-neutral-900">
                Get your own app. Free forever.
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">
                Get your merchant page at <span className="font-black">thenetworkers.app/&#123;your-name&#125;</span>. Free tier: your URL, your profile, your WhatsApp. Never any commission on your jobs. Verified WhatsApp leads cost pennies, not pounds.
              </p>
              <Link
                href={`/trade-off/signup?city=${encodeURIComponent(meta.displayName)}`}
                className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97]"
                style={{ backgroundColor: XRATED_BRAND.accent }}
              >
                Claim my page
              </Link>
            </div>
          </div>
        </div>
      </section>

      <FindFooter />

      {/* LocalBusiness JSON-LD for structured data — helps Google
          understand this is a city-specific directory surface. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
    </main>
  );
}
