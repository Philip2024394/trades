// Xrated Trades — /trade-off/what — "What is XRatedTrade?" intro page.
// Highest-priority landing page for new visitors who clicked a "what
// is this?" link from somewhere else. Job: explain the product in
// plain English in under 30 seconds and route the visitor either to
// signup or to one of the seven feature deep-dive pages.
//
// Layout: hero (start here) -> "What you get" 7-card feature grid
// (each card click-throughs to its feature page) -> "Built for
// construction trades" copy block -> social-proof quote ("Stop renting
// visibility on trade directories") -> closing CTA on black surface mirroring
// the hero. Pattern + typography rules match
// src/app/trade-off/pricing/page.tsx exactly so the two pages feel
// like one product.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "What is Xrated Trades? Your trade, online, in one link. Free 14-day trial.",
  description:
    "Xrated Trades gives every tradesperson their own professional online profile on one shareable URL — photos of real jobs, customer reviews, services with prices, instant WhatsApp, an intro video and a verified badge. Built for bricklayers, electricians, plumbers, scaffolders, roofers and every other construction trade. Start free, 14-day trial, no card.",
  alternates: { canonical: "/trade-off/what" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "What is Xrated Trades? Your trade. Online. In one link.",
    description:
      "Every tradesperson gets a professional profile on one shareable URL — photos, reviews, prices, WhatsApp, video, verified badge. Built for the construction trades. 14-day free trial, no card.",
    url: absolute("/trade-off/what")
  }
};

type FeatureCard = {
  title: string;
  blurb: string;
  href: string;
  // Tailwind-friendly background colour ring for the icon circle.
  iconBg: string;
  iconColor: string;
  icon: "profile" | "whatsapp" | "reviews" | "services" | "prices" | "video" | "verified";
};

const FEATURES: FeatureCard[] = [
  {
    title: "Profile",
    blurb: "Your own page at xratedtrade.com/your-name — photos, bio, the lot.",
    href: "/trade-off",
    iconBg: "#FFF4DA",
    iconColor: "#7A5300",
    icon: "profile"
  },
  {
    title: "WhatsApp button",
    blurb: "One tap and the customer is in your WhatsApp — message prefilled.",
    href: "/trade-off/share",
    iconBg: "#DCFCE7",
    iconColor: "#166534",
    icon: "whatsapp"
  },
  {
    title: "Reviews",
    blurb: "Real customer reviews on your profile. Replace screenshots forever.",
    href: "/trade-off/reviews",
    iconBg: "#FEF3C7",
    iconColor: "#92400E",
    icon: "reviews"
  },
  {
    title: "Services",
    blurb: "List every job type you do, with photos of real work for each one.",
    href: "/trade-off/services",
    iconBg: "#DBEAFE",
    iconColor: "#1E40AF",
    icon: "services"
  },
  {
    title: "Prices",
    blurb: "Show day rates, callout fees or starting-from prices — your call.",
    href: "/trade-off/services",
    iconBg: "#FEE2E2",
    iconColor: "#991B1B",
    icon: "prices"
  },
  {
    title: "Video",
    blurb: "A 60-second intro video so customers see you before they call.",
    href: "/trade-off/share",
    iconBg: "#E9D5FF",
    iconColor: "#6B21A8",
    icon: "video"
  },
  {
    title: "Verified badge",
    blurb: "Company-registration check on your profile — trust at a glance.",
    href: "/trade-off/verified",
    iconBg: "#FFE4B5",
    iconColor: "#7A4A00",
    icon: "verified"
  }
];

export default function WhatPage() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      {/* Hero — black surface with yellow accent eyebrow, matching the
          pricing page pattern. No banner image here — keep the focus
          on the headline so first-time visitors read the explanation. */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Start here
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            Your trade. Online. In{" "}
            <span style={{ color: XRATED_BRAND.accent }}>one link.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
            Xrated Trades gives every tradesperson their own professional
            online profile on one shareable URL. Photos of real jobs, customer
            reviews, services with prices, a WhatsApp button, an intro video
            and a verified badge — all on{" "}
            <span className="font-bold text-white">xratedtrade.com/your-name</span>.
            Send it on a quote, stick the QR on the van, drop it in your
            Instagram bio. One link is everything a customer needs to hire you.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> 14-day free trial
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> No card on signup
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Free for life after the trial
            </span>
          </div>
        </div>
      </section>

      {/* Section 1 — "What you get" feature grid. Seven cards, each a
          link to the feature's deep-dive page. */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <p
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#7A5300" }}
        >
          What you get
        </p>
        <h2 className="mt-2 text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Everything a customer needs to hire you, on one page.
        </h2>
        <p className="mt-1 max-w-2xl text-xs text-neutral-500 sm:text-sm">
          Tap any card to see exactly how that feature works on a real
          Xrated profile.
        </p>

        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feat) => (
            <li key={feat.title}>
              <a
                href={feat.href}
                className="group flex h-full min-h-[120px] flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[color:var(--accent)] hover:shadow-md sm:p-5"
                style={{ ["--accent" as never]: XRATED_BRAND.accent }}
              >
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ background: feat.iconBg, color: feat.iconColor }}
                  aria-hidden="true"
                >
                  <FeatureIcon icon={feat.icon} />
                </span>
                <p className="text-sm font-extrabold text-neutral-900 sm:text-base">
                  {feat.title}
                </p>
                <p className="text-xs leading-relaxed text-neutral-600 sm:text-sm">
                  {feat.blurb}
                </p>
                <span
                  className="mt-auto inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider"
                  style={{ color: XRATED_BRAND.accent }}
                >
                  See how
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Section 2 — "Built for construction trades" copy block. Two
          short paragraphs naming the trades so a search visitor lands
          on their own keyword inside the first scroll. */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <p
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#7A5300" }}
        >
          Built for construction trades
        </p>
        <h2 className="mt-2 text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Made for the tools, not the office.
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:gap-6">
          <p className="text-xs leading-relaxed text-neutral-700 sm:text-sm">
            Xrated Trades was built for people who work with their hands —
            bricklayers, electricians, plumbers, scaffolders, roofers,
            carpenters, plasterers, tilers, painters, decorators, groundworkers,
            joiners, gas engineers, trade counter staff and every other
            construction trade. Not
            estate agents, not consultants — the people who turn up at 7am with
            a van and finish the job.
          </p>
          <p className="text-xs leading-relaxed text-neutral-700 sm:text-sm">
            Every widget on your profile is sized for a thumb. Build it on the
            van in your dinner break. Share it from your phone the second a
            customer asks. No web designer, no agency, no monthly invoice from
            someone you have never met. One URL, your name on it, forever.
          </p>
        </div>
      </section>

      {/* Section 3 — Quote / social proof. Black surface card with a
          big yellow pull-quote. Plays the "own vs rent" angle that
          tradies hear loud and clear. */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <div
          className="overflow-hidden rounded-2xl px-5 py-8 sm:px-10 sm:py-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: XRATED_BRAND.accent }}
          >
            Why we built this
          </p>
          <blockquote className="mt-3 text-2xl font-extrabold leading-tight text-white sm:text-3xl md:text-4xl">
            "Stop renting visibility on trade directories.{" "}
            <span style={{ color: XRATED_BRAND.accent }}>Own your URL.</span>"
          </blockquote>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
            Lead-gen platforms charge a fee per lead, take 20 percent of the
            job or sell your customer to four other tradies. Xrated takes
            nothing from the work you win. You pay £14.99/mo for the URL — that
            is it. Customer contact lands in your WhatsApp, you bill them
            direct. Your profile, your name, your customers.
          </p>
          <div
            className="mt-6 inline-flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl px-4 py-3"
            style={{ background: `${XRATED_BRAND.accent}1A`, border: `1px solid ${XRATED_BRAND.accent}55` }}
          >
            <span className="text-[10px] font-extrabold uppercase tracking-[0.22em]" style={{ color: XRATED_BRAND.accent }}>
              Always shipping
            </span>
            <span className="text-xs leading-relaxed text-white/90 sm:text-sm">
              Paid members get every update and new feature{" "}
              <span className="font-bold text-white">free, automatically</span>.
              Our team is in the code every day so you can stay on the tools.
            </span>
          </div>
        </div>
      </section>

      {/* Closing CTA — yellow primary, outlined secondary. Mirrors the
          pricing page's closing CTA exactly. */}
      <section className="mx-auto mt-12 max-w-5xl px-4 pb-2 sm:px-6">
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
            Claim your name. Start free.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-xs text-white/80 sm:text-sm">
            14 days of full Paid-tier access. No card on signup. Your slug
            stays yours forever — even if you never upgrade.
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
              Start free — 14 day trial
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

// 7 inline icons — each one purpose-built so the cards look bespoke
// without dragging an icon library into the bundle.
function FeatureIcon({ icon }: { icon: FeatureCard["icon"] }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };
  switch (icon) {
    case "profile":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...common}>
          <path d="M21 11.5a8.38 8.38 0 0 1-12.4 7.3L3 21l2.3-5.6A8.5 8.5 0 1 1 21 11.5z" />
          <path d="M8.5 9c.5 2 2.5 4 4.5 4.5l1.5-1.5 2.5 1.5-.5 2c-3 .5-7-3-7.5-6L8.5 9z" />
        </svg>
      );
    case "reviews":
      return (
        <svg {...common}>
          <path d="m12 2 3 6.5 7 .8-5.2 4.7L18.5 21 12 17.3 5.5 21l1.7-7L2 9.3l7-.8L12 2z" />
        </svg>
      );
    case "services":
      return (
        <svg {...common}>
          <path d="M3 7h18M3 12h18M3 17h12" />
          <circle cx="20" cy="17" r="1.5" />
        </svg>
      );
    case "prices":
      return (
        <svg {...common}>
          <path d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0z" />
          <path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" />
        </svg>
      );
    case "video":
      return (
        <svg {...common}>
          <rect x="2" y="6" width="14" height="12" rx="2" />
          <path d="m22 8-6 4 6 4V8z" />
        </svg>
      );
    case "verified":
      return (
        <svg {...common}>
          <path d="m12 2 2.5 2.2 3.3-.4.4 3.3L20.5 9.5 19 12.5l1.5 3-2.3 2.4-.4 3.3-3.3-.4L12 23l-2.5-2.2-3.3.4-.4-3.3L3.5 15.5 5 12.5 3.5 9.5l2.3-2.4.4-3.3 3.3.4L12 2z" />
          <path d="m8.5 12.5 2.5 2.5 5-5" />
        </svg>
      );
    default:
      return null;
  }
}
