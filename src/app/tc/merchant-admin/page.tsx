// /tc/merchant-admin — Merchant dashboard.
//
// The merchant equivalent of /tc/hub. One landing page pulling every
// merchant-side surface into a single "today" view.
//
// Uses SUI resolver so identity is loaded once + shared across every
// panel. Composer at the top for cross-area posts.

"use client";

import Link from "next/link";
import {
  MessageSquare,
  ShoppingBag,
  FileText,
  Image as ImageIcon,
  Package,
  Store,
  Users,
  ArrowRight
} from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { UniversalComposer } from "@/apps/hub/components/UniversalComposer";
import { RevenueSummary } from "@/apps/merchant/components/RevenueSummary";
import { MerchantOrdersPanel } from "@/apps/merchant/components/MerchantOrdersPanel";
import { ProductInsightsPanel } from "@/apps/merchant/components/ProductInsightsPanel";
import { computeMerchantStats } from "@/apps/merchant/lib/merchantStats";
import { currentViewerTrade } from "@/apps/identity/data/tradeIdentities";
import { MERCHANT_FIXTURES } from "@/apps/tradecenter/data/merchants";

// For the demo, Bob is trade-only. We render the merchant dashboard for
// the flagship merchant fixture instead. In production, the SUI resolver
// picks the right merchant slug for the current viewer.
const DEMO_MERCHANT_SLUG = "manchester-tools-direct";

const QUICK_LINKS = [
  { href: "/tc/messages",                                          label: "Messages",     Icon: MessageSquare, colour: "#166534" },
  { href: "/tc/orders",                                            label: "Orders",       Icon: ShoppingBag,   colour: "#F59E0B" },
  { href: "/tc/merchant-admin/images",                             label: "Product images", Icon: ImageIcon,   colour: "#B45309" },
  { href: `/tc/trade-center/merchant/${DEMO_MERCHANT_SLUG}`,        label: "Store front",   Icon: Store,       colour: "#166534" },
  { href: `/tc/trade-center/plastering`,                            label: "Marketplace",   Icon: Package,     colour: "#0A0A0A" }
];

export default function MerchantAdminPage() {
  const identity = currentViewerTrade();
  const merchant = MERCHANT_FIXTURES.find((m) => m.slug === DEMO_MERCHANT_SLUG);
  const stats = computeMerchantStats(DEMO_MERCHANT_SLUG);

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        {/* Header */}
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              Trade Center · Merchant admin
            </div>
            <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
              {merchant?.displayName ?? "Merchant"}
            </h1>
            <p className="mt-1 text-[12px] leading-snug text-neutral-600 md:text-[13px]">
              Every merchant number at a glance — revenue, funds held, orders needing action, top products by trade demand.
            </p>
          </div>
          <Link
            href={`/tc/trade-center/merchant/${DEMO_MERCHANT_SLUG}`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border bg-white px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-800 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <Store size={13}/>
            View store front
          </Link>
        </header>

        {/* Revenue summary */}
        <RevenueSummary stats={stats}/>

        {/* Universal Composer — same as /tc/hub */}
        <UniversalComposer identity={identity}/>

        {/* Quick links row */}
        <section>
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Jump to
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {QUICK_LINKS.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border bg-white p-2 shadow-sm transition hover:shadow-md"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${a.colour}18`, color: a.colour }}
                  >
                    <a.Icon size={15} strokeWidth={2}/>
                  </div>
                  <div className="text-[10px] font-black text-neutral-900">{a.label}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Two-column: orders + product insights */}
        <div className="grid gap-6 lg:grid-cols-2">
          <MerchantOrdersPanel merchantSlug={DEMO_MERCHANT_SLUG}/>
          <ProductInsightsPanel merchantSlug={DEMO_MERCHANT_SLUG}/>
        </div>

        {/* Footer trust callouts */}
        <section
          className="rounded-2xl border p-4 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <FooterMetric Icon={Users} label="Followers"       value={stats.followerCount.toLocaleString()}    subtitle="reach + repeat"/>
            <FooterMetric Icon={FileText} label="Trade account applications" value="3" subtitle="awaiting review"/>
            <FooterMetric Icon={ArrowRight} label="Response time"           value="< 1 hour" subtitle="median 42 min"/>
          </div>
        </section>
      </main>
    </div>
  );
}

function FooterMetric({
  Icon,
  label,
  value,
  subtitle
}: {
  Icon: typeof Users;
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: "#F5F0E4", color: "#525252" }}
      >
        <Icon size={14}/>
      </div>
      <div>
        <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">{label}</div>
        <div className="mt-0.5 text-[15px] font-black text-neutral-900">{value}</div>
        <div className="text-[10px] text-neutral-500">{subtitle}</div>
      </div>
    </div>
  );
}
