// Dedicated "Downloads" page.
//
// Standalone surface a tradesperson can share separately from their
// main profile — e.g. "Here are my brochures and trade-account forms:
// xratedtrade.com/<slug>/downloads". Hero up top so the visitor knows
// whose files these are; full DownloadsGrid below, grouped by category.
//
// Gated to paid tier AND the `downloads` add-on enabled. Unlike Trusted
// Trades (now free for every tier) Downloads is a paid add-on, so a
// free or downloaded-off profile redirects back to /<slug>.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { supabase, type HammerexTradeOffListing } from "@/lib/supabase";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { PremiumHero } from "@/components/xrated/profile/PremiumHero";
import { DownloadsGrid } from "@/components/xrated/profile/DownloadsGrid";
import { tradeLabel, whatsappQuoteUrl } from "@/lib/tradeOff";
import { effectiveTier } from "@/lib/xratedTrades";
import { isDownloadsOn } from "@/lib/xratedAddons";

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
  if (!listing) return { title: "Downloads" };
  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const primary = tradeLabel(listing.primary_trade);
  const title = `${firstName}'s downloads — ${primary} in ${listing.city} | Xrated`;
  return {
    title,
    description: `${firstName} (${primary} in ${listing.city}) publishes brochures, forms and compliance documents — tap any tile to download.`,
    alternates: { canonical: `/${slug}/downloads` }
  };
}

export default async function DownloadsPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();

  // Paid + add-on gate. Free profiles or paid profiles with Downloads
  // toggled off bounce back to the main profile rather than render an
  // empty page.
  const tier = effectiveTier(listing);
  const isPaid = tier === "app_trial" || tier === "app_paid";
  if (!isPaid || !isDownloadsOn(listing)) redirect(`/${slug}`);

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
            Downloads &middot; published by {firstName}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl md:text-4xl">
            {firstName}&rsquo;s{" "}
            <span style={{ color: "#FFB300" }}>downloads.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-neutral-600 sm:text-sm">
            Brochures, documents and forms &mdash; tap to download.
          </p>
        </div>
      </section>

      <DownloadsGrid listing={listing} />

      <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6">
        <div
          className="overflow-hidden rounded-3xl px-6 py-8 text-center sm:px-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            Are you a tradesperson with documents to share?
          </p>
          <h2 className="mt-2 text-xl font-extrabold leading-tight text-white sm:text-2xl">
            Get your own Xrated profile and{" "}
            <span style={{ color: "#FFB300" }}>publish your downloads.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[13px] leading-relaxed text-white/70 sm:text-sm">
            14-day free trial &mdash; no card. Brochures, forms and compliance docs your
            customers can tap to download. Email-gate the marketing
            documents and turn them into a lead-capture funnel.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`/trade-off/signup?ref=${encodeURIComponent(slug)}`}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-xs font-extrabold uppercase tracking-wider text-neutral-900 shadow-lg transition active:scale-[0.98] sm:text-sm"
              style={{ background: "#FFB300" }}
            >
              Start free trial
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
    </main>
  );
}
