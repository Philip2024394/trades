// Xrated Trades — "Trade Examples" gallery.
// HIGH-INTENT page: a visitor arrives wanting to see what a real
// Xrated Trades profile looks like for THEIR trade. Eight trade cards
// (Carpenter, Bricklayer, Plumber, Scaffolder, Electrician, Drywaller,
// Stone Mason, Tiler) each render a landscape banner image — the same
// art a tradesperson of that trade gets as a default hero on their own
// profile if they don't upload a custom_app_hero_url.
//
// Every card "View profile" link points at the live demo profile
// (mike-watson-drywall-manchester) for now — when more demo profiles
// ship we swap each card's href independently.
//
// Server component. Matches the /trade-off/pricing design language:
// XratedHeader top, black hero with yellow accent, max-w-5xl body,
// 13px text floor, XratedFooter bottom.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";
import { tradeHeroFor } from "@/lib/tradeOffHeroes";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "Trade Examples — Xrated Trades. See what a profile looks like for your trade.",
  description:
    "Eight live trade profile examples — Bricklayer, Electrician, Plumber, Scaffolder, Roofer, Landscaper, Joiner, Decorator. Real priced services, real reviews. See what your Xrated Trades profile will look like.",
  alternates: { canonical: "/trade-off/trades" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Xrated Trades — Trade Examples. See your trade.",
    description:
      "Eight live trade profile examples with real prices and reviews. See what your Xrated Trades profile looks like.",
    url: absolute("/trade-off/trades")
  }
};

type Service = { title: string; price: string };
type TradeExample = {
  trade: string;
  // Slug used by tradeHeroFor() to look up the landscape banner image.
  // Slugs match the keys in src/lib/tradeOffHeroes.ts.
  slug: string;
  blurb: string;
  services: Service[];
  reviewStars: string;
  reviewCount: number;
  ratingLabel: string;
  href: string;
};

// Single live demo profile for every "View profile" link until more
// demo profiles ship. Each card's href is independent so we can swap
// individually later.
const DEMO_HREF = "/demo-mike-watson-drywall-manchester";

const TRADES: TradeExample[] = [
  {
    trade: "Carpenter",
    slug: "carpenter",
    blurb: "Bespoke kitchens, first fix, decking, doors. Workshop photos in the gallery.",
    services: [
      { title: "Bespoke kitchen (10 units)", price: "£8,500" },
      { title: "First fix carpentry (3-bed)", price: "£2,400" },
      { title: "Hardwood decking (20m2)", price: "£1,800" }
    ],
    reviewStars: "4.9",
    reviewCount: 28,
    ratingLabel: "Excellent",
    href: DEMO_HREF
  },
  {
    trade: "Bricklayer",
    slug: "bricklayer",
    blurb: "Garden walls, extensions, patios, repointing — fixed-price work shown up front.",
    services: [
      { title: "Garden wall (10m run)", price: "£450" },
      { title: "Extension wall — single storey", price: "£2,400" },
      { title: "Patio build (20m2)", price: "£1,200" }
    ],
    reviewStars: "4.9",
    reviewCount: 23,
    ratingLabel: "Excellent",
    href: DEMO_HREF
  },
  {
    trade: "Plumber",
    slug: "plumber",
    blurb: "Boilers, bathrooms, leaks — emergency or planned, customer sees the price first.",
    services: [
      { title: "Combi boiler install", price: "£2,200" },
      { title: "Full bathroom fit-out", price: "£4,800" },
      { title: "Emergency leak (1hr call-out)", price: "£150" }
    ],
    reviewStars: "4.8",
    reviewCount: 34,
    ratingLabel: "Excellent",
    href: DEMO_HREF
  },
  {
    trade: "Scaffolder",
    slug: "scaffolder",
    blurb: "Access for every other trade — chimney, loft, elevation. Hire by the week.",
    services: [
      { title: "2-storey scaffold (rear elevation)", price: "£850" },
      { title: "Loft conversion access (4 weeks)", price: "£1,200" },
      { title: "Chimney repair tower", price: "£450" }
    ],
    reviewStars: "4.9",
    reviewCount: 18,
    ratingLabel: "Excellent",
    href: DEMO_HREF
  },
  {
    trade: "Electrician",
    slug: "electrician",
    blurb: "Rewires, EV chargers, consumer units — every job priced and time-boxed.",
    services: [
      { title: "Full house rewire (3-bed)", price: "£3,500" },
      { title: "EV charger install (7kW)", price: "£750" },
      { title: "Consumer unit upgrade", price: "£450" }
    ],
    reviewStars: "5.0",
    reviewCount: 41,
    ratingLabel: "Outstanding",
    href: DEMO_HREF
  },
  {
    trade: "Drywaller",
    slug: "drywaller",
    blurb: "Plasterboard partitions, skim coats, ceilings. Level 5 finish or your money back.",
    services: [
      { title: "Skim coat re-finish (per sqm)", price: "£45" },
      { title: "Drywall partition (3m, full)", price: "£320" },
      { title: "Ceiling repair (per sqm)", price: "£65" }
    ],
    reviewStars: "4.8",
    reviewCount: 32,
    ratingLabel: "Excellent",
    href: DEMO_HREF
  },
  {
    trade: "Stone Mason",
    slug: "stonemason",
    blurb: "Natural stone walls, heritage repointing, restoration. Conservation-trained.",
    services: [
      { title: "Natural stone wall (per sqm)", price: "£180" },
      { title: "Heritage repointing (per sqm)", price: "£95" },
      { title: "Stone cleaning + restoration (per sqm)", price: "£40" }
    ],
    reviewStars: "5.0",
    reviewCount: 22,
    ratingLabel: "Outstanding",
    href: DEMO_HREF
  },
  {
    trade: "Tiler",
    slug: "tiler",
    blurb: "Bathrooms, kitchens, floors. Porcelain, ceramic, natural stone — fixed pricing.",
    services: [
      { title: "Bathroom retile (full)", price: "£1,800" },
      { title: "Kitchen splashback", price: "£450" },
      { title: "Floor tile install (per sqm)", price: "£45" }
    ],
    reviewStars: "4.9",
    reviewCount: 36,
    ratingLabel: "Excellent",
    href: DEMO_HREF
  }
];

const EVERY_TRADE_GETS: Array<{ title: string; body: string }> = [
  {
    title: "Customisable theme colour",
    body: "Pick from a 7-colour palette. Your URL, your brand."
  },
  {
    title: "60-second intro video",
    body: "Self-hosted on your profile. No YouTube ads, no algorithm."
  },
  {
    title: "Reviews tied to services",
    body: "Customers leave a review against the exact service they booked."
  },
  {
    title: "One-tap WhatsApp button",
    body: "Pre-fills the message with the service name. Lands in your phone."
  }
];

export default function TradeExamplesPage() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      {/* Hero — black surface, yellow accent on the punch word. */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Built for every trade
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            See what a profile looks like for{" "}
            <span style={{ color: XRATED_BRAND.accent }}>your trade.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
            Eight live trade examples — from bricklayers to decorators. Each
            shows the exact services, prices and reviews your customers
            see when they land on your xratedtrade.com URL.{" "}
            <span className="font-bold text-white">
              Pick the one that matches your trade.
            </span>
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Real prices, not placeholders
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Tap any card to open the live demo
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> 14-day free trial — no card
            </span>
          </div>
        </div>
      </section>

      {/* Section 1 — trade examples grid. Mobile 1-col, tablet 2-col,
          desktop 3-col. Yellow trade-icon badge top-left, three priced
          services, review snippet, View profile link. */}
      <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Eight trade examples
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Every card is a real example of how your profile renders for that
          trade. The View profile link opens the live demo so you can
          click through every section.
        </p>

        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRADES.map((t) => {
            const banner = tradeHeroFor(t.slug);
            return (
              <li key={t.trade}>
                <a
                  href={t.href}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-lg"
                >
                  {/* Landscape banner image — same art a tradesperson of
                      this trade gets as their default hero on /<slug>. */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100">
                    {banner ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={banner}
                        alt={`Default Xrated profile hero banner for a ${t.trade.toLowerCase()}`}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="absolute inset-0"
                        style={{ background: XRATED_BRAND.accent }}
                      />
                    )}
                    {/* Bottom-up gradient so the trade-name overlay reads
                        cleanly without darkening the whole image. */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-1/2"
                      style={{
                        background:
                          "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0) 100%)"
                      }}
                    />
                    {/* Example chip top-right */}
                    <span className="absolute right-3 top-3 rounded-full bg-black/80 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white backdrop-blur">
                      Example
                    </span>
                    {/* Trade name overlay bottom-left */}
                    <div className="absolute inset-x-0 bottom-0 px-4 pb-3 sm:px-5 sm:pb-4">
                      <h3 className="text-xl font-extrabold leading-tight text-white drop-shadow sm:text-2xl">
                        {t.trade}
                      </h3>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
                        View profile
                        <span
                          aria-hidden="true"
                          className="transition group-hover:translate-x-0.5"
                          style={{ color: XRATED_BRAND.accent }}
                        >
                          &rarr;
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Below-image content — compact services + review row. */}
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <p className="text-xs leading-relaxed text-neutral-600">
                      {t.blurb}
                    </p>

                    {/* Three priced services */}
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {t.services.map((s) => (
                        <li
                          key={s.title}
                          className="flex items-baseline justify-between gap-3 border-b border-dashed border-neutral-200 pb-1.5 text-xs sm:text-sm"
                        >
                          <span className="text-neutral-700">{s.title}</span>
                          <span className="shrink-0 font-extrabold text-neutral-900">
                            {s.price}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* Review snippet */}
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs">
                      <span className="inline-flex items-center gap-1 font-extrabold text-neutral-900">
                        <span style={{ color: XRATED_BRAND.accent }}>★</span>
                        {t.reviewStars}
                      </span>
                      <span className="text-neutral-500">
                        — {t.reviewCount} reviews
                      </span>
                      <span
                        className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider"
                        style={{
                          background: `${XRATED_BRAND.accent}1A`,
                          color: "#7A5300"
                        }}
                      >
                        {t.ratingLabel}
                      </span>
                    </div>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Section 2 — "What every trade gets" */}
      <section className="mx-auto max-w-5xl px-4 pt-14 sm:px-6 sm:pt-20">
        <div
          className="overflow-hidden rounded-2xl border border-neutral-200 p-5 sm:p-8"
          style={{ background: `${XRATED_BRAND.accent}0A` }}
        >
          <p
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: "#7A5300" }}
          >
            Built-in for every trade
          </p>
          <h2 className="mt-2 text-xl font-extrabold text-neutral-900 sm:text-2xl">
            What every trade gets, out of the box.
          </h2>
          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {EVERY_TRADE_GETS.map((f) => (
              <li
                key={f.title}
                className="flex flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-3 sm:p-4"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-extrabold"
                  style={{ background: XRATED_BRAND.accent, color: "#0A0A0A" }}
                >
                  &#10003;
                </span>
                <p className="mt-1 text-xs font-extrabold text-neutral-900 sm:text-sm">
                  {f.title}
                </p>
                <p className="text-xs leading-relaxed text-neutral-600">
                  {f.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Closing CTA — black surface mirroring the hero. */}
      <section className="mx-auto mt-12 max-w-5xl px-4 pb-2 sm:px-6">
        <div
          className="overflow-hidden rounded-2xl px-5 py-8 text-center sm:px-10 sm:py-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: XRATED_BRAND.accent }}
          >
            Your trade. Your URL.
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Build your own in 5 minutes.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-xs text-white/80 sm:text-sm">
            Pick your slug, drop in your photos, list your services with
            prices. Your xratedtrade.com URL is live the moment you save.
            14-day free trial, no card.
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
              Start 14-day trial
            </a>
            <a
              href="/trade-off/pricing"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
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

function Dot({ accent = false }: { accent?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ background: accent ? XRATED_BRAND.accent : "rgba(255,255,255,0.6)" }}
    />
  );
}
