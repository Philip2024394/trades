// Xrated Trades — Verified waitlist signup.
// Verified tier launches Q3 2026. Until then, tradies who want first dibs
// on the verified badge land here, drop their email + trade + company,
// and we lock them at £19.99/mo for life when the tier goes live.
//
// Page is a server shell wrapping the client form. Submissions POST to
// /api/trade-off/verified-waitlist (TODO once the queue ops are built —
// for now the form posts to /api/trade-off/request-upgrade with a
// kind=verified-waitlist flag so it ends up in the same admin inbox).

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";
import { VerifiedWaitlistForm } from "./VerifiedWaitlistForm";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "Xrated Verified Waitlist — £19.99/mo locked for life. Launching Q3 2026.",
  description:
    "Join the Xrated Verified waitlist and lock £19.99/mo for life as a founding member. The Verified badge is backed by company-registration check, with optional Insurance + On-site add-on badges. Launching Q3 2026.",
  alternates: { canonical: "/trade-off/verified-waitlist" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Xrated Verified Waitlist — £19.99/mo locked for life. Launching Q3 2026.",
    description:
      "Join the waitlist and lock £19.99/mo for life as a founding Verified member.",
    url: absolute("/trade-off/verified-waitlist")
  }
};

const VALUE_POINTS = [
  {
    title: "Verified badge on your profile",
    body: "Backed by a real company-registration check. Customers see a badge that means something."
  },
  {
    title: "Optional add-on badges",
    body: "Layer 'Insured for private work' and 'On-site checked' (for gas / electrical / structural / scaffolding) on top of your Verified mark — both free with the subscription."
  },
  {
    title: "Priority lead-routing in search",
    body: "Verified profiles appear first when customers filter by trade + area. The badge is the conversion lever; routing makes it work."
  },
  {
    title: "Dispute mediation",
    body: "If a customer disputes a review or a job goes sideways, we step in. Verified members get the queue first."
  },
  {
    title: "Founding-member price lock",
    body: "Join the waitlist now and your subscription stays at £19.99/mo for life — even after we open the tier publicly at full price."
  }
];

export default function VerifiedWaitlistPage() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div
          aria-hidden="true"
          className="absolute -right-32 -top-24 h-72 w-72 rounded-full blur-3xl"
          style={{ background: `${XRATED_BRAND.accent}33` }}
        />
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3zm-1.2 14L7 12.2l1.4-1.4 2.4 2.4 5.4-5.4L17.6 9l-6.8 7z" />
            </svg>
            Xrated Verified — waitlist
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            Lock <span style={{ color: XRATED_BRAND.accent }}>£19.99/mo for life</span> — be a founding Verified member.
          </h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
            Verified launches Q3 2026. Waitlist members get the price locked
            at £19.99/mo for life, first place in the verification queue, and
            the founding-member badge variant. The required check is active
            company registration — Insurance + On-site verification are
            optional add-on badges.
          </p>
        </div>
      </section>

      {/* Two-column: form + value points */}
      <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          <div>
            <VerifiedWaitlistForm />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
              What you get on launch day
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {VALUE_POINTS.map((p) => (
                <li
                  key={p.title}
                  className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
                >
                  <span
                    className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ background: XRATED_BRAND.accent }}
                    aria-hidden="true"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-neutral-900">{p.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Back link */}
      <section className="mx-auto max-w-5xl px-4 pb-2 pt-12 sm:px-6 sm:pt-16">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="/trade-off/pricing"
            className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-5 text-xs font-bold uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-50 sm:text-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to pricing
          </a>
          <a
            href="/trade-off/signup"
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-5 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:text-sm"
            style={{ background: XRATED_BRAND.accent }}
          >
            Start Paid trial instead
          </a>
        </div>
      </section>

      <XratedFooter />
    </main>
  );
}
