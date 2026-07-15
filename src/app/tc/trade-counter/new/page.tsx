// /tc/trade-counter/new — Post a Trade Counter item.
//
// For a trade (not a merchant). One item at a time — surplus, used
// tool, swap, or free. Different from merchant catalogue upload.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  ShieldCheck,
  Info,
  Handshake,
  Image as ImageIcon
} from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { currentViewerTrade } from "@/apps/identity/data/tradeIdentities";
import type {
  TradeCounterCondition,
  TradeCounterListingKind
} from "@/apps/tradeCounter/data/listings";

const KIND_OPTIONS: Array<{ value: TradeCounterListingKind; label: string; hint: string }> = [
  { value: "for-sale", label: "For Sale", hint: "Set your asking price. Payment settled peer-to-peer." },
  { value: "offer",    label: "Swap / Offer", hint: "Trade your item for something you actually need." },
  { value: "free",     label: "Free",     hint: "Giveaway or clearance. First to reply wins it." }
];

const CONDITION_OPTIONS: Array<{ value: TradeCounterCondition; label: string }> = [
  { value: "new-unused", label: "New / unused" },
  { value: "as-new",     label: "As new" },
  { value: "used-good",  label: "Used — good condition" },
  { value: "used-fair",  label: "Used — fair" }
];

export default function PostTradeCounterItemPage() {
  const router = useRouter();
  const trade = currentViewerTrade();

  const [kind, setKind] = useState<TradeCounterListingKind>("for-sale");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [askingGbp, setAskingGbp] = useState("");
  const [swapForLabel, setSwapForLabel] = useState("");
  const [condition, setCondition] = useState<TradeCounterCondition>("used-good");
  const [quantityAvailable, setQuantityAvailable] = useState("1");
  const [collectionOnly, setCollectionOnly] = useState(true);
  const [deliveryPossible, setDeliveryPossible] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitted(true);
    setTimeout(() => router.push("/tc/trade-counter"), 1200);
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
        <TradeCenterHeader activeCategorySlug={null}/>
        <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-8">
          <div
            className="w-full rounded-2xl border bg-white p-6 text-center shadow-sm"
            style={{ borderColor: "rgba(22,101,52,0.35)" }}
          >
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: "#166534" }}
            >
              <ShieldCheck size={26} strokeWidth={2.5} className="text-white"/>
            </div>
            <h1 className="mt-4 text-[18px] font-black text-neutral-900">Listed on the Trade Counter</h1>
            <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-neutral-600">
              Other verified trades near you can see it now. Replies land in Messages.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 md:px-6 md:py-8">
        <Link
          href="/tc/trade-counter"
          className="inline-flex min-h-[44px] items-center gap-2 text-[11.5px] font-bold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft size={13}/>
          Trade Counter
        </Link>

        <header>
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Post to Trade Counter
          </div>
          <h1 className="mt-1 flex items-center gap-2 text-[22px] font-black leading-tight text-neutral-900 md:text-[26px]">
            <Handshake size={22}/>
            One item · for sale, swap or free
          </h1>
          <p className="mt-1 text-[12px] leading-snug text-neutral-600 md:text-[13px]">
            You&apos;re posting as <strong>{trade.displayName}</strong> · {trade.tradeType}. Every verified
            trade near you can see your listing. Different from a merchant catalogue upload.
          </p>
        </header>

        <form
          onSubmit={submit}
          className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          {/* Kind selector */}
          <fieldset>
            <legend className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              What kind of listing
            </legend>
            <div className="grid gap-2 md:grid-cols-3">
              {KIND_OPTIONS.map((o) => {
                const active = o.value === kind;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setKind(o.value)}
                    aria-pressed={active}
                    className="flex min-h-[72px] flex-col items-start gap-1 rounded-lg border p-3 text-left transition"
                    style={{
                      borderColor: active ? "#0A0A0A" : "rgba(139,69,19,0.15)",
                      backgroundColor: active ? "#FEF3C7" : "#FFFFFF"
                    }}
                  >
                    <div className="text-[13px] font-black text-neutral-900">{o.label}</div>
                    <div className="text-[10.5px] leading-snug text-neutral-500">{o.hint}</div>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Title */}
          <Field label="Title" required>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 18 sheets plasterboard 12.5mm surplus"
              className="min-h-[44px] w-full rounded-lg border bg-white px-3 text-[13px]"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
              required
            />
          </Field>

          {/* Description */}
          <Field label="Description" required hint="Condition, quantity, why you're selling, collection details.">
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg border bg-white p-3 text-[13px]"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
              required
            />
          </Field>

          {/* Price or swap-for */}
          {kind === "for-sale" && (
            <Field label="Asking price (£)" required>
              <input
                type="number"
                min={0}
                step={1}
                value={askingGbp}
                onChange={(e) => setAskingGbp(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border bg-white px-3 text-[13px] font-black"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
                required
              />
            </Field>
          )}

          {kind === "offer" && (
            <Field label="What you want in swap" required hint="e.g. '25m 240V heavy-duty cable reel'">
              <input
                type="text"
                value={swapForLabel}
                onChange={(e) => setSwapForLabel(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border bg-white px-3 text-[13px]"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
                required
              />
            </Field>
          )}

          {/* Quantity + condition */}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Quantity available">
              <input
                type="number"
                min={1}
                step={1}
                value={quantityAvailable}
                onChange={(e) => setQuantityAvailable(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border bg-white px-3 text-[13px]"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              />
            </Field>
            <Field label="Condition">
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as TradeCounterCondition)}
                className="min-h-[44px] w-full rounded-lg border bg-white px-3 text-[13px]"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                {CONDITION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Collection / delivery toggles */}
          <fieldset>
            <legend className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              How you'll hand it over
            </legend>
            <div className="flex flex-col gap-2">
              <label
                className="flex min-h-[44px] cursor-pointer items-start gap-2 rounded-lg border bg-neutral-50 p-3"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                <input
                  type="checkbox"
                  checked={collectionOnly}
                  onChange={(e) => setCollectionOnly(e.target.checked)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0"
                />
                <span className="text-[11.5px] leading-snug text-neutral-800">Collection from my address</span>
              </label>
              <label
                className="flex min-h-[44px] cursor-pointer items-start gap-2 rounded-lg border bg-neutral-50 p-3"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                <input
                  type="checkbox"
                  checked={deliveryPossible}
                  onChange={(e) => setDeliveryPossible(e.target.checked)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0"
                />
                <span className="text-[11.5px] leading-snug text-neutral-800">
                  Delivery possible (in my van)
                </span>
              </label>
            </div>
          </fieldset>

          {/* Photo hint */}
          <div
            className="flex min-h-[80px] items-center justify-center rounded-lg border-2 border-dashed p-4 text-center"
            style={{ borderColor: "rgba(139,69,19,0.25)" }}
          >
            <div className="flex items-center gap-2">
              <ImageIcon size={16} className="text-neutral-500"/>
              <div className="text-[11px] font-bold text-neutral-600">
                Drop photos or tap to browse (optional but recommended)
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md bg-neutral-50 p-3">
            <Info size={13} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
            <p className="text-[10.5px] leading-snug text-neutral-500">
              Trade Center hosts your listing. Zero commission on sale. You transact peer-to-peer
              via Messages. Optional Trade Center Guaranteed available for higher-value items to hold
              funds until handover confirmed.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex min-h-[52px] items-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider shadow-sm"
              style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
            >
              <Send size={14}/>
              Post to Trade Counter
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  children,
  required,
  hint
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
      {children}
      {hint && <span className="text-[10px] leading-snug text-neutral-500">{hint}</span>}
    </label>
  );
}
