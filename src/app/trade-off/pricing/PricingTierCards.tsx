"use client";

// Xrated Trades — three-tier pricing cards.
//
// Tiers:
//   1. Free    — hammerexdirect.com URL, basic widgets, forever free.
//   2. Paid    — £14.99/mo or £139.99/yr, brandable xratedtrade.com URL, full
//                features, white-label option.
//   3. Verified (NEW) — £19.99/mo or £199.99/yr, everything in Paid + a real
//                verified badge. The PRIMARY check is active company
//                registration (Companies House or local registry). Two
//                optional add-on badges layer on top: (a) "Insured for
//                private work" — verified insurance certificate, only
//                relevant for tradies doing direct-to-customer work
//                (commercial site tradies are covered by the site
//                owner's master policy and don't need this), (b)
//                "On-site checked" — for high-risk trades (gas,
//                electrical, structural, scaffolding). The customer-
//                facing badge stacks: ✓ Verified, ✓✓ Verified + Insured,
//                ✓✓✓ Verified + Insured + On-site checked. Goldilocks /
//                centre-stage effect pulls eyes from Paid → Verified
//                because the £5 delta buys real trust differentiation.
//
// The £20 Verified tier ships in WAITLIST_MODE: the CTA goes to a
// waitlist page, copy reads "Verification launching Q3 2026 — locked at
// £19.99/mo for early subscribers". Flip WAITLIST_MODE to false once the
// verification ops queue is staffed.
//
// Every new signup starts FREE with all premium features unlocked for
// 14 days. After 14 days they either subscribe (£14.99/mo or £139.99/yr to
// keep premium) or auto-revert to the free-for-life tier — no card
// required at any point. Verified is an upgrade path from the dashboard
// once the tier is live.

import { useState } from "react";
import { XRATED_BRAND } from "@/lib/xratedTrades";

const WAITLIST_MODE = true;

type Billing = "monthly" | "annual";

// Pricing — .99 endings for psychological-price impact. Paid £14.99/mo
// vs £139.99/yr keeps the existing ~£40 saving. Verified at £19.99/mo or
// £199.99/yr matches the same .99 cadence. Annual savings preserved.
const PRICE = {
  paid: {
    monthly: { gbp: "14.99", label: "/ month", subtext: "Billed monthly in GBP" },
    annual: { gbp: "139.99", label: "/ year", subtext: "Save £40 vs monthly · billed annually in GBP" }
  },
  verified: {
    monthly: { gbp: "19.99", label: "/ month", subtext: "Billed monthly in GBP" },
    annual: { gbp: "199.99", label: "/ year", subtext: "Save £40 vs monthly · billed annually in GBP" }
  }
} as const;

export function PricingTierCards() {
  const [billing, setBilling] = useState<Billing>("annual");
  const paid = PRICE.paid[billing];
  const verified = PRICE.verified[billing];
  const isAnnual = billing === "annual";

  return (
    <div className="flex flex-col gap-6">
      {/* Billing toggle — applies to Paid + Verified. Free is £0 fixed. */}
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
                    Save £40
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Three-up tier grid — Free | Paid £15 | Verified £20 (recommended) */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-5 lg:gap-6">
        {/* FREE tier */}
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
              No card. No expiry. Get a basic profile online today.
            </p>
            <div className="mt-3.5 rounded-lg bg-neutral-50 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                Your URL
              </p>
              <p className="mt-0.5 break-all text-[11px] font-semibold text-neutral-700 sm:text-xs">
                hammerexdirect.com/trade/your-name
              </p>
            </div>
            <a
              href="/trade-off/signup?tier=free"
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg px-4 text-xs font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.98] sm:text-sm"
              style={{ background: XRATED_BRAND.accent }}
            >
              Start free — no card
            </a>
          </header>

          <ul className="mt-5 flex flex-col gap-2 text-[11px] text-neutral-700 sm:text-xs">
            <Row included>WhatsApp message button</Row>
            <Row included>Photo gallery (up to 8 images)</Row>
            <Row included>Read-only customer reviews</Row>
            <Row included>QR code for van + cards</Row>
            <Row included>Service cards (image + name)</Row>
            <Row>Intro video tile</Row>
            <Row>Lead-capture contact form</Row>
            <Row>Call Now + Contact buttons</Row>
            <Row>Meet-the-team grid</Row>
            <Row>Service prices + descriptions</Row>
            <Row>Custom theme + banner</Row>
            <Row>Brandable xratedtrade.com URL</Row>
          </ul>

          <footer className="mt-5 border-t border-neutral-100 pt-3">
            <p className="text-[10px] leading-relaxed text-neutral-500">
              Xrated header stays visible on free profiles. Upgrade any time
              for white-label + full features.
            </p>
          </footer>
        </article>

        {/* PAID tier — middle (still featured but understated vs Verified) */}
        <article
          className="relative flex flex-col rounded-2xl border-2 bg-white p-6"
          style={{
            borderColor: `${XRATED_BRAND.accent}80`,
            boxShadow: `0 6px 18px ${XRATED_BRAND.accent}1F`
          }}
        >
          <span
            className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-neutral-700 ring-1 ring-neutral-200"
          >
            14-day free trial — no card
          </span>
          {/* Decorative right-side image — sits INSIDE the card's
              top-right padding zone so the yellow card border stays
              fully visible around the perimeter. Pointer-events-none so
              the image never blocks the Start-trial tap target. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://ik.imagekit.io/9mrgsv2rp/Untitledzxczxczxzzzz.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-6 h-16 w-16 select-none object-contain drop-shadow-md sm:h-20 sm:w-20"
          />

          <header>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">
              Paid
            </p>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-neutral-900 sm:text-4xl">
                £{paid.gbp}
              </span>
              <span className="text-xs text-neutral-500 sm:text-sm">{paid.label}</span>
            </p>
            <p className="mt-1.5 text-[11px] text-neutral-500 sm:text-xs">{paid.subtext}</p>
            {isAnnual && (
              <p className="mt-0.5 text-[10px] font-semibold text-neutral-600 sm:text-[11px]">
                ~£11.67/mo
              </p>
            )}
            <div
              className="mt-3.5 rounded-lg p-2.5"
              style={{ background: `${XRATED_BRAND.accent}1A` }}
            >
              <p
                className="text-[10px] font-extrabold uppercase tracking-widest"
                style={{ color: "#7A5300" }}
              >
                Your brandable URL
              </p>
              <p className="mt-0.5 break-all text-[11px] font-extrabold text-neutral-900 sm:text-xs">
                xratedtrade.com/your-name
              </p>
            </div>
            <a
              href={`/trade-off/signup?tier=paid&billing=${billing}`}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.98] sm:text-sm"
              style={{ background: XRATED_BRAND.accent }}
            >
              Start 14-day trial
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
            <p className="mt-1.5 text-center text-[10px] text-neutral-500">
              No card on signup · cancel any time
            </p>
          </header>

          <ul className="mt-5 flex flex-col gap-2 text-[11px] text-neutral-800 sm:text-xs">
            <Row included strong>Brandable xratedtrade.com/your-name URL</Row>
            <Row included strong>White-label — no Xrated header</Row>
            <Row included>Intro video tile (up to 60s)</Row>
            <Row included>Lead-capture contact form</Row>
            <Row included>Call Now + Contact buttons + WhatsApp</Row>
            <Row included>Service cards with prices + descriptions</Row>
            <Row included>Customer-submitted reviews</Row>
            <Row included>Meet-the-team grid</Row>
            <Row included>7-colour custom theme</Row>
            <Row included>Custom hero banner (annual)</Row>
            <Row included>Priority email + WhatsApp support</Row>
            <Row included strong>
              <span className="font-bold">All future updates + new features free, automatically</span>
            </Row>
          </ul>

          <footer
            className="mt-5 rounded-xl border p-2.5"
            style={{ borderColor: `${XRATED_BRAND.accent}55`, background: `${XRATED_BRAND.accent}0F` }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-700">
              On expiry
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-600">
              Silently downgrades to Free on hammerexdirect.com. Old links
              301-redirect. Re-upgrade any time.
            </p>
          </footer>
        </article>

        {/* VERIFIED tier — Goldilocks anchor with max emphasis */}
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
          {/* Decorative right-side image — moved 90px left of the card
              right edge and enlarged 2x per user direction. Still
              pointer-events-none so it never blocks the CTA tap target. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://ik.imagekit.io/9mrgsv2rp/Untitledasdasd.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute right-[102px] top-1/2 h-32 w-32 -translate-y-1/2 select-none object-contain drop-shadow-lg sm:h-40 sm:w-40"
          />

          <header>
            <p
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em]"
              style={{ color: XRATED_BRAND.accent }}
            >
              <VerifiedShield />
              Xrated Verified
            </p>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-white sm:text-4xl">
                £{verified.gbp}
              </span>
              <span className="text-xs text-white/60 sm:text-sm">{verified.label}</span>
            </p>
            <p className="mt-1.5 text-[11px] text-white/70 sm:text-xs">{verified.subtext}</p>
            {isAnnual && (
              <p className="mt-0.5 text-[10px] font-semibold text-white/60 sm:text-[11px]">
                Works out at ~£16.67/mo
              </p>
            )}
            <div
              className="mt-3.5 rounded-lg p-2.5 ring-1"
              style={{ background: `${XRATED_BRAND.accent}1A`, borderColor: XRATED_BRAND.accent, ['--tw-ring-color' as never]: `${XRATED_BRAND.accent}66` }}
            >
              <p
                className="text-[10px] font-extrabold uppercase tracking-widest"
                style={{ color: XRATED_BRAND.accent }}
              >
                Verified badge on your profile
              </p>
              <p className="mt-0.5 break-all text-[11px] font-extrabold text-white sm:text-xs">
                xratedtrade.com/your-name
              </p>
            </div>

            {WAITLIST_MODE ? (
              <>
                <a
                  href="/trade-off/verified-waitlist"
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.98] sm:text-sm"
                  style={{
                    background: XRATED_BRAND.accent,
                    boxShadow: `0 6px 18px ${XRATED_BRAND.accent}66`
                  }}
                >
                  Join the Verified waitlist
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </a>
                <p className="mt-1.5 text-center text-[10px] text-white/70">
                  Verification launches Q3 2026 · waitlist price locked at £{verified.gbp}{verified.label} for life
                </p>
              </>
            ) : (
              <>
                <a
                  href={`/trade-off/signup?tier=verified&billing=${billing}`}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.98] sm:text-sm"
                  style={{
                    background: XRATED_BRAND.accent,
                    boxShadow: `0 6px 18px ${XRATED_BRAND.accent}66`
                  }}
                >
                  Apply for Verified
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </a>
                <p className="mt-1.5 text-center text-[10px] text-white/70">
                  Verification typically takes 3–5 working days
                </p>
              </>
            )}
          </header>

          <div className="mt-5">
            <p
              className="text-[10px] font-extrabold uppercase tracking-widest"
              style={{ color: XRATED_BRAND.accent }}
            >
              Required check
            </p>
            <ul className="mt-2 flex flex-col gap-2 text-[11px] text-white/90 sm:text-xs">
              <Row dark included strong>
                <span className="font-bold">Active company registration</span> — Companies House or your local registry. We verify the company exists, is in good standing, and you&rsquo;re a director or named owner.
              </Row>
            </ul>

            <p
              className="mt-3 text-[10px] font-extrabold uppercase tracking-widest"
              style={{ color: XRATED_BRAND.accent }}
            >
              Optional add-on badges
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-white/65">
              Layer on top of your Verified badge — free with your Verified subscription.
            </p>
            <ul className="mt-2 flex flex-col gap-2 text-[11px] text-white/85 sm:text-xs">
              <Row dark included>
                <span className="font-bold text-white">&ldquo;Insured for private work&rdquo;</span> — upload your PL / EL certificate. Skip if you only work on sites where the principal contractor&rsquo;s policy covers you.
              </Row>
              <Row dark included>
                <span className="font-bold text-white">&ldquo;On-site checked&rdquo;</span> — relevant for gas, electrical, structural, scaffolding. We confirm credentials at the work address.
              </Row>
            </ul>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <p
              className="text-[10px] font-extrabold uppercase tracking-widest"
              style={{ color: XRATED_BRAND.accent }}
            >
              Plus everything in Paid +
            </p>
            <ul className="mt-2 flex flex-col gap-2 text-[11px] text-white/85 sm:text-xs">
              <Row dark included>Visible &ldquo;Xrated Verified&rdquo; badge on profile</Row>
              <Row dark included>Priority lead-routing in search</Row>
              <Row dark included>Dispute mediation — we step in when reviews are contested</Row>
              <Row dark included>Verified-only filter on customer searches</Row>
              <Row dark included>Annual report on lead conversion</Row>
            </ul>
          </div>
        </article>
      </div>

      {/* Trial assurance bar */}
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-center text-xs text-neutral-600 sm:text-sm">
        <span className="font-extrabold text-neutral-900">
          Everyone starts free. Premium unlocked for 14 days.
        </span>{" "}
        Build your full profile, decide later. After day 14 you either
        subscribe to keep premium or auto-revert to{" "}
        <span className="font-bold text-neutral-900">free for life</span>{" "}
        — no card required either way.{" "}
        <span className="font-bold text-neutral-900">
          One name = one account. Grab yours before someone else does.
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

function VerifiedShield() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3zm-1.2 14L7 12.2l1.4-1.4 2.4 2.4 5.4-5.4L17.6 9l-6.8 7z" />
    </svg>
  );
}
