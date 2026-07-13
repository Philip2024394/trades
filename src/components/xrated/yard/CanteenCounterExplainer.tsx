"use client";

// In-place explainer for The Counter. Fires when a canteen member taps
// "Know The Flow?" on the marketplace stream header. Replaces the main
// canteen feed (same pattern as CanteenProductFocus / CanteenPrivateView)
// so users learn without leaving the canteen or opening a modal.

import { ArrowLeft, Zap, Store, Users, ShieldCheck, Clock, ArrowUpRight } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

export function CanteenCounterExplainer({ onBack }: { onBack: () => void }) {
  return (
    <div className="mb-3">
      {/* Sticky back pill */}
      <div className="mb-3 sticky top-[64px] z-10">
        <button
          onClick={onBack}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-white px-3 text-[11px] font-black uppercase tracking-wider text-neutral-800 shadow-md transition hover:bg-neutral-50"
          style={{ borderColor: BRAND_YELLOW }}
        >
          <ArrowLeft size={12} strokeWidth={2.5}/>
          Back to canteen
        </button>
      </div>

      <article
        className="overflow-hidden rounded-2xl border bg-white shadow-sm"
        style={{ borderColor: `${BRAND_YELLOW}80` }}
      >
        {/* Hero strip */}
        <div
          className="relative overflow-hidden p-5"
          style={{ backgroundColor: BRAND_BLACK }}
        >
          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(circle at 15% 20%, ${BRAND_YELLOW}22 0%, transparent 55%), radial-gradient(circle at 85% 80%, ${BRAND_YELLOW}18 0%, transparent 55%)` }}
          />
          <div className="relative">
            <div className="mb-1 inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: BRAND_YELLOW }}/>
              <span className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
                Know The Flow
              </span>
            </div>
            <h2 className="text-[22px] font-black leading-tight text-white sm:text-[26px]">
              The Counter · one live marketplace across every canteen
            </h2>
            <p className="mt-1.5 max-w-md text-[13px] leading-snug text-white/85">
              Not a static grid. Not a per-canteen silo. One flowing feed of trade deals, seen by every trade on The Network.
            </p>
          </div>
        </div>

        {/* Body — how it works, 4 rows */}
        <div className="p-4 sm:p-5">
          <Row
            icon={Zap}
            title="One feed, every canteen"
            body="The Counter runs on every canteen page. Post an item once — it flows to every trade on the platform, not just yours. Every canteen becomes a shop window for every seller."
          />
          <Row
            icon={Store}
            title="Trade-safe by design"
            body="Every offer routes through WhatsApp first — the seller confirms before payment. Only buyer-protected rails are allowed: PayPal G&S, escrow, or cash-on-collection. The Network never touches the money."
          />
          <Row
            icon={Users}
            title="Private view · public flow"
            body="Tap a card and the item opens privately for you — full details, offer input, seller info. Other trades don't see your interest. Send an offer or pass, no obligation, no awkward public bidding."
          />
          <Row
            icon={Clock}
            title="5-day floor, 7-day sold tail, 90-day cap"
            body="Sellers can't yank a listing before day 5. When sold, the card stays visible for 7 more days as social proof. Nothing lingers past 90 days — the flow stays fresh."
          />
          <Row
            icon={ShieldCheck}
            title="Accountability, both ways"
            body="Buyers who win an offer and don't pay get a hammer-strike. Sellers who don't deliver after agreeing get one too. Three strikes = 3-month ban from the mechanic. Both sides can appeal — the platform never chases you."
            last
          />

          {/* CTA back to feed */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3" style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: `${BRAND_YELLOW}0F` }}>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black uppercase tracking-wider text-neutral-700">
                Now you know how it flows
              </div>
              <div className="text-[10px] text-neutral-500">
                Tap any Counter card to open it privately — nothing broadcasts to the group.
              </div>
            </div>
            <button
              onClick={onBack}
              className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-md"
              style={{ backgroundColor: BRAND_YELLOW }}
            >
              Back to canteen
              <ArrowUpRight size={12} strokeWidth={2.5}/>
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}

function Row({
  icon: Icon,
  title,
  body,
  last
}: {
  icon: typeof Zap;
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 py-3 ${last ? "" : "border-b"}`}
      style={{ borderColor: last ? undefined : "rgba(139,69,19,0.10)" }}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${BRAND_YELLOW}22` }}
      >
        <Icon size={15} color={BRAND_GREEN_DARK} strokeWidth={2.5}/>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-black text-neutral-900">{title}</div>
        <p className="mt-0.5 text-[12px] leading-snug text-neutral-600">{body}</p>
      </div>
    </div>
  );
}
