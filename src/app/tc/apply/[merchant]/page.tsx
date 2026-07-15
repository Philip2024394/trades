// /tc/apply/[merchant] — Open Trade Account application flow.
//
// Composition:
//   TradeCenterHeader                       (persistent nav)
//   Merchant summary                        (who you're applying to)
//   TradeAccountApplicationForm             (autofilled from R07)
//   VerifiedTradeIdentityPanel              (what merchant will see)
//
// Constitution Rule #6: Trade Center hosts the form and orchestrates
// consent. The merchant reviews and grants the credit. Trade Center is
// never the lender or credit broker.

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { TradeAccountApplicationForm } from "@/apps/identity/components/TradeAccountApplicationForm";
import { VerifiedTradeIdentityPanel } from "@/apps/identity/components/VerifiedTradeIdentityPanel";
import { findMerchant } from "@/apps/tradecenter/data/merchants";
import { currentViewerTrade } from "@/apps/identity/data/tradeIdentities";

export const dynamic = "force-dynamic";

export default async function OpenAccountPage({
  params
}: {
  params: Promise<{ merchant: string }>;
}) {
  const { merchant: slug } = await params;
  const merchant = findMerchant(slug);
  if (!merchant) notFound();

  const trade = currentViewerTrade();

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        {/* Back link */}
        <Link
          href={`/tc/trade-center/merchant/${merchant.slug}`}
          className="inline-flex min-h-[44px] items-center gap-2 text-[11.5px] font-bold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft size={13}/>
          Back to {merchant.displayName}
        </Link>

        {/* Header */}
        <header className="mt-3 mb-6 md:mb-8">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Trade Center · Open Trade Account
          </div>
          <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
            Apply for a trade account with {merchant.displayName}
          </h1>
          <p className="mt-1 text-[12px] leading-snug text-neutral-600 md:text-[13px]">
            Your Verified Trade Identity autofills the entire application. Estimated time to submit: 60 seconds.
          </p>
        </header>

        {/* Two-column layout: form (left) + identity preview (right) */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <TradeAccountApplicationForm merchant={merchant} trade={trade}/>

          <aside className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              What {merchant.displayName} will see
            </div>
            <VerifiedTradeIdentityPanel trade={trade} compact/>
          </aside>
        </div>
      </main>
    </div>
  );
}
