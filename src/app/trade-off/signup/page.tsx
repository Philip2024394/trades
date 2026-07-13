// /trade-off/signup — Launch your business app on Thenetworkers.
//
// Overhaul: split-screen with the form on the left and the Network
// Pulse (live ecosystem sidebar) on the right. Same TradeOffForm
// underneath — the form logic isn't rewritten, just re-framed inside
// a signup-first shell that surfaces buzz, social proof, and the
// Founding 100 scarcity gate.
//
// Layout:
//   - Dark hero header (matches CanteenHeader family)
//   - Mobile pulse strip (marquee) directly under the hero
//   - lg+: two-column grid, form left, sticky NetworkPulse right
//   - Cream (#FBF6EC) body per canonical theme rule

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { TradeOffForm } from "./TradeOffForm";
import { XratedViewTracker } from "@/components/trade-off/XratedViewTracker";
import { NetworkPulse } from "@/components/xrated/signup/NetworkPulse";
import { SignupPulseStrip } from "@/components/xrated/signup/SignupPulseStrip";
import { SignupDraftTicker } from "@/components/xrated/signup/SignupDraftTicker";
import { SignupUnlockSteps } from "@/components/xrated/signup/SignupUnlockSteps";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";
import { ShieldCheck, MessageCircle, Sparkles, Rocket } from "lucide-react";

const CREAM = "#FBF6EC";

export const metadata: Metadata = {
  title: "Join Thenetworkers — free for life | Thenetworkers",
  description:
    "Join Thenetworkers. Free for life, not a trial. Studio, App Warehouse, The Yard, Trade Center, and your own URL — no card, no commission. Customers WhatsApp you direct.",
  alternates: { canonical: "/trade-off/signup" }
};

export default function TradeOffSignupPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <XratedViewTracker page="signup" listingId={null} />
      <XratedHeader />

      {/* Hero — dark banner, matches CanteenHeader family. Trust
          density above the fold: eyebrow chip, headline, sub-line,
          three-badge trust strip. No stock imagery — the ecosystem
          panel does the visual heavy lifting. */}
      <section
        className="relative overflow-hidden border-b"
        style={{ backgroundColor: BRAND_BLACK, borderColor: `${BRAND_YELLOW}33` }}
      >
        <div className="mx-auto max-w-6xl px-3 py-8 md:px-6 md:py-12">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.24em]"
              style={{ backgroundColor: `${BRAND_YELLOW}22`, color: BRAND_YELLOW }}
            >
              <Sparkles size={10} strokeWidth={2.5}/>
              Join Thenetworkers · Founding 100 · 43 slots left
            </span>
          </div>
          <h1 className="mt-3 max-w-3xl text-[28px] font-black leading-[1.05] text-white md:text-[42px]">
            Join Thenetworkers.<br/>
            <span style={{ color: BRAND_YELLOW }}>Yours in 90 seconds. Live in 24 hours.</span>
          </h1>
          <p className="mt-3 max-w-xl text-[13px] leading-snug text-neutral-300 md:text-[14px]">
            Free for life. Not a trial. Not a bait-and-switch. Free app, free canteen, free URL, free access to The Yard + Trade Center. Customers WhatsApp you direct. Zero commission, ever.
          </p>

          {/* Trust badges — three above-the-fold signals */}
          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
            <TrustBadge icon={ShieldCheck} label="No card. No commission. Ever."/>
            <TrustBadge icon={MessageCircle} label="Customers WhatsApp you direct"/>
            <TrustBadge icon={Rocket} label="127 tradies joined Thenetworkers · last 24h"/>
          </ul>
        </div>
      </section>

      {/* Mobile ecosystem strip — sits directly under the hero on
          narrow viewports. Desktop uses the sticky NetworkPulse
          sidebar instead. */}
      <SignupPulseStrip />

      {/* Content grid — form left, NetworkPulse right on lg+.
          Cream body (canonical off-white theme). */}
      <div className="mx-auto max-w-6xl px-3 pb-16 pt-6 md:px-6 md:pt-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Form column — min-w-0 so wide children can't push the
              sidebar off-screen. */}
          <section className="min-w-0">
            {/* Unlock steps — reward-framed progress card. Each row
                ticks green as the corresponding form section is
                meaningfully filled (detection via a MutationObserver
                on the form's input names, same pattern as
                SignupDraftTicker). Reframes the form as 4 free things
                the tradesperson is picking up, not 4 tasks to grind. */}
            <SignupUnlockSteps />

            {/* The actual form — unchanged. Wrapping it doesn't
                mutate submission behaviour. */}
            <TradeOffForm mode={{ kind: "create" }} />

            {/* Draft-safety ticker — reassures the user that their
                in-progress typing is captured locally, and reminds
                them the "Save as draft" button is the real durable
                resume path. Reduces abandonment anxiety. */}
            <SignupDraftTicker />
          </section>

          {/* NetworkPulse sidebar — sticky on lg+. Hidden on mobile
              because SignupPulseStrip already ran above. */}
          <aside className="hidden lg:block">
            <div className="sticky top-[80px]">
              <NetworkPulse />
            </div>
          </aside>
        </div>
      </div>

      <XratedFooter />
    </main>
  );
}

function TrustBadge({
  icon: Icon,
  label
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number | string }>;
  label: string;
}) {
  return (
    <li
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
      style={{ borderColor: `${BRAND_YELLOW}55`, backgroundColor: "rgba(255,255,255,0.05)" }}
    >
      <Icon size={11} color={BRAND_YELLOW} strokeWidth={2.5}/>
      <span className="text-[11px] font-black text-white">{label}</span>
    </li>
  );
}

