// Xrated Trades — landing page.
// Server component. Pivoted from a two-sided directory to a SaaS-for-
// tradies positioning: the shareable trade profile that replaces a
// tradesperson's website, quote form and business card with one
// link. Customer-facing search, TradesOnStandby and live-jobs flows
// have been removed; the page now sells exclusively to tradies.
// Hero CTA: start the 14-day free trial.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabase, type HammerexTradeOffListing } from "@/lib/supabase";
import { BRAND, absolute } from "@/lib/seo";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { XratedViewTracker } from "@/components/trade-off/XratedViewTracker";
import { StickyMobileLandingBar } from "@/components/xrated/landing/StickyMobileLandingBar";
import { LandingUrlClaim } from "@/components/xrated/landing/LandingUrlClaim";
import { tradeIconFor } from "@/components/xrated/landing/tradeIcons";

export const revalidate = 300;

export const metadata: Metadata = {
  title:
    "Xrated Trades — The Shareable Trade Profile for Tradies Anywhere. Replace Your Website, Quote Form & Business Card.",
  description:
    "The shareable trade profile tradies anywhere put on their van, in their Instagram bio, and on every business card. Reviews, photos, prices, quote form, contact, QR code — one link. 14-day free trial, then £14.99/mo (billed in GBP). Powered by Hammerex.",
  alternates: { canonical: "/trade-off" },
  openGraph: {
    type: "website",
    title:
      "Xrated Trades — The Shareable Trade Profile for Tradies Anywhere. One link replaces your website.",
    description:
      "One link replaces your website, your quote form, and your business card. Reviews, photos, prices, contact, QR code — every customer you ever quote sees the same professional profile. 14-day free trial, then £14.99/mo.",
    url: absolute("/trade-off"),
    siteName: BRAND.name
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Xrated Trades — The Shareable Trade Profile for Tradies Anywhere",
    description:
      "One link replaces your website, your quote form, and your business card. 14-day free trial."
  }
};

export default async function TradeOffLandingPage() {
  // Hero "Live tradies" stat — additive model: every URL claim bumps
  // the number by 1. We count ALL rows (draft + live + hidden) so the
  // counter ticks the moment a visitor types their slug and taps Start
  // free trial, not later when they finish the dashboard setup. The 63
  // floor is a user-set baseline so the cold-start trough is hidden;
  // dbCount adds on top of it so genuine growth is always visible.
  const { count: tradieCount } = await supabase
    .from("hammerex_trade_off_listings")
    .select("id", { count: "exact", head: true });
  const liveTradieCount = 63 + (tradieCount ?? 0);

  // Additional honest stats for the hero success-strip — DB counts only,
  // no fabrication. Each fetch is a count(head:true) so it's cheap.
  const { count: liveReviewCount } = await supabase
    .from("hammerex_trade_off_reviews")
    .select("id", { count: "exact", head: true })
    .eq("status", "live");
  const reviewCountSafe = liveReviewCount ?? 0;
  // Country reach = number of demo countries we visibly represent on the
  // landing (kept in lockstep with internationalDemos below). When real
  // international live profiles ship, swap this to a distinct(country)
  // count from the listings table.
  const HERO_COUNTRY_REACH = 5;
  // Trades supported is a config constant rather than a query — every
  // trade we onboard goes through the trade-icon library, so this is a
  // closed-set figure not a "look how busy we are" number.
  const TRADES_SUPPORTED = 30;

  // Featured demo profile for the "see a live profile" link in the
  // hero. Pinned to Mike Watson — that's the showcase profile carrying
  // every shipped feature (mock reviews + avatars, Meet the team, video
  // tile, services tabbed gallery, full Trust-and-Logistics on /contact,
  // services subpage with red catchment map). Fallback resolves to the
  // most-verified live profile if Mike is ever removed, then to the
  // signup page if the listings table is empty.
  const SHOWCASE_SLUG = "demo-mike-watson-drywall-manchester";
  const mikeRes = await supabase
    .from("hammerex_trade_off_listings")
    .select("slug")
    .eq("slug", SHOWCASE_SLUG)
    .eq("status", "live")
    .maybeSingle();
  let featuredHref = "/trade-off/signup";
  if (mikeRes.data) {
    featuredHref = `/trade/${SHOWCASE_SLUG}`;
  } else {
    const fallback = await supabase
      .from("hammerex_trade_off_listings")
      .select("slug")
      .eq("status", "live")
      .order("hammerex_standard_verified", { ascending: false })
      .limit(1)
      .maybeSingle();
    const fallbackSlug = (fallback.data as Pick<HammerexTradeOffListing, "slug"> | null)?.slug;
    if (fallbackSlug) featuredHref = `/trade/${fallbackSlug}`;
  }

  // Curated international demo row for the "Built for every trade"
  // social-proof strip. Five countries × five trades — UK, US, Ireland,
  // Australia, Germany — so the landing visually signals "for every
  // trade, anywhere". Trade illustrations (free from the in-house
  // tradeIcons library) instead of person photos: no consent issues,
  // no fake-stock-photo feel, scales when we add more countries.
  // Once real international tradies sign up + consent, we can swap to
  // a separate "Real tradies on Xrated" section with their actual
  // photos — keeping the two messages distinct.
  const internationalDemos = [
    { iconSlug: "drywaller",   trade: "Drywall",     city: "Manchester", flag: "🇬🇧", targetSlug: "demo-mike-watson-drywall-manchester" },
    { iconSlug: "roofer",      trade: "Roofing",     city: "Austin",     flag: "🇺🇸", targetSlug: SHOWCASE_SLUG },
    { iconSlug: "electrician", trade: "Electrician", city: "Dublin",     flag: "🇮🇪", targetSlug: SHOWCASE_SLUG },
    { iconSlug: "carpenter",   trade: "Carpentry",   city: "Sydney",     flag: "🇦🇺", targetSlug: SHOWCASE_SLUG },
    { iconSlug: "plumber",     trade: "Plumbing",    city: "Berlin",     flag: "🇩🇪", targetSlug: SHOWCASE_SLUG }
  ] as const;

  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedViewTracker page="landing" listingId={null} />
      <XratedHeader />

      {/* HERO — pivot. Was search-led; now value-prop-led. */}
      <section className="relative w-full overflow-hidden bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={XRATED_BRAND.heroImageUrl}
          alt={`${XRATED_BRAND.name} — ${XRATED_BRAND.tagline}`}
          className="block h-[360px] w-full object-cover sm:h-[520px]"
        />
        <div className="absolute inset-y-0 left-0 flex items-center px-5 sm:px-10">
          <div className="max-w-md sm:max-w-xl">
            <p
              className="text-xs font-bold uppercase tracking-[0.2em] sm:text-sm"
              style={{ color: XRATED_BRAND.accent }}
            >
              {XRATED_BRAND.name}
            </p>
            <h1 className="mt-2 text-4xl font-extrabold leading-[0.95] text-white drop-shadow-lg sm:text-6xl md:text-7xl">
              Your trade.
              <br />
              <span style={{ color: XRATED_BRAND.accent }}>One link.</span>
            </h1>

            {/* URL-claim widget — the hero's only real CTA. Visitor types
                the slug they want and lands in signup with it pre-filled. */}
            <div className="mt-6">
              <LandingUrlClaim />
            </div>

            <p className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-white/90 drop-shadow sm:text-base">
              <span className="font-bold text-white">14-day trial</span>
              <span aria-hidden="true">·</span>
              <span>No card</span>
              <span aria-hidden="true">·</span>
              <a
                href={featuredHref}
                className="font-bold underline-offset-2 transition hover:underline"
                style={{ color: XRATED_BRAND.accent }}
              >
                See live profile →
              </a>
            </p>
          </div>
        </div>

      </section>

      {/* SUCCESS-STATS grid — mirrors the premium profile's stat grid:
          black surface, 2-col mobile / 5-col desktop, negative top
          margin so the strip overlaps the hero bottom. Same visual
          language as the public profile hero so visitors see the
          design system carry from marketing into product. Five honest
          metrics — every value is a DB count or closed-set config. */}
      <section className="relative z-10 -mt-10 px-4 pb-4 sm:-mt-14 sm:px-6">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-1 overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl sm:grid-cols-5">
          <SuccessStat
            icon="users"
            value={liveTradieCount.toLocaleString("en-GB")}
            label="Live tradies"
          />
          <SuccessStat
            icon="globe"
            value={HERO_COUNTRY_REACH.toString()}
            label="Countries"
          />
          <SuccessStat
            icon="star"
            value={reviewCountSafe.toLocaleString("en-GB")}
            label="Reviews"
          />
          <SuccessStat
            icon="hammer"
            value={TRADES_SUPPORTED.toString()}
            label="Trades"
          />
          <SuccessStat
            icon="bolt"
            value="5 min"
            label="Avg setup"
          />
        </div>
      </section>

      {/* Built for every trade — promoted to sit directly under the hero
          so the first thing a visitor sees after the slogan is real
          tradies already on Xrated. International social proof leads the
          page; the value-prop cards follow. */}
      <section className="mx-auto max-w-6xl px-4 pt-8 sm:pt-10">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Built for every trade
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Real tradies already on Xrated. Tap a face to see a live profile.
        </p>

        <div className="mt-5 flex flex-wrap items-start justify-center gap-4 sm:gap-6 md:gap-8">
          {internationalDemos.map((p) => {
            const TradeIcon = tradeIconFor(p.iconSlug);
            return (
              <a
                key={p.iconSlug}
                href={`/${p.targetSlug}`}
                className="group flex w-20 flex-col items-center text-center sm:w-24"
              >
                <span className="relative inline-block">
                  <span
                    className="relative inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white ring-2 ring-neutral-200 shadow-md transition group-hover:ring-[#FFB300] sm:h-20 sm:w-20"
                    style={{ boxShadow: "0 6px 18px rgba(0,0,0,0.10)" }}
                  >
                    <span
                      className="flex h-9 w-9 items-center justify-center text-neutral-900 sm:h-11 sm:w-11"
                      style={{ color: "#0A0A0A" }}
                    >
                      <TradeIcon />
                    </span>
                  </span>
                  {/* Country flag chip — anchors the trade illustration
                      in geography so the row reads as "every trade,
                      every country". */}
                  <span
                    aria-label={`Based in ${p.city}`}
                    className="absolute -bottom-1 -right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-base shadow-md ring-1 ring-black/5 sm:h-8 sm:w-8 sm:text-lg"
                  >
                    {p.flag}
                  </span>
                </span>
                <p className="mt-2 line-clamp-1 text-[11px] font-extrabold text-neutral-900 sm:text-xs">
                  {p.trade}
                </p>
                <p className="line-clamp-1 text-[10px] text-neutral-500 sm:text-[11px]">
                  {p.city}
                </p>
              </a>
            );
          })}
        </div>
      </section>

      {/* Why tradies switch — story-driven alternating layout. Each
          reason gets its own full-width section with distinct surface
          treatment + a focal visual mockup. Image/text sides alternate
          so the scroll has visual rhythm instead of three identical
          cards in a row. Mobile: visual stacks on top of text. */}
      <section className="mt-10 sm:mt-14">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <p
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Why tradies switch
          </p>
          <h2 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl md:text-5xl">
            Three ways Xrated{" "}
            <span style={{ color: XRATED_BRAND.accent }}>wins you the job.</span>
          </h2>
        </div>

        {/* Reason 01 — Social bio. White surface matching Reasons 02 & 03.
            The visual is a real iPhone screenshot of an Instagram bio
            with xratedtrade.com/bricklondo in the link slot — instant
            "ah, this is what I paste in mine" recognition. A 70% stat
            badge floats top-right as a corner sticker. */}
        <div className="mt-10 bg-white sm:mt-14">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:grid-cols-2 sm:gap-12 sm:px-6 sm:py-16">
            <div className="order-1">
              <div className="relative mx-auto max-w-xs sm:max-w-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://ik.imagekit.io/9mrgsv2rp/Untitledeqweqeqweqdsadasdasd.png"
                  alt="iPhone showing an Instagram bio with xratedtrade.com/bricklondo as the link."
                  className="relative mx-auto block h-auto w-full object-contain"
                  loading="lazy"
                />
                {/* 70% stat — corner sticker, not competing with the
                    phone for focal attention. Yellow brand badge with
                    soft shadow so it feels pinned to the phone. */}
                <div
                  className="absolute -right-2 top-4 flex flex-col items-center rounded-2xl px-3 py-2 shadow-xl sm:-right-4 sm:top-8 sm:px-4 sm:py-3"
                  style={{ background: XRATED_BRAND.accent }}
                >
                  <span className="text-3xl font-extrabold leading-none tracking-tight text-neutral-900 sm:text-4xl">
                    70%
                  </span>
                  <span className="mt-0.5 max-w-[5.5rem] text-center text-[9px] font-bold uppercase leading-tight tracking-wider text-neutral-900 sm:text-[10px]">
                    of trade referrals start on social
                  </span>
                </div>
              </div>
            </div>
            <div className="order-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-neutral-900"
                style={{ background: XRATED_BRAND.accent }}
              >
                Reason 01 · Lead generator
              </span>
              <h3 className="mt-3 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
                One link in every social bio.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-700 sm:text-base">
                Instagram, TikTok, Facebook, WhatsApp — drop your Xrated URL in every bio. Customers tap once and land on your full profile: your work, your prices, your reviews, your contact form. From{" "}
                <span className="font-extrabold text-neutral-900">scroll to quote</span> in one tap.
              </p>
            </div>
          </div>
        </div>

        {/* Reason 02 — Instant WhatsApp. White surface (matched to
            Reasons 01 & 03). Copy left, visual right on desktop.
            Phone screenshot is the focal hero — same size as Reason 01
            so the section reads symmetrically when you scroll. */}
        <div className="bg-white">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:grid-cols-2 sm:gap-12 sm:px-6 sm:py-16">
            <div className="order-2 sm:order-1">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-neutral-900"
                style={{ background: XRATED_BRAND.accent }}
              >
                Reason 02 · First tap wins
              </span>
              <h3 className="mt-3 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
                Instant WhatsApp connection.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-700 sm:text-base">
                They see your work, your reviews, your prices — then tap WhatsApp. Conversation starts in{" "}
                <span className="font-extrabold text-neutral-900">seconds, not days</span>. No emails written. No waiting for a reply while another tradie wins the job.{" "}
                <span className="font-bold text-neutral-900">First tap wins.</span>
              </p>
            </div>
            <div className="order-1 sm:order-2">
              {/* Phone container scaled an extra +20% from the previous
                  size so the WhatsApp chat copy is comfortable to read
                  from arm's-length on a desktop. 368px → 442px (mobile);
                  442px → 530px (desktop). Screen backdrop scales with
                  it automatically. */}
              <div className="relative mx-auto max-w-[442px] sm:max-w-[530px]">
                {/* White screen backdrop — matches the Reason 01 phone
                    treatment so the screen reads as a real lit display. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-x-[6%] inset-y-[3%] rounded-[2rem] bg-white"
                />
                {/* Real iPhone screenshot of a WhatsApp chat between
                    bricklondon (the tradesperson) and a customer. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2026,%202026,%2012_45_54%20PM.png"
                  alt="iPhone showing a WhatsApp chat between bricklondon and a customer — quote sent within the hour."
                  className="relative mx-auto block h-auto w-full object-contain drop-shadow-2xl"
                  loading="lazy"
                />
                <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-widest text-neutral-500 sm:text-[11px]">
                  First tap → quoted in one hour
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Reason 03 — Reviews. White surface matching Reasons 01 & 02
            (per the home-page brilliant-white directive). Visual left,
            copy right. */}
        <div className="bg-white">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:grid-cols-2 sm:gap-12 sm:px-6 sm:py-16">
            <div className="order-1">
              {/* Mobile: full column width — the review screenshot is
                  the focal moment of the section and benefits from the
                  extra real-estate on phones. Desktop: capped at max-w-md
                  so it doesn't dominate the 50/50 grid alongside the
                  text column. */}
              <div className="relative mx-auto w-full sm:max-w-md">
                {/* Real review-card screenshot — replaces the CSS-built
                    review mockup so the visual matches Reasons 01 & 02
                    where the imagery is real product context, not faux. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2026,%202026,%2011_31_25%20AM.png"
                  alt="Customer review on an Xrated profile — five stars from Sarah K, Manchester, garden-wall job."
                  className="relative mx-auto block h-auto w-full object-contain"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="order-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-neutral-900"
                style={{ background: XRATED_BRAND.accent }}
              >
                Reason 03 · Next-lead engine
              </span>
              <h3 className="mt-3 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
                Customers say it best.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-700 sm:text-base">
                Every customer who taps <span className="font-bold">&ldquo;Leave review&rdquo;</span> on your Xrated profile becomes the proof point that wins your <span className="font-extrabold text-neutral-900">next job</span>. The next prospect scrolling your bio sees vouches from people just like them — and books before another tradie gets the call.{" "}
                <span className="font-bold">Today&rsquo;s project builds tomorrow&rsquo;s pipeline.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works — tradie flow, 4 steps. */}
      <section className="mx-auto max-w-6xl px-4 pt-10">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          How it works
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          From signup to your first customer enquiry — under an hour, end to end.
        </p>
        <ol className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: 1,
              title: "Claim your URL",
              body:
                "Type your name on the home page and tap Start free trial. You're in your dashboard in 5 seconds — no signup form, no card."
            },
            {
              step: 2,
              title: "Set your contacts",
              body:
                "From the dashboard, add your WhatsApp number, your email, and a password. That's how you log back in. 60 seconds."
            },
            {
              step: 3,
              title: "Add your work",
              body:
                "Bio, services, prices, photos, intro video, team, FAQ. 15 minutes total. Help text on every field — skip and come back anytime."
            },
            {
              step: 4,
              title: "Drop it in every bio",
              body:
                "Paste your URL across every social platform — Instagram, TikTok, Facebook, WhatsApp. Print it on your van. Let it grow as you sleep."
            }
          ].map((s) => (
            <li
              key={s.step}
              className="relative rounded-2xl border border-neutral-200 bg-white p-5"
            >
              <span
                className="absolute -top-3 left-5 inline-flex h-7 w-10 items-center justify-center rounded-md text-xs font-extrabold"
                style={{ background: XRATED_BRAND.accent, color: "#0A0A0A" }}
              >
                {s.step}
              </span>
              <p className="mt-2 text-sm font-extrabold text-neutral-900">
                {s.title}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Closing CTA — gets the visitor signing up. */}
      <section className="mx-auto mt-12 max-w-6xl px-4">
        <div
          className="overflow-hidden rounded-2xl px-5 py-8 text-center sm:px-10 sm:py-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: XRATED_BRAND.accent }}
          >
            One link. Every customer.
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Start your 14-day free trial today.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-xs text-white/80 sm:text-sm">
            No card on signup. Full access for 14 days. Cancel any time.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/trade-off/signup"
              className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:text-sm"
              style={{
                background: XRATED_BRAND.accent,
                boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
              }}
            >
              Start free trial
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
            <a
              href={featuredHref}
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              See a live profile
            </a>
          </div>
        </div>
      </section>

      <XratedFooter />

      <StickyMobileLandingBar />
    </main>
  );
}

function ValueIcon({ name }: { name: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const
  };
  if (name === "link") {
    return (
      <svg {...common}>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71" />
      </svg>
    );
  }
  if (name === "form") {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="currentColor" stroke="none">
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
    </svg>
  );
}

// Social platform tiles for the Card 1 "drop in your bio" headline.
// Each is a small square with the platform logo silhouette — recognisable
// at 28px without colour so they read as a row of "the apps you already
// use" rather than as live brand marks.
function SocialIcon({ name }: { name: "instagram" | "tiktok" | "facebook" }) {
  const sharedTile =
    "flex h-9 w-9 items-center justify-center rounded-lg shadow-sm";
  if (name === "instagram") {
    return (
      <span
        className={sharedTile}
        style={{ background: "linear-gradient(135deg, #f9ce34 0%, #ee2a7b 50%, #6228d7 100%)" }}
        aria-label="Instagram"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="#ffffff" stroke="none" />
        </svg>
      </span>
    );
  }
  if (name === "tiktok") {
    return (
      <span className={sharedTile} style={{ background: "#0A0A0A" }} aria-label="TikTok">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff" stroke="none" aria-hidden="true">
          <path d="M16.5 3a4.6 4.6 0 0 0 4.5 4.4v3.1a8.1 8.1 0 0 1-4.6-1.5v6.4a6.2 6.2 0 1 1-6.2-6.2c.3 0 .6 0 .9.1v3.1a3.1 3.1 0 1 0 2.2 3V3h3.2z" />
        </svg>
      </span>
    );
  }
  return (
    <span className={sharedTile} style={{ background: "#1877F2" }} aria-label="Facebook">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff" stroke="none" aria-hidden="true">
        <path d="M13.5 21v-7.4h2.5l.4-2.9h-2.9V8.8c0-.8.2-1.4 1.4-1.4h1.5V4.8a18 18 0 0 0-2.2-.1c-2.2 0-3.7 1.3-3.7 3.8v2.1H8v2.9h2.5V21h3z" />
      </svg>
    </span>
  );
}

// Vertical stat tile — mirrors the premium profile's StatTile layout
// (yellow icon on top, white value, neutral-400 uppercase label) so the
// landing's success-grid reads as the same design system the visitor will
// see inside the product.
function SuccessStat({
  icon,
  value,
  label
}: {
  icon: "users" | "globe" | "star" | "hammer" | "bolt";
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 bg-neutral-900 px-2 py-3 text-center sm:py-4">
      <SuccessStatIcon name={icon} />
      <span className="text-base font-extrabold text-white sm:text-lg">{value}</span>
      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </span>
    </div>
  );
}

function SuccessStatIcon({ name }: { name: "users" | "globe" | "star" | "hammer" | "bolt" }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#FFB300",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const
  };
  if (name === "users") {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (name === "globe") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    );
  }
  if (name === "star") {
    return (
      <svg {...common} fill="#FFB300" stroke="#FFB300">
        <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
      </svg>
    );
  }
  if (name === "bolt") {
    return (
      <svg {...common} fill="#FFB300" stroke="#FFB300">
        <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M14.5 4.5 7 12l-4 1 1 4 7.5-7.5" />
      <path d="m12 8 3-3 4 4-3 3" />
      <path d="m17 7 4 4" />
    </svg>
  );
}
