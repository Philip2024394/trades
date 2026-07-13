// Xrated Trades — "Trade Examples" gallery.
// HIGH-INTENT page: a visitor arrives wanting to see what a real
// Xrated Trades profile looks like for THEIR trade. One card per
// registered demo profile (currently 27 — one per trade in
// demoTradeSeeds.ts). Each card renders a landscape banner image —
// the same art a tradesperson of that trade gets as a default hero
// on their own profile if they don't upload a custom_app_hero_url.
//
// Each card's "View profile" link points at THAT trade's own demo
// profile (Carpenter card -> /demo-tom-bridges-carpenter-newcastle,
// Bricklayer card -> /demo-craig-walters-bricklayer-nottingham, etc).
//
// Server component. Matches the /trade-off/pricing design language:
// XratedHeader top, black hero with yellow accent, max-w-5xl body,
// 13px text floor, XratedFooter bottom.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";
import { tradeHeroFor, BANNER_FALLBACK_BY_TRADE } from "@/lib/tradeOffHeroes";
import { tradeLabel, TRADE_OFF_TRADES } from "@/lib/tradeOff";
import { DEMO_TRADE_SEEDS } from "@/lib/demoTradeSeeds";
import {
  TemplatesGallery,
  type GalleryTrade,
  type GalleryDemoCard
} from "@/components/trade-off/TemplatesGallery";
import { TemplatesHeroCopy } from "@/components/trade-off/TemplatesHeroCopy";
import { sectionsForTrade } from "@/lib/tradeTemplateSections";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "Trade Examples — Xrated Trades. See what a profile looks like for your trade.",
  description:
    "27 live trade profile examples — Bricklayer, Electrician, Plumber, Scaffolder, Roofer, Landscaper, Joiner, Decorator and more. Real priced services, real reviews. See what your Xrated Trades profile will look like.",
  alternates: { canonical: "/trade-off/trades" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Xrated Trades — Trade Examples. See your trade.",
    description:
      "27 live trade profile examples with real prices and reviews. See what your Xrated Trades profile looks like.",
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

// First sentence of the seed bio, capped so cards stay compact.
function firstSentence(bio: string, cap = 140): string {
  const trimmed = bio.replace(/\s+/g, " ").trim();
  const dot = trimmed.indexOf(". ");
  const sentence = dot > 0 ? trimmed.slice(0, dot + 1) : trimmed;
  return sentence.length > cap ? sentence.slice(0, cap - 1).trimEnd() + "…" : sentence;
}

// Format a numeric £ price for a priced service line. Per-unit services
// keep the unit suffix; fixed/from prices show as a single £ figure.
function formatPrice(s: { price: number; unit: string }): string {
  const gbp = `£${s.price.toLocaleString("en-GB")}`;
  const unit = (s.unit ?? "").trim().toLowerCase();
  if (!unit || unit === "fixed") return gbp;
  if (unit === "from") return `from ${gbp}`;
  return `${gbp} ${s.unit}`;
}

function ratingLabelFor(avg: number): string {
  if (avg >= 4.9) return "Outstanding";
  if (avg >= 4.5) return "Excellent";
  if (avg >= 4.0) return "Great";
  return "Good";
}

// Slugs whose listings sell *products* (catalogue + cart + delivery)
// rather than on-site services. These get a separate "Templates for
// selling products" header on the gallery so a yard / merchant /
// rental shop can land on the right layout without scrolling past 20
// service-tradie examples.
const PRODUCT_SELLING_SLUGS = new Set([
  "building-merchant",
  "builders-supplies",
  "tool-hire",
  "heavy-machinery"
]);

// Index demo seeds by trade slug so the gallery can attach a live-demo
// link to any trade that has a seeded profile.
const DEMO_BY_TRADE: Record<string, string> = Object.fromEntries(
  DEMO_TRADE_SEEDS.map((seed) => [seed.trade_slug, `/${seed.profile_slug}`])
);

// For trades that don't have their own seeded demo (the 67 Phase 2
// additions), walk the banner fallback chain to find the closest
// existing trade that DOES have a demo. Same logic as banner
// inheritance — Kitchen Manufacture → Kitchen Fitter demo, EV
// Charger Installer → Electrician demo, etc. Guarantees every
// "View this template" card lands on a live app, never the signup
// form.
function demoHrefForTrade(slug: string): string | null {
  if (DEMO_BY_TRADE[slug]) return DEMO_BY_TRADE[slug];
  const seen = new Set<string>();
  let cur: string | undefined = BANNER_FALLBACK_BY_TRADE[slug];
  while (cur && !seen.has(cur)) {
    if (DEMO_BY_TRADE[cur]) return DEMO_BY_TRADE[cur];
    seen.add(cur);
    cur = BANNER_FALLBACK_BY_TRADE[cur];
  }
  return null;
}

// Strip the work-type suffix from a label so the description copy
// references the topic ("kitchens") rather than the label ("Kitchen
// Sales"). Then pluralise so the prose reads naturally: "fitting
// stairs" not "fitting stair", "making kitchens" not "making kitchen".
// Falls through gracefully for non-topic labels.
function topicFromLabel(label: string): string {
  const stripped = label
    .replace(/\s*(Sales|Manufacture|Manufacturer|Installation|Installer|Fitter|Maker|Workshop|Showroom|Shop|Merchant|Wholesaler|Supplier|Supplies|Hire)\s*$/i, "")
    .trim()
    .toLowerCase();
  return pluraliseTopic(stripped);
}

// Light pluraliser — only enough for the suffix-stripped topics that
// flow into the description templates (stair, kitchen, door, window,
// conservatory, garden room, etc.). Not a general English pluraliser.
function pluraliseTopic(noun: string): string {
  if (!noun) return noun;
  // Already plural (ends in "s" not preceded by certain digraphs) — leave it.
  if (/(?:[^s]s)$/.test(noun) && !/(?:ss|us)$/.test(noun)) return noun;
  if (/(?:s|x|z|ch|sh)$/.test(noun)) return noun + "es";
  if (/[^aeiou]y$/.test(noun)) return noun.slice(0, -1) + "ies";
  return noun + "s";
}

// One-line description per trade — explains what the app is FOR in
// plain English so a visitor browsing the gallery instantly knows
// what kind of business each card targets. Derived from the trade's
// primary section + topic so we get sensible copy for all 100+
// trades without hand-writing each one.
function descriptionForTrade(slug: string, label: string): string {
  const sections = sectionsForTrade(slug);
  const primary = sections[0];
  const topic = topicFromLabel(label) || label.toLowerCase();
  switch (primary) {
    case "sales":
      return `An app for selling ${topic} and related parts. Catalogue, cart, dispatch and delivery — all included.`;
    case "manufacture":
      return `An app for making and selling ${topic} direct to the public. Own-brand catalogue with cart and delivery.`;
    case "installation":
      return `An app for fitting ${topic} on-site. Buyers request a quote; you visit and price the job.`;
    case "hire":
      return `An app for renting ${topic} by the day, week, or month. Buyers book through WhatsApp.`;
    case "service":
    default:
      return `An app for ${topic} as a labour service. Past-work gallery, priced services, WhatsApp quotes.`;
  }
}

// Source of truth for the gallery — every trade in TRADE_OFF_TRADES
// gets a card. Banner falls back via tradeHeroFor() chain; trades
// without inherited art render the yellow brand-coloured placeholder.
const ALL_GALLERY_TRADES: GalleryTrade[] = TRADE_OFF_TRADES.map((t) => ({
  slug: t.slug,
  label: t.label,
  description: descriptionForTrade(t.slug, t.label),
  bannerUrl: tradeHeroFor(t.slug),
  liveDemoHref: demoHrefForTrade(t.slug)
}));

// Demo business-card lookup — keyed by trade_slug. Only trades that
// have their OWN seeded demo get an entry; we deliberately skip the
// banner-inheritance walk used for liveDemoHref because borrowing
// another tradesperson's name + WhatsApp for a different trade's
// share modal would be misleading. Cards whose slug is missing from
// this map render WITHOUT the Card button (per the design spec).
const DEMO_BY_SLUG: Record<string, GalleryDemoCard> = Object.fromEntries(
  DEMO_TRADE_SEEDS.map((seed) => [
    seed.trade_slug,
    {
      displayName: seed.display_name,
      tradeLabel: tradeLabel(seed.trade_slug),
      whatsapp: seed.whatsapp,
      email: seed.email,
      profileUrl: absolute(`/${seed.profile_slug}`)
    } satisfies GalleryDemoCard
  ])
);

// Legacy data shape — kept for reference but no longer rendered. The
// new gallery uses ALL_GALLERY_TRADES (above) and runs everything
// through the TemplatesGallery client component.
const TRADES: TradeExample[] = DEMO_TRADE_SEEDS.map((seed) => {
  const ratings = seed.reviews.map((r) => r.rating);
  const avg =
    ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 5;
  return {
    trade: tradeLabel(seed.trade_slug),
    slug: seed.trade_slug,
    blurb: firstSentence(seed.bio),
    services: seed.priced_services.slice(0, 3).map((s) => ({
      title: s.name,
      price: formatPrice(s)
    })),
    reviewStars: avg.toFixed(1),
    reviewCount: seed.reviews.length,
    ratingLabel: ratingLabelFor(avg),
    href: `/${seed.profile_slug}`
  };
});

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

      {/* Hero — black surface, yellow accent. Positions the gallery
          as THE construction app store: more templates than anywhere
          else, every trade covered, build your app in five minutes. */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <TemplatesHeroCopy totalCount={TRADE_OFF_TRADES.length} />
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-white/70 sm:text-sm">
            You&rsquo;ll have{" "}
            <span className="font-bold text-white">full edit control</span>{" "}
            over every word, photo, price and colour later — but
            let&rsquo;s get you live first while you find your way around.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> {TRADE_OFF_TRADES.length} trades · 5 categories
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Search + filter for instant matches
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Five minutes to live — no card
            </span>
          </div>
        </div>
      </section>

      {/* Templates gallery — sticky search + section filter chips
          (All · Service · Installation · Manufacture · Sales · Hire)
          on top, then the cards group themselves into the right
          sections. Trades like Stairs / Kitchens / Windows
          intentionally show up in multiple sections. */}
      <TemplatesGallery trades={ALL_GALLERY_TRADES} demoBySlug={DEMO_BY_SLUG} />

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
            prices. Your thenetworkers.app URL is live the moment you save.
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
              Join Thenetworkers
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

function TradesGroup({
  eyebrow,
  title,
  subtitle,
  trades
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  trades: TradeExample[];
}) {
  if (trades.length === 0) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
        style={{ color: XRATED_BRAND.accent }}
      >
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-extrabold text-neutral-900 sm:text-2xl">
        {title}
      </h2>
      <p className="mt-1 max-w-3xl text-xs text-neutral-500 sm:text-sm">
        {subtitle}
      </p>

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {trades.map((t) => {
          const banner = tradeHeroFor(t.slug);
          return (
            <li key={t.href} className="h-full">
              <a
                href={t.href}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-lg"
              >
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
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-1/2"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0) 100%)"
                    }}
                  />
                  <span className="absolute right-3 top-3 rounded-full bg-black/80 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white backdrop-blur">
                    Example
                  </span>
                  <div className="absolute inset-x-0 bottom-0 px-4 pb-3 sm:px-5 sm:pb-4">
                    <h3 className="text-xl font-extrabold leading-tight text-white drop-shadow sm:text-2xl">
                      {t.trade}
                    </h3>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
                      Live demo profile
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

                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <p className="text-xs leading-relaxed text-neutral-600">
                    {t.blurb}
                  </p>

                  <ul className="mt-3 flex flex-col gap-1.5">
                    {Array.from({ length: 3 }).map((_, i) => {
                      const s = t.services[i];
                      return (
                        <li
                          key={s?.title ?? `placeholder-${i}`}
                          className="flex items-baseline justify-between gap-3 border-b border-dashed border-neutral-200 pb-1.5 text-xs sm:text-sm"
                        >
                          <span className="text-neutral-700">
                            {s?.title ?? <span className="text-neutral-300">&mdash;</span>}
                          </span>
                          <span className="shrink-0 font-extrabold text-neutral-900">
                            {s?.price ?? <span className="text-neutral-300">&mdash;</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-auto flex flex-col gap-3 pt-4">
                    <div className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs">
                      <span className="inline-flex items-center gap-1 font-extrabold text-neutral-900">
                        <span style={{ color: XRATED_BRAND.accent }}>★</span>
                        {t.reviewStars}
                      </span>
                      <span className="text-neutral-500">
                        &mdash; {t.reviewCount} reviews
                      </span>
                    </div>
                    <span
                      className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider text-neutral-900 shadow-sm transition group-hover:shadow-md sm:text-sm"
                      style={{
                        background: XRATED_BRAND.accent,
                        boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
                      }}
                    >
                      View example
                      <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                        &rarr;
                      </span>
                    </span>
                  </div>
                </div>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
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
