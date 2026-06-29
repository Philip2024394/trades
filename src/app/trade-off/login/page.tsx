// Public login page for tradespeople. WhatsApp number + password.
//
// On success we hard-navigate (window.location) to the edit dashboard so
// the freshly-set session cookie is included in the next request (the
// router.push path was occasionally racing the cookie on dev). On
// requires_first_login we route to /trade-off/set-password with the
// number pre-filled — that flow asks the tradesperson to paste their
// existing edit_token to prove ownership.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { TradeLoginForm } from "./TradeLoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Log in | xratedtrade.com",
  robots: { index: false, follow: false }
};

export default function TradeOffLoginPage() {
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-md px-4 pb-16 pt-12">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
          xratedtrade.com
        </p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">
          Log in to your app
        </h1>
        <p className="mt-2 text-[13px] leading-snug text-brand-muted">
          Use the WhatsApp number you signed up with and your password.
        </p>
        <div className="mt-8">
          <TradeLoginForm />
        </div>
      </section>
      <XratedFooter />
    </main>
  );
}
