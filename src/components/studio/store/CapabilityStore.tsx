"use client";

// Capability Store — grid of the 8 commercial bundles.
// Sells outcomes ("brand your whole fleet") not images ("van wrap").
// Featured bundles float to the top with a yellow ribbon.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ArrowRight, Package } from "lucide-react";
import type { Bundle, BundleId } from "@/lib/design/pricing/bundles";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";
const BG_CREAM     = "#FBF6EC";

const CATEGORIES = [
  "all", "identity", "vehicle", "print", "workwear",
  "signage", "digital", "marketing", "complete"
] as const;
type Category = typeof CATEGORIES[number];

export function CapabilityStore({ bundles, merchantName }: { bundles: Bundle[]; merchantName: string }) {
  const [filter, setFilter] = useState<Category>("all");

  const shown = useMemo(() => {
    const list = filter === "all" ? [...bundles] : bundles.filter((b) => b.category === filter);
    return list.sort((a, b) => (a.featured === b.featured ? 0 : a.featured ? -1 : 1));
  }, [bundles, filter]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: BG_CREAM }}>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
              {merchantName} · Capability Store
            </p>
            <h1 className="mt-1 text-3xl font-black">Kit your business out</h1>
            <p className="mt-1 max-w-xl text-[13px] text-neutral-600">
              Buy a whole pack, not one image at a time. Every design uses your brand, so nothing looks patched together.
            </p>
          </div>
          <Link href="/studio/vault" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-[12px] font-black text-neutral-700 hover:border-neutral-900">
            Back to Vault
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={"rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider transition " +
                (filter === c ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-900")}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((b) => <BundleCard key={b.id} bundle={b}/>)}
        </div>

      </div>
    </div>
  );
}

function BundleCard({ bundle }: { bundle: Bundle }) {
  const price = "£" + (bundle.price_pence / 100).toFixed(2);
  return (
    <div className={"relative flex flex-col rounded-2xl border bg-white p-5 " +
      (bundle.featured ? "border-neutral-900 shadow-md" : "border-neutral-200")}>
      {bundle.featured && (
        <span
          className="absolute -top-2 left-4 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
          style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
        >
          Best seller
        </span>
      )}
      <div className="mb-2 flex items-center gap-2">
        <Package size={14} className="text-neutral-700"/>
        <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">{bundle.category}</p>
      </div>
      <h2 className="text-lg font-black leading-tight">{bundle.name}</h2>
      <p className="mt-1 text-[13px] text-neutral-600">{bundle.headline}</p>
      <p className="mt-2 text-[11px] italic text-neutral-500">"{bundle.outcome_message}"</p>

      <ul className="mt-4 flex-1 space-y-1.5">
        {bundle.contents.slice(0, 6).map((c) => (
          <li key={c} className="flex items-start gap-2 text-[12px] text-neutral-700">
            <Check size={12} className="mt-0.5 flex-shrink-0 text-green-600"/>
            <span>{c}</span>
          </li>
        ))}
        {bundle.contents.length > 6 && (
          <li className="text-[11px] text-neutral-500">+ {bundle.contents.length - 6} more</li>
        )}
      </ul>

      <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-4">
        <div>
          <p className="text-2xl font-black">{price}</p>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">one-time</p>
        </div>
        <BuyButton bundleId={bundle.id}/>
      </div>
    </div>
  );
}

function BuyButton({ bundleId }: { bundleId: BundleId }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function begin() {
    setBusy(true); setNote(null);
    try {
      const res = await fetch("/api/studio/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle_id: bundleId })
      });
      const json = await res.json();
      if (json.ok && json.checkout_url) {
        window.location.href = json.checkout_url as string;
        return;
      }
      setNote(json.error === "stripe_not_configured" ? "Checkout coming online soon." : (json.error ?? "unable_to_start"));
    } catch { setNote("network_error"); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={begin}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-black disabled:opacity-40"
        style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
      >
        {busy ? "…" : <>Get it <ArrowRight size={12}/></>}
      </button>
      {note && <p className="mt-1 text-[10px] text-amber-700">{note}</p>}
    </div>
  );
}
