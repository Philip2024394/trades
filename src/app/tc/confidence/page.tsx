// /tc/confidence — R05 Confidence Card, trade-side viewer.
//
// The trade lands here after the customer has signed the consent screen
// at /tc/confidence/consent/[token] (below). Renders the Confidence Card
// panel with all aggregated signals from partners + public registers +
// nominated trade references + Trade Center native history.
//
// Constitution Rule #6 surfaced everywhere: sources shown per signal,
// pass-through cost displayed, information not advice disclaimer.

import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { ConfidenceCardPanel } from "@/apps/identity/components/ConfidenceCardPanel";
import { buildDemoConfidenceCard } from "@/apps/identity/data/confidenceCard";

export const dynamic = "force-dynamic";

export default function ConfidenceCardPage() {
  const card = buildDemoConfidenceCard();

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <Link
          href="/tc/trade-center/plastering"
          className="inline-flex min-h-[44px] items-center gap-2 text-[11.5px] font-bold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft size={13}/>
          Back to marketplace
        </Link>

        <header className="mt-3 mb-6 flex flex-col gap-2 md:mb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              New-Customer Confidence Card · R05
            </div>
            <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
              Confidence Card for {card.subjectName}
            </h1>
            <p className="mt-1 text-[12px] leading-snug text-neutral-600 md:text-[13px]">
              Aggregated from Companies House, Registry Trust, Creditsafe, nominated trade
              references, and your Trade Center payment history. Trade Center is the pipe.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border bg-white px-4 text-[11px] font-black uppercase tracking-wider text-neutral-700 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <RefreshCw size={13}/>
            Re-run signals
          </button>
        </header>

        <ConfidenceCardPanel card={card}/>
      </main>
    </div>
  );
}
