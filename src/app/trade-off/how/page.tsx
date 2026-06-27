// Xrated Trades — "How it works" walkthrough.
// Six-step setup grid, behind-the-scenes narrative + dashboard mockup
// placeholder, and before/after comparison of the tradie's
// pre-Xrated tool stack vs the single xratedtrade.com URL.
// Server component only; mirrors the design system from
// /trade-off/pricing (XratedHeader top, black hero with yellow accent,
// max-w-5xl body, 13px text floor, XratedFooter bottom).

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "How it works — Xrated Trades. Set up in 5 minutes, go live the moment you save.",
  description:
    "Six steps to your shareable xratedtrade.com URL. Create your account, add your logo, photos, services and prices, then share the link. 14-day free trial, no card on signup.",
  alternates: { canonical: "/trade-off/how" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Xrated Trades — How it works. Set up in 5 minutes.",
    description:
      "Six steps to your shareable xratedtrade.com URL. No code. No designer. No card on signup.",
    url: absolute("/trade-off/how")
  }
};

type Step = {
  n: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    n: "1",
    title: "Create your account",
    body: "Email + WhatsApp number. That is it. No card, no contract."
  },
  {
    n: "2",
    title: "Add your logo",
    body: "Upload a logo or pick a colour and we generate one for you."
  },
  {
    n: "3",
    title: "Upload your photos",
    body: "Drop in real job photos straight from your phone gallery."
  },
  {
    n: "4",
    title: "Add your services",
    body: "Boiler swap, rewire, full bathroom — whatever you do, list it."
  },
  {
    n: "5",
    title: "Add your prices",
    body: "Fixed price, day rate, or 'from X'. Customers see it before they call."
  },
  {
    n: "6",
    title: "Share your link",
    body: "Copy xratedtrade.com/your-name and paste it anywhere customers look."
  }
];

type BeforeAfter = {
  kind: "before" | "after";
  title: string;
  body: string;
  bullets: string[];
};

const BEFORE_AFTER: BeforeAfter[] = [
  {
    kind: "before",
    title: "A business card",
    body:
      "Hand it out, hope they keep it. No photos, no reviews, no prices, no proof you did the work.",
    bullets: ["Lost in a wallet", "No photos", "No reviews"]
  },
  {
    kind: "before",
    title: "A Wix site you paid £900 for",
    body:
      "Looks dated within a year. Updating prices means logging in to a builder you barely remember.",
    bullets: ["£900 upfront", "£15+/mo hosting", "Slow to edit"]
  },
  {
    kind: "after",
    title: "One xratedtrade.com URL",
    body:
      "Your logo, photos, services, prices, reviews and WhatsApp button — on one short link. Edit from your phone in seconds.",
    bullets: ["£14.99/mo flat", "Edit from your phone", "Built for trades"]
  }
];

export default function HowItWorksPage() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      {/* Hero — banner-image background with dark gradient overlay for
          text legibility. Mirrors the pricing-page pattern. Image is the
          bespoke How-it-works banner art from ImageKit. */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2009_33_21%20AM.png"
          alt="Xrated Trades — set up in 5 minutes, go live the moment you save."
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Left-to-right dark gradient — keeps the left half heavy enough
            for the white headline + subhead to read cleanly while the right
            half of the artwork shows through. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.15) 75%, rgba(0,0,0,0) 100%)"
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            How it works
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white drop-shadow sm:text-4xl md:text-5xl">
            Set up in{" "}
            <span style={{ color: XRATED_BRAND.accent }}>5 minutes</span>. Go
            live the moment you save.
          </h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/85 drop-shadow sm:text-sm">
            No code. No designer. No appointment with a marketing agency. Six
            small steps from sign-up to a short, shareable URL that does the
            selling for you while you are on the tools.
          </p>
        </div>
      </section>

      {/* Section 1 — Six-step grid. Mobile 1 col, desktop 3 col x 2 rows. */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Six steps. Five minutes.
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Every step lives inside your dashboard. Hit save and your public
          page updates instantly.
        </p>

        <ol className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300"
            >
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-base font-extrabold"
                style={{ background: XRATED_BRAND.accent, color: "#0A0A0A" }}
                aria-hidden="true"
              >
                {step.n}
              </span>
              <h3 className="mt-3 text-sm font-extrabold text-neutral-900 sm:text-base">
                {step.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        <p
          className="mt-8 text-center text-xl font-extrabold uppercase tracking-wider sm:text-2xl"
          style={{ color: "#0A0A0A" }}
        >
          Done.
        </p>
      </section>

      {/* Section 2 — Behind the scenes + dashboard mockup placeholder. */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
          <div>
            <p
              className="text-xs font-bold uppercase tracking-[0.22em]"
              style={{ color: XRATED_BRAND.accent }}
            >
              Behind the scenes
            </p>
            <h2 className="mt-2 text-xl font-extrabold text-neutral-900 sm:text-2xl">
              A dashboard built the way tradies actually work.
            </h2>
            <p className="mt-3 text-xs leading-relaxed text-neutral-600 sm:text-sm">
              Big tap targets. Photo uploads that work off a dusty phone in the
              back of the van. Prices you can edit between jobs. The dashboard
              autosaves so you never lose work, and every change shows up on
              your public xratedtrade.com URL within seconds.
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-xs text-neutral-700 sm:text-sm">
              <li className="flex items-start gap-2">
                <Tick /> Phone-first layout, designed for big fingers.
              </li>
              <li className="flex items-start gap-2">
                <Tick /> Autosave on every change.
              </li>
              <li className="flex items-start gap-2">
                <Tick /> Drag-and-drop photo reordering.
              </li>
              <li className="flex items-start gap-2">
                <Tick /> Edit a price in 3 taps and hit publish.
              </li>
            </ul>
          </div>

          {/* Dashboard mockup placeholder — gray surface with caption. */}
          <div
            className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100"
            role="img"
            aria-label="Dashboard preview placeholder"
          >
            <div className="flex h-full w-full flex-col">
              <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-white px-3 py-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-neutral-300" aria-hidden="true" />
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-neutral-300" aria-hidden="true" />
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-neutral-300" aria-hidden="true" />
                <span className="ml-2 text-[11px] font-bold text-neutral-500">
                  xratedtrade.com/dashboard
                </span>
              </div>
              <div className="flex flex-1 items-center justify-center p-6">
                <div className="text-center">
                  <div
                    className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{ background: XRATED_BRAND.accent }}
                    aria-hidden="true"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
                    </svg>
                  </div>
                  <p className="mt-3 text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Dashboard preview
                  </p>
                  <p className="mt-1 text-[12px] text-neutral-500">
                    (Coming soon — screenshot drops in here.)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 — Before / After 3-card grid. */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Before Xrated, after Xrated.
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          What most tradies were juggling. What Xrated replaces.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
          {BEFORE_AFTER.map((card) => {
            const isAfter = card.kind === "after";
            return (
              <article
                key={card.title}
                className="rounded-2xl border p-5"
                style={
                  isAfter
                    ? {
                        background: "#0A0A0A",
                        borderColor: XRATED_BRAND.accent
                      }
                    : { background: "#ffffff", borderColor: "#e5e5e5" }
                }
              >
                <p
                  className="text-[11px] font-extrabold uppercase tracking-[0.18em]"
                  style={{
                    color: isAfter ? XRATED_BRAND.accent : "#a3a3a3"
                  }}
                >
                  {isAfter ? "After" : "Before"}
                </p>
                <h3
                  className="mt-2 text-sm font-extrabold sm:text-base"
                  style={{ color: isAfter ? "#ffffff" : "#0A0A0A" }}
                >
                  {card.title}
                </h3>
                <p
                  className="mt-2 text-xs leading-relaxed sm:text-sm"
                  style={{ color: isAfter ? "rgba(255,255,255,0.78)" : "#525252" }}
                >
                  {card.body}
                </p>
                <ul
                  className="mt-3 flex flex-col gap-1.5 text-xs"
                  style={{ color: isAfter ? "rgba(255,255,255,0.78)" : "#525252" }}
                >
                  {card.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          background: isAfter ? XRATED_BRAND.accent : "#a3a3a3"
                        }}
                      />
                      {b}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      {/* Closing CTA — black surface, yellow primary CTA. */}
      <section className="mx-auto mt-12 max-w-5xl px-4 pb-2 sm:px-6">
        <div
          className="overflow-hidden rounded-2xl px-5 py-8 text-center sm:px-10 sm:py-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: XRATED_BRAND.accent }}
          >
            Five minutes. Then go on the tools.
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Ready to set yours up?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-xs text-white/80 sm:text-sm">
            14-day free trial of every premium feature. No card on signup.
            Cancel any time.
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
              Join XratedTrade
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

function Tick() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
      style={{ background: XRATED_BRAND.accent }}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}
