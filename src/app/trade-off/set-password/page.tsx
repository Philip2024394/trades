// First-login / claim-account page. Legacy tradespeople (those who
// signed up before password auth shipped) land here from the login form
// when /api/trade-off/login returns requires_first_login: true. They
// prove ownership with their original edit_token (delivered by the
// magic-link email) + their WhatsApp number, then pick a password.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { SetPasswordForm } from "./SetPasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set your password | xratedtrade.com Trade Off",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ wa?: string | string[] }>;

export default async function SetPasswordPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const rawWa = Array.isArray(sp.wa) ? sp.wa[0] : sp.wa;
  const wa = typeof rawWa === "string" ? rawWa : "";

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-md px-4 pb-16 pt-12">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
          Trade Off
        </p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">
          Set your password
        </h1>
        <p className="mt-2 text-[13px] leading-snug text-brand-muted">
          One-time setup. Use your WhatsApp number and the token from the
          original signup email — then pick a password you'll remember.
        </p>
        <div className="mt-8">
          <SetPasswordForm initialWhatsapp={wa} />
        </div>
      </section>
      <XratedFooter />
    </main>
  );
}
