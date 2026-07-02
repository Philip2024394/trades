// Xrated Trades — plan waitlist page (STARTER / BUSINESS).
//
// Reads `?tier=starter` or `?tier=business` from the query string.
// STARTER (£9.99/mo) and BUSINESS (£24.99/mo) are advertised on the
// pricing page as "Coming soon"; this route captures interest until
// billing for each plan is wired.
//
// Falls back to a plan-picker view if the query param is missing or
// invalid, so shared links without a tier still work.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";
import { WaitlistForm, type WaitlistTier } from "./WaitlistForm";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "Xrated Trades — Waitlist. Save your seat for Starter or Business.",
  description:
    "Save your seat on the Starter (£9.99/mo) or Business (£24.99/mo) plan. We email you the moment the plan is live. In the meantime, start on the Free plan or try Professional on a 14-day trial.",
  alternates: { canonical: "/trade-off/waitlist" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title:
      "Xrated Trades — Waitlist. Save your seat for Starter or Business.",
    description:
      "Reserve your seat for the Starter or Business plan on the Business Operating System for trade businesses.",
    url: absolute("/trade-off/waitlist")
  }
};

type TierConfig = {
  eyebrow: string;
  headline: string;
  headlineAccent: string;
  price: string;
  audience: string;
  features: string[];
  compareLine: string;
};

const CONFIG: Record<WaitlistTier, TierConfig> = {
  starter: {
    eyebrow: "Starter plan — waitlist",
    headline: "Reserve your Starter plan seat —",
    headlineAccent: "£9.99/mo when it goes live.",
    price: "£9.99/mo",
    audience: "Small businesses and sole traders",
    features: [
      "Complete Business App",
      "Studio Editor",
      "Core App Store",
      "Product Catalogue",
      "Contact Forms",
      "Basic AI Assistance",
      "Standard Themes"
    ],
    compareLine:
      "Everything above the Free plan and a big step below Professional — designed for solo tradies who need a complete business app without the premium extras."
  },
  business: {
    eyebrow: "Business plan — waitlist",
    headline: "Reserve your Business plan seat —",
    headlineAccent: "£24.99/mo when it goes live.",
    price: "£24.99/mo",
    audience: "Larger merchants and growing companies",
    features: [
      "Everything in Professional",
      "Multi-user accounts",
      "Multiple locations",
      "Advanced AI",
      "Premium Industry Packs",
      "Advanced automation",
      "Priority support",
      "Future enterprise features (as they land)"
    ],
    compareLine:
      "Everything in Professional plus the multi-user, multi-location, advanced AI and priority support features growing merchants need to scale."
  }
};

export default async function WaitlistPage({
  searchParams
}: {
  searchParams?: Promise<{ tier?: string | string[] }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const raw = Array.isArray(sp.tier) ? sp.tier[0] : sp.tier;
  const tier: WaitlistTier | null =
    raw === "starter" || raw === "business" ? raw : null;

  if (!tier) {
    return (
      <main className="bg-white pb-24 md:pb-0">
        <XratedHeader />
        <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.28em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Waitlist
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
            Pick the plan you want to save a seat on.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-neutral-600">
            Two of the four plans are Coming soon. Pick which one you want to
            reserve a seat for — we email you when the plan goes live.
          </p>
          <div className="mx-auto mt-8 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
            <TierPickerCard
              tier="starter"
              title="Starter"
              price="£9.99/mo"
              audience="Sole traders + small businesses"
            />
            <TierPickerCard
              tier="business"
              title="Business"
              price="£24.99/mo"
              audience="Larger merchants + growing companies"
            />
          </div>
        </section>
        <XratedFooter />
      </main>
    );
  }

  const cfg = CONFIG[tier];

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
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            {cfg.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            {cfg.headline}{" "}
            <span style={{ color: XRATED_BRAND.accent }}>
              {cfg.headlineAccent}
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
            {cfg.compareLine} No card needed. We email you the moment the
            plan is live.
          </p>
        </div>
      </section>

      {/* Two-column: form + what you get */}
      <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          <div>
            <WaitlistForm tier={tier} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
              What&rsquo;s in the {tier === "starter" ? "Starter" : "Business"}{" "}
              plan on launch day
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {cfg.features.map((f) => (
                <li
                  key={f}
                  className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
                >
                  <span
                    className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ background: XRATED_BRAND.accent }}
                    aria-hidden="true"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#0A0A0A"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-neutral-900">
                      {f}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Back links + alternate CTAs */}
      <section className="mx-auto max-w-5xl px-4 pb-2 pt-12 sm:px-6 sm:pt-16">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="/trade-off/pricing"
            className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-5 text-xs font-bold uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-50 sm:text-sm"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to pricing
          </a>
          <a
            href="/trade-off/signup?tier=paid&billing=annual"
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-5 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:text-sm"
            style={{ background: XRATED_BRAND.accent }}
          >
            Start Professional trial instead
          </a>
        </div>
      </section>

      <XratedFooter />
    </main>
  );
}

function TierPickerCard({
  tier,
  title,
  price,
  audience
}: {
  tier: WaitlistTier;
  title: string;
  price: string;
  audience: string;
}) {
  return (
    <a
      href={`/trade-off/waitlist?tier=${tier}`}
      className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 text-left transition hover:border-neutral-400 hover:shadow-md"
    >
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: XRATED_BRAND.accent }}
      >
        Coming soon
      </p>
      <p className="mt-2 text-lg font-extrabold text-neutral-900">
        {title} · {price}
      </p>
      <p className="mt-1 text-[12px] text-neutral-500">{audience}</p>
      <span
        className="mt-4 inline-flex h-9 w-fit items-center gap-1 rounded-full px-3 text-[10px] font-extrabold uppercase tracking-widest text-neutral-900"
        style={{ background: XRATED_BRAND.accent }}
      >
        Save my seat →
      </span>
    </a>
  );
}
