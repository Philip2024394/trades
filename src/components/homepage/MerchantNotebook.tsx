// Section 6 — Builders Merchant Notebook.
//
// Same visual system as the LiveNotebook but for a merchant.
// Products / Offers / Trade Circle / Branches. Editorial split
// layout: photo-like left panel, notebook preview right.

import {
  Store,
  MapPin,
  Users,
  Package,
  TicketPercent,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import type { MerchantContent } from "./types";

export function MerchantNotebook({
  overline,
  headline,
  subheadline,
  merchant,
  ctaLabel = "Open a Merchant Notebook",
  ctaHref = "/register?type=merchant"
}: {
  overline: string;
  headline: string;
  subheadline: string;
  merchant: MerchantContent;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <section className="bg-neutral-50 py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
        <div className="grid gap-12 md:grid-cols-12 md:gap-16 md:items-center">
          {/* LEFT — copy stack */}
          <div className="md:col-span-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold uppercase tracking-wider text-neutral-700 shadow-sm">
              <Store className="h-3.5 w-3.5" aria-hidden />
              {overline}
            </div>
            <h2 className="mt-6 text-[36px] font-bold leading-[1.1] tracking-tight text-neutral-900 md:text-[48px]">
              {headline}
            </h2>
            <p className="mt-4 text-[17px] leading-[1.55] text-neutral-600 md:text-[18px]">
              {subheadline}
            </p>
            <ul className="mt-6 space-y-3 text-[15px] text-neutral-700">
              <Bullet>Your own branded landing page.</Bullet>
              <Bullet>Products, offers and promotions in one place.</Bullet>
              <Bullet>Every trade you supply becomes part of your circle.</Bullet>
              <Bullet>Real demand from real trades, no lead-broker fees.</Bullet>
            </ul>
            <div className="mt-8">
              <Link
                href={ctaHref}
                className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-neutral-900 px-6 text-[15px] font-bold text-white transition hover:bg-neutral-800"
              >
                {ctaLabel}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          {/* RIGHT — merchant notebook mock */}
          <div className="md:col-span-7">
            <MerchantMock merchant={merchant} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
        aria-hidden
      />
      {children}
    </li>
  );
}

function MerchantMock({ merchant }: { merchant: MerchantContent }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl">
      {/* Cover strip — solid brand colour instead of stock image */}
      <div
        className="h-32 md:h-40"
        style={{
          background:
            "linear-gradient(135deg, #0f0f0f 0%, #333 60%, #FFB300 140%)"
        }}
      />
      <div className="relative px-5 pb-6 pt-0 md:px-8 md:pb-8">
        {/* Avatar bumping up over the cover */}
        <div className="-mt-10 flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-amber-400 text-[24px] font-black text-neutral-900 shadow-md md:h-24 md:w-24 md:text-[28px]">
          {merchant.name
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div className="mt-3">
          <h3 className="text-[22px] font-bold text-neutral-900 md:text-[26px]">
            {merchant.name}
          </h3>
          <div className="mt-1 inline-flex items-center gap-1 text-[13px] text-neutral-500">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {merchant.city} · {merchant.branchCount} branches
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <MStat
            icon={<Package className="h-4 w-4" aria-hidden />}
            n={String(merchant.productCount)}
            label="Products"
          />
          <MStat
            icon={<Users className="h-4 w-4" aria-hidden />}
            n={String(merchant.circleSize)}
            label="Trade Circle"
          />
          <MStat
            icon={<TicketPercent className="h-4 w-4" aria-hidden />}
            n="1"
            label="Offer live"
          />
        </div>

        {/* Featured offer card */}
        <div className="mt-5 rounded-2xl bg-amber-50 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[13px] font-semibold uppercase tracking-wide text-amber-800">
              This week
            </div>
            <div className="text-[13px] text-amber-800">
              Until {merchant.offer.validUntil}
            </div>
          </div>
          <div className="mt-1 text-[16px] font-bold text-neutral-900">
            {merchant.offer.label}
          </div>
        </div>

        {/* Product row */}
        <div className="mt-5">
          <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            Featured products
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-neutral-100 bg-neutral-50 p-3"
              >
                <div className="aspect-square rounded-lg bg-white" />
                <div className="mt-2 text-[13px] font-semibold text-neutral-900">
                  Product {i}
                </div>
                <div className="text-[13px] text-neutral-500">£—</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MStat({
  icon,
  n,
  label
}: {
  icon: React.ReactNode;
  n: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-3">
      <div className="flex items-center gap-1 text-[13px] text-neutral-500">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-[22px] font-black text-neutral-900">{n}</div>
    </div>
  );
}
