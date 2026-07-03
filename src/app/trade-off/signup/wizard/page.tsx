// xratedtrade.com Trade Off — step-by-step signup wizard.
// New entry surface that breaks the single-page signup into 4 screens:
//   1. Pick your trade
//   2. Tell us about you (business name, city, WhatsApp, email, password, bio)
//   3. Optional hero photo
//   4. Live preview → Go Live
//
// Posts to the existing /api/trade-off/create endpoint and redirects to
// /trade-off/signup/done?slug=...&token=...&status=... — same contract as
// the legacy /trade-off/signup form. The legacy form stays live as a
// fallback while this route is validated.
//
// Goal: a tradesperson lands here and is live in under 6 minutes.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { SignupWizard } from "@/components/trade-off/SignupWizard";
import { XratedViewTracker } from "@/components/trade-off/XratedViewTracker";

export const metadata: Metadata = {
  title: "Launch your business app — quick signup | Xrated Trades",
  description:
    "Launch your Xrated Trades business app in under 6 minutes. One question per screen, no commission, free for life. Studio, App Store and Industry Packs included on every paid plan.",
  alternates: { canonical: "/trade-off/signup/wizard" }
};

export default function TradeOffSignupWizardPage() {
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedViewTracker page="signup" listingId={null} />
      <XratedHeader />
      <section className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:pt-8">
        <SignupWizard />
      </section>
      <XratedFooter />
    </main>
  );
}
