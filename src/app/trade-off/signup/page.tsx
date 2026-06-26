// Hammerex Trade Off — onboarding wizard
// Single-screen vertical form. Form lives in TradeOffForm so the same UX
// can be reused by the /trade-off/edit/[slug] page.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { TradeOffForm } from "./TradeOffForm";
import { XratedViewTracker } from "@/components/trade-off/XratedViewTracker";

export const metadata: Metadata = {
  title: "Join Trade Off — list yourself for free | Hammerex",
  description:
    "Add your trade profile to Hammerex Trade Off. Free for life, WhatsApp-only, no commissions. Customers find you, you quote.",
  alternates: { canonical: "/trade-off/signup" }
};

const SIGNUP_HERO =
  "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/branding/xrated-signup-hero.png";

export default function TradeOffSignupPage() {
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedViewTracker page="signup" listingId={null} />
      <XratedHeader />

      <section className="relative bg-black">
        <div className="relative h-56 w-full overflow-hidden sm:h-72 md:h-96">
          <img
            src={SIGNUP_HERO}
            alt="Xrated Trades — list your trade"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/0" />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl px-4 pb-5 sm:pb-7">
            <p className="text-xs font-bold uppercase tracking-widest text-[#FFB300]">
              Xrated Trades · Sign up
            </p>
            <h1 className="mt-1.5 text-2xl font-extrabold leading-tight text-white drop-shadow-md sm:text-4xl">
              List yourself on Xrated Trades
            </h1>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-6 pt-6">
        <p className="max-w-xl text-xs text-brand-muted sm:text-sm">
          Free for life. Photos of your work, where you operate, a WhatsApp number.
          That's it — no reviews, no ratings, no commission. We send customers
          your way; the job stays between you and them.
        </p>
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <TradeOffForm mode={{ kind: "create" }} />
      </section>
      <XratedFooter />
    </main>
  );
}
