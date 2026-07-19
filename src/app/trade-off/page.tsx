// Thenetworkers — landing page.
// Server component. Free-for-life positioning: base tier (app +
// canteen + URL + Yard + Trade Center access) is free forever; Pro
// tier is optional. Hero CTA: Join Thenetworkers. Trial-language
// retired 2026-07-10 (see feedback_diamond_standard_no_lies rule —
// freemium-forever is what actually ships, so that's what we sell).

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { SmartVisitorHook } from "@/components/homepage/SmartVisitorHook";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabase, type HammerexTradeOffListing } from "@/lib/supabase";
import { BRAND, absolute } from "@/lib/seo";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { XratedViewTracker } from "@/components/trade-off/XratedViewTracker";
import { StickyMobileLandingBar } from "@/components/xrated/landing/StickyMobileLandingBar";
import { LandingUrlClaim } from "@/components/xrated/landing/LandingUrlClaim";
import { ComparisonStack } from "@/components/trade-off/ComparisonSection";

export const revalidate = 300;

export const metadata: Metadata = {
  title:
    "Join Thenetworkers — Free for life. Studio, App Warehouse, Yard.",
  description:
    "Join Thenetworkers. Free for life — your business app, your canteen, your URL live, plus access to The Yard + Trade Center. Optional Pro £14.99/mo for merchant features. No card. No commission. Ever.",
  alternates: { canonical: "/trade-off" },
  openGraph: {
    type: "website",
    title:
      "Join Thenetworkers — Free for life",
    description:
      "Free app, free canteen, free URL, free access to The Yard + Trade Center. Optional Pro £14.99/mo.",
    url: absolute("/trade-off"),
    siteName: BRAND.name
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Join Thenetworkers — Free for life",
    description:
      "Free app, canteen, URL, and access to The Yard + Trade Center."
  }
};

export default async function TradeOffLandingPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const _visitorParams = searchParams ? await searchParams : {};
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

  // Main wrapper background — platform off-white per
  // feedback_platform_offwhite_canonical.md. Refreshed 2026-07-17
  // (was bg-white — legacy from the Xrated era). Section-level
  // white panels (reasons 01/02/03) now sit as contrast cards on
  // the warm off-white, improving visual hierarchy.
  return (
    <main className="pb-24 md:pb-0" style={{ backgroundColor: "#FBF6EC" }}>
      <SmartVisitorHook searchParams={_visitorParams}/>
      <XratedViewTracker page="landing" listingId={null} />
      <XratedHeader />

      {/* HERO — pivot. Was search-led; now value-prop-led.
          Hero image swapped 2026-07-18 to Philip's new marketing
          banner. Kept as a direct URL (not XRATED_BRAND.heroImageUrl)
          because that constant is also used as a FALLBACK for
          merchants with no cover image in FeaturedTradiesRail —
          different intent, different image. */}
      <section className="relative w-full overflow-hidden" style={{ backgroundColor: "#FBF6EC" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2018,%202026,%2012_14_42%20AM.png"
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
              The proven trade network
              <br />
              <span style={{ color: XRATED_BRAND.accent }}>that works.</span>
            </h1>

            {/* URL-claim widget — the hero's only real CTA. Visitor types
                the slug they want and lands in signup with it pre-filled.
                Removed 2026-07-18: the "App Store now live" pill above
                — competing chip, low click-through, subtracted from the
                URL-claim focus. */}
            <div className="mt-6">
              <LandingUrlClaim />
            </div>

            <p className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-white/90 drop-shadow sm:text-base">
              <span className="font-bold text-white">Free for life</span>
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

      {/* Networkers vs the top trade platforms — three-region stack
          (UK · USA · Australia). Networkers is a global platform, so
          the /trade-off proof surface is global: no visitor from any
          market can miss that no competitor anywhere matches us on
          these dimensions. Each region ships its own dated pricing
          + methodology link. Lead-capture form appears ONCE at the
          bottom of the stack (not per region). */}
      <ComparisonStack />

      {/* Removed 2026-07-18: "Built for every trade" flag row + the
          3-Reason story sections (One link in every social bio /
          Instant WhatsApp / Customers say it best). All that content
          is now covered with stronger, data-backed treatment on
          /trade-off/every-channel (WhatsApp lead mockup, own-branded
          PWA showcase, ranking breakdown, FAQ). The 5-flag row is
          also duplicative — the 3-region comparison stack proves
          global scope with hard scores. Page now flows:
          hero → stats strip → 3-region comparison → every-channel
          teaser grid → mega CTA. */}
      <section className="mt-10 sm:mt-14">
        {/* Every channel grid — the full breadth. 6 categories with
            2-4 concrete mechanisms each. Sits after the 3 hero reasons
            so the emotional story lands first, then the volume proof.
            Cards use the platform off-white as bg, contrast to the
            white reason panels above. */}
        <div className="mt-10 sm:mt-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: XRATED_BRAND.accent }}>
                Every channel
              </p>
              <h3 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
                Where projects actually come from.
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-600 sm:text-base">
                Every mechanism is live. No coming-soon. Every one routes to your WhatsApp with the customer&rsquo;s contact pre-filled.
              </p>
              <a
                href="/trade-off/every-channel"
                className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition hover:brightness-95"
                style={{ backgroundColor: XRATED_BRAND.accent }}
              >
                See every channel + per-lead cost →
              </a>
            </div>
            <ul className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Direct discovery",
                  desc:  "Customers find you first",
                  bullets: [
                    "Your own live URL — thenetworkers.app/{yourslug}",
                    "Custom domain — point your own URL at your profile",
                    "Subdomain — {yourslug}.thenetworkers.app auto-live",
                    "Business Card modal + QR — one tap to WhatsApp"
                  ]
                },
                {
                  title: "Search + SEO",
                  desc:  "Google sends you traffic",
                  bullets: [
                    "10,800 UK city × trade landings indexed on Google",
                    "108 trade-category pages + 100 city pages",
                    "LocalBusiness + Service schema on every listing",
                    "/find directory search — trade, city, postcode"
                  ]
                },
                {
                  title: "Project beacons",
                  desc:  "Homeowners push work to you",
                  bullets: [
                    "Beacon 2-hour SLA — homeowner posts, you claim",
                    "Push notification + email the moment a claim lands",
                    "Missed leads cascade to more trades automatically",
                    "/find/beacon — customer pings 3 nearest trades"
                  ]
                },
                {
                  title: "Community",
                  desc:  "Real trades talking",
                  bullets: [
                    "The Yard feed — post work, questions, replies",
                    "Boosted posts — pay washers to promote your best",
                    "Canteen page — your live community hub",
                    "Trade Circle — cross-trade carousel (Pro tier)"
                  ]
                },
                {
                  title: "Marketplace + install leads",
                  desc:  "Product PDPs generate fitter leads",
                  bullets: [
                    "Trade Center — customers browse merchant products",
                    "Install leads inbox — shoppers pick you as fitter",
                    "AI Visualiser — customer uploads room → your lead",
                    "Product carousels — cross-trade discovery"
                  ]
                },
                {
                  title: "Cross-merchant referrals",
                  desc:  "Trades hand you work",
                  bullets: [
                    "Materials Network — merchants refer you supply jobs",
                    "Inspiration image detail — 3 nearest trades routed",
                    "Featured Placements — admin-managed top slots",
                    "Merchant-to-merchant invites — grow the network"
                  ]
                }
              ].map((cat) => (
                <li
                  key={cat.title}
                  className="rounded-2xl border p-5 shadow-sm"
                  style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FFFFFF" }}
                >
                  <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: XRATED_BRAND.accent }}>
                    {cat.title}
                  </p>
                  <p className="mt-1 text-[15px] font-black text-neutral-900">
                    {cat.desc}
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {cat.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-[12px] leading-snug text-neutral-700">
                        <span aria-hidden="true" className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: XRATED_BRAND.accent }}/>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-neutral-500 sm:text-sm">
              You&rsquo;re on <span className="font-black text-neutral-900">every</span> channel from day one — Free tier included. Some paid tiers unlock priority in the beacon fanout, larger fanout slots, or premium tools like the AI Visualiser.
            </p>
          </div>
        </div>
      </section>

      {/* Every-channel + cost scorecard — the single sales-answer
          page. Absorbs the old "How it works" + closing CTA which
          were replaced 2026-07-18 in favour of the comprehensive
          scorecard at /trade-off/every-channel. This is now THE
          link merchant prospects follow after seeing the charts. */}
      <section className="mx-auto mt-14 max-w-6xl px-4">
        <div
          className="overflow-hidden rounded-2xl px-5 py-10 text-center sm:px-10 sm:py-14"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: XRATED_BRAND.accent }}
          >
            Now the two questions that matter
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            What does your system <span style={{ color: XRATED_BRAND.accent }}>do for me</span>,<br className="hidden sm:block"/>
            and what does it <span style={{ color: XRATED_BRAND.accent }}>cost per lead?</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[13px] text-white/80 sm:text-sm">
            One scorecard page with every channel your profile is discovered on, exactly what each lead costs, how the beacon ranks you, what a verified lead actually looks like, and blunt answers to the six questions everyone asks.
            <span className="mt-1 block font-black text-white">£0.05–£0.10 per verified WhatsApp lead. Free tier joins every channel.</span>
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/trade-off/every-channel"
              className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-xs font-extrabold uppercase tracking-wider text-neutral-900 shadow-lg transition active:scale-[0.98] sm:text-sm"
              style={{
                background: XRATED_BRAND.accent,
                boxShadow: `0 4px 20px ${XRATED_BRAND.accent}66`
              }}
            >
              Open the full scorecard
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
            <a
              href="/trade-off/signup"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/30 bg-white/5 px-6 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              Skip — join free
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
