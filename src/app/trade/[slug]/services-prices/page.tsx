// Dedicated "Services & Prices" page.
//
// Standalone surface a tradesperson can share separately from their main
// profile — e.g. "Here's my full price list:
// xratedtrade.com/<slug>/services-prices". Hero up top so the visitor
// knows whose price list this is, full ServicesPricedGrid below with
// optional category grouping.
//
// Gated to paid tier AND `services_grid` add-on enabled. Free profiles
// (or paid profiles with the add-on off) bounce back to /<slug> so we
// never render a dead page.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { supabase, type HammerexTradeOffListing } from "@/lib/supabase";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { PremiumHero } from "@/components/xrated/profile/PremiumHero";
import { ServicesPricedGrid } from "@/components/xrated/profile/ServicesPricedGrid";
import { ShopCartIsland } from "@/components/xrated/profile/ShopCartIsland";
import { tradeLabel, whatsappQuoteUrl } from "@/lib/tradeOff";
import { effectiveTier } from "@/lib/xratedTrades";
import { isServicesGridOn } from "@/lib/xratedAddons";

export const revalidate = 300;

async function loadListing(
  slug: string
): Promise<HammerexTradeOffListing | null> {
  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  return (res.data ?? null) as HammerexTradeOffListing | null;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) return { title: "Services & Prices" };
  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const primary = tradeLabel(listing.primary_trade);
  const title = `${firstName}'s Services & Prices — ${primary} in ${listing.city} | Xrated`;
  return {
    title,
    description: `${firstName} (${primary} in ${listing.city}) publishes a live price list — tap any service to send a quick WhatsApp enquiry or bundle several into one message.`,
    alternates: { canonical: `/${slug}/services-prices` }
  };
}

export default async function ServicesPricesPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();

  // Paid + add-on gate. If the trade isn't paid OR the services_grid
  // add-on is off, redirect back to the main profile rather than render
  // an empty page.
  const tier = effectiveTier(listing);
  const isPaid = tier === "app_trial" || tier === "app_paid";
  if (!isPaid || !isServicesGridOn(listing)) redirect(`/${slug}`);

  const primary = tradeLabel(listing.primary_trade);
  const waUrl = whatsappQuoteUrl(
    listing.whatsapp,
    listing.display_name,
    primary
  );
  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;

  return (
    <main className="flex flex-1 flex-col pb-20 md:pb-0">
      <PremiumHero listing={listing} waUrl={waUrl} currentPage="profile" />

      <section className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
        {/* Breadcrumb back to main profile */}
        <a
          href={`/${slug}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-xs font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:text-sm"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to {firstName}&rsquo;s profile
        </a>

        <div className="mt-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            Services &amp; Prices · published by {firstName}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl md:text-4xl">
            {firstName}&rsquo;s{" "}
            <span style={{ color: "#FFB300" }}>services &amp; prices.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-neutral-600 sm:text-sm">
            Browse the full list — tap any tile to see the detail. Send a quick
            WhatsApp enquiry for a single item, or add several to your cart and
            bundle them into one structured message. {firstName} confirms the
            final price by WhatsApp before any work starts.
          </p>
        </div>
      </section>

      <ServicesPricedGrid listing={listing} />

      <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6">
        <div
          className="overflow-hidden rounded-3xl px-6 py-8 text-center sm:px-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            Are you a tradesperson with priced services?
          </p>
          <h2 className="mt-2 text-xl font-extrabold leading-tight text-white sm:text-2xl">
            Get your own Xrated profile and{" "}
            <span style={{ color: "#FFB300" }}>publish your price list.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-xs leading-relaxed text-white/70 sm:text-sm">
            14-day free trial — no card. Tile grid + dedicated price-list page
            customers can share. The link in your bio that wins the job.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`/trade-off/signup?ref=${encodeURIComponent(slug)}`}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-xs font-extrabold uppercase tracking-wider text-neutral-900 shadow-lg transition active:scale-[0.98] sm:text-sm"
              style={{ background: "#FFB300" }}
            >
              Join XratedTrade
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
            <a
              href="/trade-off/pricing"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-white/30 bg-white/5 px-5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              See pricing
            </a>
          </div>
        </div>
      </section>

      <div className="mt-auto">
        {!isPaid && <XratedHeader />}
        <XratedFooter />
      </div>

      {/* Spacer reserves height for the floating cart island so the page
          footer + last content isn't covered. */}
      <div aria-hidden="true" className="h-[72px]" />
      <ShopCartIsland slug={listing.slug} />
    </main>
  );
}
