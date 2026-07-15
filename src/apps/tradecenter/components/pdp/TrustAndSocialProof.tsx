// PDP Trust + Social Proof block.
//
// Two sections:
//   1. "In demand with UK trades" — trade-native counters (Notebook,
//      Verified Trade orders, Job Cost estimate appearances, trending)
//   2. "Shop with confidence" — trust confirmations (Trade Center
//      Guaranteed, Verified Merchant, dispatch, returns, save)
//
// Rock-solid rule: no fake FOMO. Every number ties to real trade
// activity (Notebook adds are real, orders are real, job cost lines
// are real). Nothing here is a made-up "20 people watching."

import Link from "next/link";
import {
  Notebook as NotebookIcon,
  Users,
  TrendingUp,
  MapPin,
  ShieldCheck,
  Truck,
  RotateCcw,
  Heart,
  Store,
  Sparkles
} from "lucide-react";
import type { ProductSocialProof, TrustConfirmations } from "../../data/socialProof";
import type { TradeCenterMerchant } from "../../data/merchants";

type Props = {
  socialProof?: ProductSocialProof;
  trust: TrustConfirmations;
  merchant: TradeCenterMerchant;
};

export function TrustAndSocialProof({ socialProof, trust, merchant }: Props) {
  const hasSignals =
    socialProof &&
    (socialProof.notebookCount > 0 ||
      socialProof.verifiedTradeOrders30d > 0 ||
      socialProof.jobCostAppearancesMonth > 0);

  return (
    <div className="flex flex-col gap-3">
      {/* ─── In demand with UK trades ─── */}
      {hasSignals && socialProof && (
        <section
          className="rounded-2xl border p-4 shadow-sm"
          style={{
            borderColor: "rgba(139,69,19,0.15)",
            backgroundColor: "#FFFDF8"
          }}
        >
          <div className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-amber-600"/>
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">
              In demand with UK trades
            </div>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {socialProof.notebookCount > 0 && (
              <ProofRow
                Icon={NotebookIcon}
                headline={`In ${socialProof.notebookCount.toLocaleString()} traders' Notebooks`}
                detail={
                  socialProof.nearbyNotebookCount && socialProof.nearbyCity
                    ? `${socialProof.nearbyNotebookCount} in ${socialProof.nearbyCity} area`
                    : "Verified trades committed this to their supply list"
                }
              />
            )}
            {socialProof.verifiedTradeOrders30d > 0 && (
              <ProofRow
                Icon={Users}
                headline={`Ordered by ${socialProof.verifiedTradeOrders30d} Verified Trades`}
                detail="In the last 30 days"
              />
            )}
            {socialProof.jobCostAppearancesMonth > 0 && (
              <ProofRow
                Icon={TrendingUp}
                headline={`Featured in ${socialProof.jobCostAppearancesMonth} active Job Cost estimates`}
                detail="Professionals budgeting this into paid jobs this month"
              />
            )}
            {socialProof.trending && (
              <ProofRow
                Icon={TrendingUp}
                headline={`Trending in ${socialProof.trending.category}`}
                detail={`Moved ${socialProof.trending.positionsMoved > 0 ? "up" : "down"} ${Math.abs(socialProof.trending.positionsMoved)} positions this week`}
              />
            )}
            {socialProof.nearbyStockingMerchants && socialProof.nearbyStockingMerchants > 0 && (
              <ProofRow
                Icon={MapPin}
                headline={`Stocked by ${socialProof.nearbyStockingMerchants} nearby verified merchants`}
                detail="In case this one's out — nearest-first order"
              />
            )}
          </ul>
          <p className="mt-3 rounded-md bg-neutral-50 p-2 text-[9.5px] leading-snug text-neutral-500">
            Every number here is real trade activity, aggregated + anonymised. No fabricated FOMO.
          </p>
        </section>
      )}

      {/* ─── Shop with confidence ─── */}
      <section
        className="rounded-2xl border p-4 shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
          Shop with confidence
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          <TrustRow
            Icon={ShieldCheck}
            colour="#166534"
            headline="Trade Center Guaranteed"
            detail={
              trust.tradeCenterGuaranteed
                ? "Orders £100+ have your payment held by our regulated partner (Stripe up to £5k, Shieldpay above) until you confirm delivery. Trade Center arbitrates disputes."
                : "Coming soon — orders £100+ will be held by our regulated escrow partner."
            }
            planned={!trust.tradeCenterGuaranteed}
          />
          <TrustRow
            Icon={Store}
            colour="#0A0A0A"
            headline={`Verified Merchant · ${trust.verifiedLayers}/${trust.layersTotal}`}
            detail={`${merchant.displayName} — Companies House · Insurance · ${merchant.yearsTrading}yrs trading verified`}
            href={`/tc/trade-center/merchant/${merchant.slug}`}
          />
          <TrustRow
            Icon={Heart}
            colour="#B45309"
            headline="Save to your Notebook"
            detail="We'll alert you on restocks and trade-price changes. Your Notebook is private to you."
            href="/tc/notebook"
          />
          {trust.dispatchPromise && (
            <TrustRow
              Icon={Truck}
              colour="#0A0A0A"
              headline={trust.dispatchPromise}
              detail={
                trust.sameDayCutoffLocalTime
                  ? `Order before ${trust.sameDayCutoffLocalTime} for same-day dispatch`
                  : "Same-day dispatch when available"
              }
            />
          )}
          <TrustRow
            Icon={RotateCcw}
            colour="#0A0A0A"
            headline="30-day returns"
            detail={trust.returnPolicy}
          />
        </ul>
      </section>
    </div>
  );
}

function ProofRow({
  Icon,
  headline,
  detail
}: {
  Icon: typeof NotebookIcon;
  headline: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-2">
      <div
        className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: "#FEF3C7" }}
      >
        <Icon size={11} className="text-amber-700"/>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-black leading-tight text-neutral-900">
          {headline}
        </div>
        <div className="mt-0.5 text-[10.5px] leading-snug text-neutral-600">
          {detail}
        </div>
      </div>
    </li>
  );
}

function TrustRow({
  Icon,
  colour,
  headline,
  detail,
  href,
  planned
}: {
  Icon: typeof ShieldCheck;
  colour: string;
  headline: string;
  detail: string;
  href?: string;
  planned?: boolean;
}) {
  const body = (
    <li className="flex items-start gap-2">
      <div
        className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${colour}18`, color: colour }}
      >
        <Icon size={11}/>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-[12px] font-black leading-tight text-neutral-900">
            {headline}
          </div>
          {planned && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider"
              style={{ backgroundColor: "#F5F0E4", color: "#525252" }}
            >
              Planned
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[10.5px] leading-snug text-neutral-600">
          {detail}
        </div>
      </div>
    </li>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-md transition hover:bg-neutral-50">
        {body}
      </Link>
    );
  }
  return body;
}
