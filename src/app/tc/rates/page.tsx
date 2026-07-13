// /tc/rates — Rate Card Marketplace (R08).
//
// Trade edits their own labour-rate menu on the left, sees a live public
// preview on the right, and (below) the government-sourced regional
// baseline so they can see where their rates sit vs the ONS median.
// Trade Center never recommends a rate — this surface is a mirror +
// workflow, not an advisor.
//
// Evidence-or-silence rule (project_evidence_or_silence.md): the
// "regional benchmark" section previously rendered from fabricated
// fixture data and was replaced with the government-baseline surface
// that reads from app_rates_gov (Phase 2). When the ingest hasn't
// populated data for the trade+region yet, the UI shows an honest
// "waiting for ONS ingest" banner — never a made-up number.

"use client";

import { useState } from "react";
import Link from "next/link";
import { PoundSterling, Share2, TrendingUp, ArrowLeft, Info, ExternalLink } from "lucide-react";
import { MarketplaceHeader } from "@/apps/marketplace/components/MarketplaceHeader";
import { RateCardEditor } from "@/apps/rates/components/RateCardEditor";
import { RateCardPanel } from "@/apps/rates/components/RateCardPanel";
import { ContributeRateForm } from "@/apps/rates/components/ContributeRateForm";
import {
  findRateCard,
  type RateCard
} from "@/apps/rates/data/rateCards";
import { currentViewerTrade } from "@/apps/identity/data/tradeIdentities";

export default function RateCardPage() {
  const viewer = currentViewerTrade();
  const seed = findRateCard(viewer.slug);

  const [card, setCard] = useState<RateCard | undefined>(seed);

  if (!card) {
    return (
      <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
        <MarketplaceHeader activeCategorySlug={null}/>
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
          <PoundSterling size={40} className="text-neutral-400" strokeWidth={1.5}/>
          <h1 className="text-[20px] font-black text-neutral-900">
            Publish your rate card
          </h1>
          <p className="max-w-md text-[12px] leading-snug text-neutral-600">
            Set your labour rates once and customers see them before they call. Trade Center
            never recommends numbers — you set every rate.
          </p>
          <Link
            href="/tc/identity"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-6 text-[12px] font-black uppercase tracking-wider text-white shadow-sm"
            style={{ backgroundColor: "#166534" }}
          >
            Get started
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <MarketplaceHeader activeCategorySlug={null}/>
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/tc/identity"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-white px-3 text-[11px] font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <ArrowLeft size={12}/>
            Your identity
          </Link>
          <Link
            href="/tc/rates/network"
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-black uppercase tracking-wider shadow-sm transition hover:brightness-105"
            style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
          >
            <TrendingUp size={12}/>
            Browse UK network rates
          </Link>
          <Link
            href="/tc/rates/plastering"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-white px-3 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            🧱 Plastering service menu
          </Link>
        </div>

        {/* Header */}
        <header className="mt-3 mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              Trade Center · Rate Card
            </div>
            <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
              Your published rates
            </h1>
            <p className="mt-1 text-[12px] leading-snug text-neutral-600 md:text-[13px]">
              Customers self-qualify before calling. You stop wasting mornings on tire-kickers.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border bg-white px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-800 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <Share2 size={13}/>
            Share your rate card
          </button>
        </header>

        {/* Editor + live preview */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <RateCardEditor initial={card} onChange={setCard}/>
          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              How customers see it
            </div>
            <RateCardPanel card={card}/>
          </aside>
        </div>

        {/* Government baseline — Phase 2 honest empty state.
            Reads from app_rates_gov which is populated by scheduled
            ONS ASHE ingest (see src/lib/rates/INGEST.md). When no row
            exists for the trade+region, this banner explains what
            will populate it and links to the raw ONS dataset so any
            trade can go verify the methodology themselves. Fabricated
            "middle band" claims removed per
            project_evidence_or_silence.md. */}
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp size={14} className="text-amber-700"/>
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">
              Regional benchmark
            </div>
          </div>
          <div
            className="rounded-2xl border p-5 shadow-sm"
            style={{ backgroundColor: "#FEF3C7", borderColor: "rgba(180,83,9,0.30)" }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
              >
                <Info size={16}/>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-black text-neutral-900">
                  Verified regional rate data — coming soon
                </div>
                <p className="mt-1 text-[12px] leading-snug text-neutral-700">
                  We only display rate benchmarks backed by government data (ONS Annual Survey of Hours and Earnings, CITB Skills Network, HMRC PAYE) or verified user submissions (minimum 3 independent contributors within 3 months, standard deviation under 15%).
                </p>
                <p className="mt-2 text-[11px] leading-snug text-neutral-600">
                  If we don&apos;t have that data yet for your trade and region, we&apos;d rather show you nothing than a made-up number. This section will populate once our ingest reads the latest ONS release.
                </p>
                <a
                  href="https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkingtime/bulletins/annualsurveyofhoursandearnings/latest"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-800 hover:underline"
                >
                  <ExternalLink size={11}/>
                  See the raw ONS ASHE data
                </a>
              </div>
            </div>
          </div>

          {/* Contribute form — trade can help unlock the verified
              market signal by submitting real rates. Rules exposed
              in-form: 3+ contributors, 3-month rolling window, <15%
              stdev. Anonymised in displayed aggregates. */}
          <div className="mt-4">
            <ContributeRateForm
              defaultTradeSlug={card.discipline}
              defaultRegionCode={undefined}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
