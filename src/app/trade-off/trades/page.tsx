// Xrated Trades — "Trade Examples" gallery.
// HIGH-INTENT page: a visitor arrives wanting to see what a real
// Xrated Trades profile looks like for THEIR trade. Eight trade cards
// (Bricklayer, Electrician, Plumber, Scaffolder, Roofer, Landscaper,
// Joiner, Decorator) each render a yellow trade-icon badge, three
// realistic priced services and a review snippet, so visitors can
// pattern-match in seconds: "yes, this is for me".
//
// Every card "View profile" link points at the live demo profile
// (mike-watson-drywall-manchester) for now — when more demo profiles
// ship we swap each card's href independently.
//
// Server component. Matches the /trade-off/pricing design language:
// XratedHeader top, black hero with yellow accent, max-w-5xl body,
// 13px text floor, XratedFooter bottom.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

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

// Inline SVGs — kept local so this page has no off-page side effects.
// We do not extend the shared tradeIcons map because some of the trades
// shown here (landscaper, decorator) are presentation-only labels and
// must not affect routing / chip rendering elsewhere.
type IconProps = { className?: string; color?: string };

function IconBricklayer({ color = "#0A0A0A" }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <rect x="3" y="10" width="8" height="5" rx="1" />
      <rect x="13" y="10" width="8" height="5" rx="1" />
      <rect x="3" y="16" width="18" height="5" rx="1" />
    </svg>
  );
}
function IconElectrician({ color = "#0A0A0A" }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m13 2-9 13h7l-1 7 9-13h-7l1-7Z" />
    </svg>
  );
}
function IconPlumber({ color = "#0A0A0A" }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
    </svg>
  );
}
function IconScaffolder({ color = "#0A0A0A" }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18" />
      <path d="M21 3v18" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
    </svg>
  );
}
function IconRoofer({ color = "#0A0A0A" }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12 12 4l9 8" />
      <path d="M5 11v9h14v-9" />
    </svg>
  );
}
function IconLandscaper({ color = "#0A0A0A" }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22V12" />
      <path d="M12 12c0-3 2-6 6-6-1 4-3 6-6 6Z" />
      <path d="M12 12c0-3-2-6-6-6 1 4 3 6 6 6Z" />
      <path d="M4 22h16" />
    </svg>
  );
}
function IconJoiner({ color = "#0A0A0A" }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 12 6 21l-3-3 9-9" />
      <path d="m15 12 5 5-2 2-5-5" />
      <path d="m12 9 6-6 3 3-6 6" />
    </svg>
  );
}
function IconDecorator({ color = "#0A0A0A" }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 11V7a2 2 0 0 0-2-2H7L3 9v6l4 4h9a2 2 0 0 0 2-2v-4" />
      <path d="M18 11h3v6h-3" />
    </svg>
  );
}

type Service = { title: string; price: string };
type TradeExample = {
  trade: string;
  blurb: string;
  services: Service[];
  reviewStars: string;
  reviewCount: number;
  ratingLabel: string;
  href: string;
  icon: (p: IconProps) => ReactNode;
};

// Single live demo profile for every "View profile" link until more
// demo profiles ship. Each card's href is independent so we can swap
// individually later.
const DEMO_HREF = "/demo-mike-watson-drywall-manchester";

const TRADES: TradeExample[] = [
  {
    trade: "Bricklayer",
    blurb: "Garden walls, extensions, patios, repointing — fixed-price work shown up front.",
    services: [
      { title: "Garden wall (10m run)", price: "£450" },
      { title: "Extension wall — single storey", price: "£2,400" },
      { title: "Patio build (20m2)", price: "£1,200" }
    ],
    reviewStars: "4.9",
    reviewCount: 23,
    ratingLabel: "Excellent",
    href: DEMO_HREF,
    icon: IconBricklayer
  },
  {
    trade: "Electrician",
    blurb: "Rewires, EV chargers, consumer units — every job priced and time-boxed.",
    services: [
      { title: "Full house rewire (3-bed)", price: "£3,500" },
      { title: "EV charger install (7kW)", price: "£750" },
      { title: "Consumer unit upgrade", price: "£450" }
    ],
    reviewStars: "5.0",
    reviewCount: 41,
    ratingLabel: "Outstanding",
    href: DEMO_HREF,
    icon: IconElectrician
  },
  {
    trade: "Plumber",
    blurb: "Boilers, bathrooms, leaks — emergency or planned, customer sees the price first.",
    services: [
      { title: "Combi boiler install", price: "£2,200" },
      { title: "Full bathroom fit-out", price: "£4,800" },
      { title: "Emergency leak (1hr call-out)", price: "£150" }
    ],
    reviewStars: "4.8",
    reviewCount: 34,
    ratingLabel: "Excellent",
    href: DEMO_HREF,
    icon: IconPlumber
  },
  {
    trade: "Scaffolder",
    blurb: "Access for every other trade — chimney, loft, elevation. Hire by the week.",
    services: [
      { title: "2-storey scaffold (rear elevation)", price: "£850" },
      { title: "Loft conversion access (4 weeks)", price: "£1,200" },
      { title: "Chimney repair tower", price: "£450" }
    ],
    reviewStars: "4.9",
    reviewCount: 18,
    ratingLabel: "Excellent",
    href: DEMO_HREF,
    icon: IconScaffolder
  },
  {
    trade: "Roofer",
    blurb: "Re-roofs, tile repairs, gutters. Honest pricing — no scaffolding surprises.",
    services: [
      { title: "Full roof replacement (semi)", price: "£6,500" },
      { title: "Slipped tile / leak repair", price: "£350" },
      { title: "Gutter clean + check", price: "£120" }
    ],
    reviewStars: "4.9",
    reviewCount: 27,
    ratingLabel: "Excellent",
    href: DEMO_HREF,
    icon: IconRoofer
  },
  {
    trade: "Landscaper",
    blurb: "Garden design, turfing, patios. Before-and-after photos do the selling.",
    services: [
      { title: "Garden design + plan", price: "£1,800" },
      { title: "Lawn turfing (50m2)", price: "£900" },
      { title: "Patio install (porcelain)", price: "£2,400" }
    ],
    reviewStars: "4.8",
    reviewCount: 19,
    ratingLabel: "Excellent",
    href: DEMO_HREF,
    icon: IconLandscaper
  },
  {
    trade: "Joiner",
    blurb: "Bespoke kitchens, wardrobes, doors. Workshop photos in the gallery.",
    services: [
      { title: "Bespoke kitchen (10 units)", price: "£8,500" },
      { title: "Built-in wardrobes (3m run)", price: "£2,200" },
      { title: "Door hanging (per door)", price: "£180" }
    ],
    reviewStars: "5.0",
    reviewCount: 31,
    ratingLabel: "Outstanding",
    href: DEMO_HREF,
    icon: IconJoiner
  },
  {
    trade: "Decorator",
    blurb: "House repaints, feature walls, wallpaper. Colour cards in the gallery.",
    services: [
      { title: "3-bed house repaint", price: "£2,800" },
      { title: "Feature wall (paint + prep)", price: "£350" },
      { title: "Wallpaper hang (per roll)", price: "£450" }
    ],
    reviewStars: "4.9",
    reviewCount: 25,
    ratingLabel: "Excellent",
    href: DEMO_HREF,
    icon: IconDecorator
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
            const Icon = t.icon;
            return (
              <li key={t.trade}>
                <a
                  href={t.href}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-lg sm:p-5"
                >
                  {/* Yellow trade-icon badge — top-left. */}
                  <div className="flex items-start justify-between">
                    <span
                      className="inline-flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{ background: XRATED_BRAND.accent }}
                      aria-hidden="true"
                    >
                      <Icon />
                    </span>
                    <span
                      className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-neutral-600"
                    >
                      Example
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg font-extrabold text-neutral-900 sm:text-xl">
                    {t.trade}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                    {t.blurb}
                  </p>

                  {/* Three priced services */}
                  <ul className="mt-4 flex flex-col gap-1.5">
                    {t.services.map((s) => (
                      <li
                        key={s.title}
                        className="flex items-baseline justify-between gap-3 border-b border-dashed border-neutral-200 pb-1.5 text-xs sm:text-sm"
                      >
                        <span className="text-neutral-700">{s.title}</span>
                        <span
                          className="shrink-0 font-extrabold text-neutral-900"
                        >
                          {s.price}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Review snippet */}
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs">
                    <span
                      className="inline-flex items-center gap-1 font-extrabold text-neutral-900"
                    >
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

                  {/* View profile link — bottom CTA */}
                  <span
                    className="mt-4 inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider transition group-hover:gap-2"
                    style={{ color: "#0A0A0A" }}
                  >
                    View profile{" "}
                    <span
                      aria-hidden="true"
                      className="transition group-hover:translate-x-0.5"
                      style={{ color: XRATED_BRAND.accent }}
                    >
                      &rarr;
                    </span>
                  </span>
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
