// The Network — step-by-step signup wizard.
// Alternate entry to the flat signup form. Breaks the sign-up into
// one-question-per-screen for tradespeople who prefer a guided flow.
//
// Posts to the same /api/trade-off/create endpoint and redirects to
// /trade-off/signup/done — same contract as the flat form so both
// entry surfaces share the completion path.
//
// Cream body (#FBF6EC — canonical theme). Header/footer preserved so
// users can navigate without feeling isolated in the wizard.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { SignupWizard } from "@/components/trade-off/SignupWizard";
import { XratedViewTracker } from "@/components/trade-off/XratedViewTracker";
import { ShieldCheck, MessageCircle, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Join The Network — quick signup | The Network",
  description:
    "Join The Network. Free for life — your business app, canteen, URL, and access to The Yard + Trade Center. One question per screen. No card. No commission.",
  alternates: { canonical: "/trade-off/signup/wizard" }
};

const CREAM = "#FBF6EC";
const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK = "#0A0A0A";
const BRAND_GREEN_DARK = "#166534";

export default function TradeOffSignupWizardPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <XratedViewTracker page="signup" listingId={null} />
      <XratedHeader />

      {/* Trust strip — sits above the wizard so the "Join The Network
          · Free for life" framing lands before the first question.
          Wizard has its own step counter, so we don't duplicate the
          SignupUnlockSteps card here — this compact strip serves the
          same psychological "free × 4" anchor without conflicting. */}
      <section className="mx-auto max-w-2xl px-4 pt-5 sm:pt-7">
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border-2 p-4 shadow-sm"
          style={{
            borderColor: BRAND_YELLOW,
            background: `linear-gradient(135deg, ${BRAND_YELLOW}22 0%, #FFFFFF 60%)`
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full shadow-sm"
              style={{ backgroundColor: BRAND_BLACK }}
            >
              <span
                className="block h-3 w-3 rounded-full"
                style={{ backgroundColor: BRAND_YELLOW }}
                aria-hidden="true"
              />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-neutral-700">
                Join The Network
              </div>
              <div className="text-[13px] font-black text-neutral-900">
                4 free unlocks · Free for life
              </div>
            </div>
          </div>
          <ul className="ml-auto flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-black uppercase tracking-wider text-neutral-700">
            <li className="inline-flex items-center gap-1">
              <Sparkles size={11} color={BRAND_YELLOW} strokeWidth={2.5}/>
              Free app
            </li>
            <li className="inline-flex items-center gap-1">
              <Sparkles size={11} color={BRAND_YELLOW} strokeWidth={2.5}/>
              Free canteen
            </li>
            <li className="inline-flex items-center gap-1">
              <Sparkles size={11} color={BRAND_YELLOW} strokeWidth={2.5}/>
              Free URL live
            </li>
            <li className="inline-flex items-center gap-1">
              <Sparkles size={11} color={BRAND_YELLOW} strokeWidth={2.5}/>
              Free Yard + Trade Center
            </li>
          </ul>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-[10px] font-black uppercase tracking-wider text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)", width: "100%" }}>
            <li className="inline-flex items-center gap-1">
              <ShieldCheck size={10} color={BRAND_GREEN_DARK} strokeWidth={2.5}/>
              No card. No commission. Ever.
            </li>
            <li className="inline-flex items-center gap-1">
              <MessageCircle size={10} color={BRAND_GREEN_DARK} strokeWidth={2.5}/>
              Customers WhatsApp you direct
            </li>
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:pt-6">
        <SignupWizard />
      </section>
      <XratedFooter />
    </main>
  );
}
