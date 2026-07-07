// Section 8 — Membership.
//
// Four tier cards, no comparison table. One tier is featured (visually
// elevated + Construction Yellow accent border). Each card carries a
// single CTA — no upsell chevron chains.

import Link from "next/link";
import { Check } from "lucide-react";
import type { PricingTier } from "./types";

export function Membership({
  overline,
  headline,
  subheadline,
  tiers,
  footNote
}: {
  overline: string;
  headline: string;
  subheadline: string;
  tiers: PricingTier[];
  footNote?: string;
}) {
  return (
    <section className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
        <header className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-[13px] font-semibold uppercase tracking-wider text-neutral-700">
            {overline}
          </div>
          <h2 className="mt-6 text-[36px] font-bold leading-[1.1] tracking-tight text-neutral-900 md:text-[52px]">
            {headline}
          </h2>
          <p className="mt-4 text-[17px] leading-[1.55] text-neutral-600 md:text-[18px]">
            {subheadline}
          </p>
        </header>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => (
            <TierCard key={tier.key} tier={tier} />
          ))}
        </div>

        {footNote ? (
          <p className="mx-auto mt-8 max-w-2xl text-center text-[13px] text-neutral-500">
            {footNote}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function TierCard({ tier }: { tier: PricingTier }) {
  return (
    <div
      className={
        tier.featured
          ? "relative rounded-3xl border-2 border-amber-400 bg-white p-6 shadow-[0_20px_60px_rgba(255,179,0,0.20)]"
          : "rounded-3xl border border-neutral-200 bg-white p-6"
      }
    >
      {tier.featured ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-3 py-1 text-[13px] font-bold text-neutral-900">
          Most popular
        </div>
      ) : null}

      <div className="text-[13px] font-semibold uppercase tracking-wider text-neutral-500">
        {tier.name}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-[36px] font-black leading-none text-neutral-900">
          {tier.priceLabel}
        </span>
        <span className="text-[13px] text-neutral-500">
          {tier.cadenceLabel}
        </span>
      </div>

      <ul className="mt-5 space-y-2.5">
        {tier.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-[13px] text-neutral-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            {b}
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <Link
          href={tier.cta.href}
          className={
            tier.featured
              ? "inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-neutral-900 px-4 text-[15px] font-bold text-white hover:bg-neutral-800"
              : "inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-neutral-200 bg-white px-4 text-[15px] font-semibold text-neutral-900 hover:border-neutral-900"
          }
        >
          {tier.cta.label}
        </Link>
      </div>
    </div>
  );
}
