"use client";

// Merchant-facing bidding interface for the weekly Trade Center
// featured slot auction. Transparent price (everyone sees the top
// bid); private identity (nobody sees WHO placed it).

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, Zap, Loader2, TrendingUp, Info } from "lucide-react";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";

type Props = {
  slug:         string;
  weekStarting: string;
  myBid:        { id: string; pence: number; paid: boolean; status: string } | null;
  topBidsPence: number[];
};

export function FeaturedSlotsShell({ slug, weekStarting, myBid, topBidsPence }: Props) {
  const [amount, setAmount] = useState<string>(myBid ? (myBid.pence / 100).toFixed(2) : "9.99");
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  const topBidGbp = topBidsPence.length > 0 ? (topBidsPence[0] / 100).toFixed(2) : "0.00";

  async function submitBid() {
    setBusy(true);
    setErr(null);
    try {
      const res  = await fetch("/api/merchant/featured-slots/bid", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ amount_gbp: Number(amount) })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "bid_failed");
      if (json.checkout_url) window.location.href = json.checkout_url as string;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "bid_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-4 sm:p-6">
      <Link href={`/trade-off/edit/${slug}/home`} className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
        <ArrowLeft size={12}/> Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-black" style={{ color: BRAND_BLACK }}>
          <Trophy size={22} className="mr-2 inline"/>Featured slot auction
        </h1>
        <p className="text-[12.5px] text-neutral-600">
          Bid for the week starting <span className="font-black text-neutral-900">{new Date(weekStarting).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span>. Auction closes Sunday 23:55 UTC.
        </p>
      </div>

      {/* Current top bid */}
      <section className="rounded-2xl border-2 p-4" style={{ borderColor: BRAND_YELLOW, backgroundColor: "#FFFBEB" }}>
        <p className="text-[10.5px] font-black uppercase tracking-[0.16em] text-neutral-500">
          <TrendingUp size={11} className="mr-1 inline"/> Current top bid
        </p>
        <p className="text-3xl font-black text-neutral-900">£{topBidGbp}</p>
        <p className="text-[10.5px] text-neutral-600">
          {topBidsPence.length} paid bid{topBidsPence.length === 1 ? "" : "s"} so far this week.
        </p>
      </section>

      {/* Your bid state */}
      {myBid && (
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">Your bid</p>
          <p className="text-2xl font-black text-neutral-900">£{(myBid.pence / 100).toFixed(2)}</p>
          <p className="text-[11px] text-neutral-600">
            Status: <span className="font-black">{myBid.paid ? myBid.status.toUpperCase() : "Awaiting payment"}</span>
          </p>
        </section>
      )}

      {/* Bid form */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <label className="mb-1.5 block text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
          Place bid · £9.99 minimum
        </label>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black">£</span>
          <input
            type="number"
            min={9.99}
            max={999}
            step={0.50}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32 rounded-lg border px-3 py-2 text-lg font-black"
          />
          <button
            onClick={submitBid}
            disabled={busy}
            className="ml-2 inline-flex h-12 items-center gap-2 rounded-full px-5 text-[13px] font-black uppercase tracking-wider text-white hover:brightness-95 disabled:opacity-50"
            style={{ backgroundColor: BRAND_BLACK }}
          >
            {busy ? <Loader2 size={14} className="animate-spin"/> : <Zap size={14}/>}
            Pay bid
          </button>
        </div>
        {err && <p className="mt-2 text-[11px] text-red-700">{err}</p>}
        <p className="mt-3 text-[11px] text-neutral-500">
          <Info size={11} className="mr-1 inline"/>
          You&rsquo;re charged the amount above. If a merchant outbids you before Sunday you get 100% refund.
          Winner keeps the slot Mon-Sun and gets a badge on their canteen for the week.
        </p>
      </section>

      {/* What you win */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <p className="mb-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">What you win</p>
        <ul className="flex flex-col gap-1.5 text-[12.5px] text-neutral-700">
          <li>· Featured strip placement at the top of every Trade Center browse page for 7 days</li>
          <li>· "Featured this week" badge on your canteen hero</li>
          <li>· Algorithmic boost on Yard sort for the week</li>
          <li>· Weekly performance report emailed Sunday night</li>
        </ul>
      </section>
    </div>
  );
}
