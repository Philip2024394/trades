// Dedicated "My Trusted Trades" page.
//
// Standalone surface a tradesperson can share separately from their
// main profile — e.g. *"Need a sparky? Here are the ones I work with:
// xratedtrade.com/mike-watson-drywall-manchester/trusted-trades"*.
// Hero up top so the visitor knows whose recommendations these are;
// the full RecommendedTrades grid below has room to breathe.
//
// Gated to paid tier — the recommendation feature itself is paid-only,
// so the dedicated page follows. Free profiles hitting this URL get a
// redirect back to their main profile (no dead page).

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { supabase, type HammerexTradeOffListing } from "@/lib/supabase";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { PremiumHero } from "@/components/xrated/profile/PremiumHero";
import { RecommendedTrades } from "@/components/xrated/profile/RecommendedTrades";
import { tradeLabel, whatsappQuoteUrl } from "@/lib/tradeOff";
import { effectiveTier } from "@/lib/xratedTrades";

export const revalidate = 300;

async function loadListing(slug: string): Promise<HammerexTradeOffListing | null> {
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
  if (!listing) return { title: "Trusted Trades" };
  const firstName = listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const primary = tradeLabel(listing.primary_trade);
  const count = Array.isArray(listing.recommendations)
    ? listing.recommendations.length
    : 0;
  const title = `${firstName}'s Trusted Trades — ${count} other tradespeople ${firstName} recommends | Xrated`;
  return {
    title,
    description: `${firstName} (${primary} in ${listing.city}) personally recommends these ${count} other Xrated tradespeople. Tap any card to see their profile.`,
    alternates: { canonical: `/${slug}/trusted-trades` }
  };
}

export default async function TrustedTradesPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();

  // Paid-tier gate. Free profiles never get the recommendation feature,
  // so this dedicated page redirects them back to their main profile
  // instead of rendering an empty page.
  const tier = effectiveTier(listing);
  const isPaid = tier === "app_trial" || tier === "app_paid";
  if (!isPaid) redirect(`/${slug}`);

  const primary = tradeLabel(listing.primary_trade);
  const waUrl = whatsappQuoteUrl(listing.whatsapp, listing.display_name, primary);
  const firstName = listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const recs = Array.isArray(listing.recommendations) ? listing.recommendations : [];

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
            My Trusted Trades · curated by {firstName}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl md:text-4xl">
            Tradespeople {firstName}{" "}
            <span style={{ color: "#FFB300" }}>personally vouches for.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-neutral-600 sm:text-sm">
            {recs.length === 0
              ? `${firstName} hasn't added any recommendations yet.`
              : `These are the trades ${firstName} works with on real jobs — vetted, trusted and one tap away. Tap any card to see their Xrated profile.`}
          </p>
        </div>
      </section>

      {/* Reuse the RecommendedTrades server component. The hero + page
          heading above set the context; this just renders the grid. */}
      <RecommendedTrades listing={listing} />

      {recs.length === 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-4 sm:px-6">
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
            <p className="text-sm text-neutral-600 sm:text-base">
              When {firstName} recommends other Xrated tradespeople, they
              appear here.
            </p>
            <a
              href={`/${slug}`}
              className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-xs font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.98] sm:text-sm"
              style={{ background: "#FFB300" }}
            >
              Back to profile
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
          </div>
        </section>
      ) : (
        <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6">
          <div
            className="overflow-hidden rounded-3xl px-6 py-8 text-center sm:px-12"
            style={{ background: "#0A0A0A" }}
          >
            <p
              className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: "#FFB300" }}
            >
              Are you a tradesperson too?
            </p>
            <h2 className="mt-2 text-xl font-extrabold leading-tight text-white sm:text-2xl">
              Get your own Xrated profile and{" "}
              <span style={{ color: "#FFB300" }}>
                join {firstName}&rsquo;s network.
              </span>
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-xs leading-relaxed text-white/70 sm:text-sm">
              14-day free trial — no card. Build your own Trusted Trades
              network. The link in your social bio that wins the job.
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
      )}

      <div className="mt-auto">
        {!isPaid && <XratedHeader />}
        <XratedFooter />
      </div>
    </main>
  );
}
