"use client";

// Xrated Trades — four-tier pricing cards for the Business Operating
// System positioning.
//
// Tiers:
//   1. FREE          — £0, forever. Starter Business App + Studio +
//                       basic pages + publish. Xrated header stays.
//   2. STARTER       — £9.99/mo (Coming soon). Complete business app,
//                       Studio Editor, core App Store access, product
//                       catalogue, contact forms, basic AI, standard
//                       themes. Target: small businesses and sole traders.
//   3. PROFESSIONAL  — £14.99/mo. Recommended. Everything in Starter +
//                       premium Apps, Trade Circle, industry-specific
//                       Apps, AI content tools, advanced promotions,
//                       analytics, advanced Studio features. Target:
//                       growing businesses.
//   4. BUSINESS      — £24.99/mo (Coming soon). Everything in
//                       Professional + multi-user, multiple locations,
//                       advanced AI, premium Industry Packs, advanced
//                       automation, priority support. Target: larger
//                       merchants and growing companies.
//
// PROFESSIONAL is the only actionable paid tier today; it maps to the
// existing `app_paid` DB tier at £14.99/mo. STARTER and BUSINESS are
// clearly marked "Coming soon" per the platform rebrand brief — the
// plans stay visible so the pricing ladder is honest, but the CTAs
// route to a waitlist instead of a signup.
//
// The 14-day free trial applies to Professional and (when live) to
// Starter + Business. Free tier requires no card at any point.

import { useState } from "react";
import { XRATED_BRAND, XRATED_PRICING } from "@/lib/xratedTrades";
import { FX, convertGbpToCurrency, type Currency } from "@/lib/fx";

// When true, Starter and Business route to /trade-off/waitlist rather
// than /trade-off/signup. Flip to false once each tier's billing is
// wired (Starter needs a new DB tier value; Business needs multi-user
// + premium industry packs).
const STARTER_WAITLIST_MODE = true;
const BUSINESS_WAITLIST_MODE = true;

type Billing = "monthly" | "annual";

const STARTER_MONTHLY_GBP = 9.99;
const STARTER_ANNUAL_GBP = 99.99;
const BUSINESS_MONTHLY_GBP = 24.99;
const BUSINESS_ANNUAL_GBP = 249.99;

const ANNUAL_SUBTEXT = `Save vs monthly · billed annually in GBP`;

const PRICE = {
  starter: {
    monthly: { gbp: STARTER_MONTHLY_GBP.toFixed(2), label: "/ month", subtext: "Billed monthly in GBP" },
    annual: { gbp: STARTER_ANNUAL_GBP.toFixed(2), label: "/ year", subtext: ANNUAL_SUBTEXT }
  },
  professional: {
    monthly: { gbp: XRATED_PRICING.monthlyGbp.toFixed(2), label: "/ month", subtext: "Billed monthly in GBP" },
    annual: { gbp: XRATED_PRICING.annualGbp.toFixed(2), label: "/ year", subtext: `Save £${XRATED_PRICING.annualSavingGbp} vs monthly · billed annually in GBP` }
  },
  business: {
    monthly: { gbp: BUSINESS_MONTHLY_GBP.toFixed(2), label: "/ month", subtext: "Billed monthly in GBP" },
    annual: { gbp: BUSINESS_ANNUAL_GBP.toFixed(2), label: "/ year", subtext: ANNUAL_SUBTEXT }
  }
} as const;

// Format an approximate price in the visitor's display currency.
// Round to whole units and prefix with "≈" so customers cannot mistake
// this for the canonical charge.
function formatApprox(gbp: number, currency: Currency | null): string | null {
  if (!currency || currency === "GBP") return null;
  const converted = convertGbpToCurrency(gbp, currency);
  const rounded = Math.round(converted);
  const symbol = FX[currency].symbol;
  return `${symbol}${rounded.toLocaleString("en-US")} ${currency}`;
}

export function PricingTierCards({
  displayCurrency = null
}: {
  /** Server-detected display currency from the visitor's IP country.
   *  When set (and not GBP) the cards render an "≈ $X USD" approximate
   *  row beneath the canonical GBP price. */
  displayCurrency?: Currency | null;
}) {
  const [billing, setBilling] = useState<Billing>("annual");
  const starter = PRICE.starter[billing];
  const professional = PRICE.professional[billing];
  const business = PRICE.business[billing];
  const isAnnual = billing === "annual";
  const starterApprox = formatApprox(parseFloat(starter.gbp), displayCurrency);
  const professionalApprox = formatApprox(parseFloat(professional.gbp), displayCurrency);
  const businessApprox = formatApprox(parseFloat(business.gbp), displayCurrency);

  return (
    <div className="flex flex-col gap-6">
      {/* Billing toggle — applies to paid tiers. Free is £0 fixed. */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Billing cycle"
          className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 p-1"
        >
          {(["monthly", "annual"] as Billing[]).map((opt) => {
            const active = opt === billing;
            return (
              <button
                key={opt}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setBilling(opt)}
                className="relative inline-flex h-10 items-center gap-2 rounded-full px-5 text-xs font-extrabold uppercase tracking-wider transition sm:text-sm"
                style={{
                  background: active ? XRATED_BRAND.accent : "transparent",
                  color: active ? "#0A0A0A" : "#525252"
                }}
              >
                {opt === "monthly" ? "Monthly" : "Annual"}
                {opt === "annual" && (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                    style={{
                      background: active ? "#0A0A0A" : XRATED_BRAND.accent,
                      color: active ? XRATED_BRAND.accent : "#0A0A0A"
                    }}
                  >
                    Save vs monthly
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Four-up tier grid — Free | Starter | Professional (recommended) | Business */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-5 lg:grid-cols-4 lg:gap-4">
        {/* ─── FREE ───────────────────────────────────────────────── */}
        <article className="relative flex flex-col rounded-2xl border border-neutral-200 bg-white p-6">
          <header>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">
              Free
            </p>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-neutral-900 sm:text-4xl">£0</span>
              <span className="text-xs text-neutral-500 sm:text-sm">/ forever</span>
            </p>
            <p className="mt-1.5 text-[11px] text-neutral-500 sm:text-xs">
              Launch your business app today. No card. No expiry.
            </p>
            <a
              href="/trade-off/signup?tier=free"
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg px-4 text-xs font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.98] sm:text-sm"
              style={{ background: XRATED_BRAND.accent }}
            >
              Start free — no card
            </a>
            <p className="mt-1.5 text-center text-[10px] text-neutral-500">
              Small businesses just getting started
            </p>
          </header>

          <ul className="mt-5 flex flex-col gap-2 text-[11px] text-neutral-700 sm:text-xs">
            <Row included>Starter Business App</Row>
            <Row included>Studio (visual editor)</Row>
            <Row included>Basic theme</Row>
            <Row included>Link in Bio App</Row>
            <Row included>Contact details</Row>
            <Row included>Basic pages</Row>
            <Row included>Publish</Row>
          </ul>

          <footer className="mt-5 border-t border-neutral-100 pt-3">
            <p className="text-[10px] leading-relaxed text-neutral-500">
              Xrated header stays visible on free apps. Upgrade any
              time for the full Business Operating System.
            </p>
          </footer>
        </article>

        {/* ─── STARTER (Coming soon) ─────────────────────────────── */}
        <article className="relative flex flex-col rounded-2xl border border-neutral-200 bg-white p-6">
          <span
            className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-neutral-700 ring-1 ring-neutral-200"
          >
            Coming soon
          </span>
          <header>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">
              Starter
            </p>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-neutral-900 sm:text-4xl">
                £{starter.gbp}
              </span>
              <span className="text-xs text-neutral-500 sm:text-sm">{starter.label}</span>
            </p>
            <p className="mt-1.5 text-[11px] text-neutral-500 sm:text-xs">{starter.subtext}</p>
            {starterApprox && (
              <p className="mt-1 text-[10px] leading-tight text-neutral-500 sm:text-[11px]">
                <span className="font-bold text-neutral-700">≈ {starterApprox}</span>
                {" · "}billed in GBP, your bank converts
              </p>
            )}
            {STARTER_WAITLIST_MODE ? (
              <>
                <a
                  href="/trade-off/waitlist?tier=starter"
                  className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg border border-neutral-300 px-4 text-xs font-extrabold text-neutral-800 transition active:scale-[0.98] sm:text-sm hover:bg-neutral-50"
                >
                  Join the waitlist
                </a>
                <p className="mt-1.5 text-center text-[10px] text-neutral-500">
                  Small businesses and sole traders
                </p>
              </>
            ) : (
              <>
                <a
                  href={`/trade-off/signup?tier=starter&billing=${billing}`}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg px-4 text-xs font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.98] sm:text-sm"
                  style={{ background: XRATED_BRAND.accent }}
                >
                  Start 14-day trial
                </a>
                <p className="mt-1.5 text-center text-[10px] text-neutral-500">
                  Small businesses and sole traders
                </p>
              </>
            )}
          </header>

          <ul className="mt-5 flex flex-col gap-2 text-[11px] text-neutral-700 sm:text-xs">
            <Row included strong>Complete Business App</Row>
            <Row included>Studio Editor</Row>
            <Row included>Core App Store</Row>
            <Row included>Product Catalogue</Row>
            <Row included>Contact Forms</Row>
            <Row included>Basic AI Assistance</Row>
            <Row included>Standard Themes</Row>
          </ul>
        </article>

        {/* ─── PROFESSIONAL (Recommended, actionable) ─────────────── */}
        <article
          className="relative flex flex-col rounded-2xl border-2 p-6"
          style={{
            borderColor: "#0A0A0A",
            background: "linear-gradient(180deg, #0A0A0A 0%, #1a1a1a 100%)",
            boxShadow: `0 16px 40px ${XRATED_BRAND.accent}55, 0 0 0 4px ${XRATED_BRAND.accent}26`
          }}
        >
          <span
            className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-neutral-900 shadow-md"
            style={{ background: XRATED_BRAND.accent }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="m12 2 2.4 7.2H22l-6 4.4 2.3 7.2L12 16.5l-6.3 4.3L8 13.6 2 9.2h7.6L12 2z" />
            </svg>
            Recommended
          </span>

          <header>
            <p
              className="text-xs font-bold uppercase tracking-[0.18em]"
              style={{ color: XRATED_BRAND.accent }}
            >
              Professional
            </p>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-white sm:text-4xl">
                £{professional.gbp}
              </span>
              <span className="text-xs text-white/60 sm:text-sm">{professional.label}</span>
            </p>
            <p className="mt-1.5 text-[11px] text-white/70 sm:text-xs">{professional.subtext}</p>
            {isAnnual && (
              <p className="mt-0.5 text-[10px] font-semibold text-white/60 sm:text-[11px]">
                ~£11.67/mo
              </p>
            )}
            {professionalApprox && (
              <p className="mt-1 text-[10px] leading-tight text-white/65 sm:text-[11px]">
                <span className="font-bold text-white/90">≈ {professionalApprox}</span>
                {" · "}billed in GBP, your bank converts
              </p>
            )}
            <a
              href={`/trade-off/signup?tier=paid&billing=${billing}`}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.98] sm:text-sm"
              style={{
                background: XRATED_BRAND.accent,
                boxShadow: `0 6px 18px ${XRATED_BRAND.accent}66`
              }}
            >
              Start 14-day trial
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
            <p className="mt-1.5 text-center text-[10px] text-white/70">
              No card on trial · growing businesses
            </p>
          </header>

          <p
            className="mt-5 text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: XRATED_BRAND.accent }}
          >
            Everything in Starter plus
          </p>
          <ul className="mt-2 flex flex-col gap-2 text-[11px] text-white/90 sm:text-xs">
            <Row dark included strong>Premium Apps</Row>
            <Row dark included>Trade Circle</Row>
            <Row dark included>Industry-specific Apps</Row>
            <Row dark included>AI Content Tools</Row>
            <Row dark included>Advanced Promotions</Row>
            <Row dark included>Analytics</Row>
            <Row dark included>Advanced Studio Features</Row>
          </ul>
        </article>

        {/* ─── BUSINESS (Coming soon) ─────────────────────────────── */}
        <article className="relative flex flex-col rounded-2xl border border-neutral-200 bg-white p-6">
          <span
            className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-neutral-700 ring-1 ring-neutral-200"
          >
            Coming soon
          </span>
          <header>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">
              Business
            </p>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-neutral-900 sm:text-4xl">
                £{business.gbp}
              </span>
              <span className="text-xs text-neutral-500 sm:text-sm">{business.label}</span>
            </p>
            <p className="mt-1.5 text-[11px] text-neutral-500 sm:text-xs">{business.subtext}</p>
            {businessApprox && (
              <p className="mt-1 text-[10px] leading-tight text-neutral-500 sm:text-[11px]">
                <span className="font-bold text-neutral-700">≈ {businessApprox}</span>
                {" · "}billed in GBP, your bank converts
              </p>
            )}
            {BUSINESS_WAITLIST_MODE ? (
              <>
                <a
                  href="/trade-off/waitlist?tier=business"
                  className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg border border-neutral-300 px-4 text-xs font-extrabold text-neutral-800 transition active:scale-[0.98] sm:text-sm hover:bg-neutral-50"
                >
                  Join the waitlist
                </a>
                <p className="mt-1.5 text-center text-[10px] text-neutral-500">
                  Larger merchants and growing companies
                </p>
              </>
            ) : (
              <>
                <a
                  href={`/trade-off/signup?tier=business&billing=${billing}`}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg px-4 text-xs font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.98] sm:text-sm"
                  style={{ background: XRATED_BRAND.accent }}
                >
                  Start 14-day trial
                </a>
                <p className="mt-1.5 text-center text-[10px] text-neutral-500">
                  Larger merchants and growing companies
                </p>
              </>
            )}
          </header>

          <p className="mt-5 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            Everything in Professional plus
          </p>
          <ul className="mt-2 flex flex-col gap-2 text-[11px] text-neutral-700 sm:text-xs">
            <Row included strong>Multi-user accounts</Row>
            <Row included>Multiple locations</Row>
            <Row included>Advanced AI</Row>
            <Row included>Premium Industry Packs</Row>
            <Row included>Advanced automation</Row>
            <Row included>Priority support</Row>
            <Row included>Future enterprise features</Row>
          </ul>
        </article>
      </div>

      {/* Worldwide-pricing footnote */}
      <p className="text-center text-[11px] leading-relaxed text-neutral-500 sm:text-xs">
        Prices in GBP. Card charges in GBP — your bank converts at its
        prevailing rate. No fee from us for international cards.
      </p>

      {/* Trial assurance bar */}
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-center text-xs text-neutral-600 sm:text-sm">
        <span className="font-extrabold text-neutral-900">
          Every paid plan starts with a 14-day free trial.
        </span>{" "}
        Build your full business app, decide later. After day 14 you either
        subscribe or auto-revert to{" "}
        <span className="font-bold text-neutral-900">Free — forever</span>{" "}
        — no card required either way.{" "}
        <span className="font-bold text-neutral-900">
          One business = one account. Grab your URL before someone else does.
        </span>
      </div>
    </div>
  );
}

function Row({
  included = false,
  strong = false,
  dark = false,
  children
}: {
  included?: boolean;
  strong?: boolean;
  dark?: boolean;
  children: React.ReactNode;
}) {
  const baseInkOn = dark ? "text-white/90" : "text-neutral-700";
  const baseInkOnStrong = dark ? "text-white font-bold" : "text-neutral-900 font-bold";
  const baseInkOff = dark ? "text-white/40 line-through decoration-white/30" : "text-neutral-400 line-through decoration-neutral-300";
  return (
    <li className="flex items-start gap-2">
      {included ? (
        <span
          className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
          style={{ background: dark ? XRATED_BRAND.accent : `${XRATED_BRAND.accent}26` }}
          aria-hidden="true"
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={dark ? "#0A0A0A" : XRATED_BRAND.accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      ) : (
        <span
          className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-100"
          aria-hidden="true"
        >
          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </span>
      )}
      <span className={included ? (strong ? baseInkOnStrong : baseInkOn) : baseInkOff}>
        {children}
      </span>
    </li>
  );
}
