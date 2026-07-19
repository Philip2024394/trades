"use client";

// AddCostButton — contextual "Log agreed price" CTA on PostFeedCard.
//
// Design choice (option C · Philip 2026-07-19): the button appears
// ONLY when a trade has replied to the post — that's the natural
// moment the homeowner has a number to log. Otherwise the card
// stays clean.
//
// Opens an inline compact form:
//   Trade (dropdown, pre-populated from post members)
//   Amount (£, pence-precise)
//   Kind (labour · materials · deposit · final · extra · supplier · other)
//   Description (optional)
//   [Cancel] [Log cost]
//
// POSTs to /api/homeowner/costs then router.refresh() so the right-
// rail Project Cost card updates immediately.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, X, Check } from "lucide-react";
import type { SiteBookPostMember } from "@/lib/homeowners/types";
import type { CostKind } from "@/lib/homeowners/costs";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

type Props = {
  postId:     string;
  projectId:  string;
  members:    SiteBookPostMember[];
};

const KIND_OPTIONS: Array<{ id: CostKind; label: string }> = [
  { id: "labour",    label: "Labour" },
  { id: "materials", label: "Materials" },
  { id: "deposit",   label: "Deposit" },
  { id: "final",     label: "Final payment" },
  { id: "extra",     label: "Extra / variation" },
  { id: "supplier",  label: "Supplier" },
  { id: "other",     label: "Other" }
];

export function AddCostButton({ postId, projectId, members }: Props) {
  const router                      = useRouter();
  const [open,       setOpen]       = useState(false);
  const [tradeId,    setTradeId]    = useState<string>(members[0]?.listing_id ?? "");
  const [amount,     setAmount]     = useState<string>("");   // string so user can clear
  const [kind,       setKind]       = useState<CostKind>("labour");
  const [description, setDescription] = useState<string>("");
  const [busy,       setBusy]       = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const amountPence = Math.round(parseFloat(amount || "0") * 100);
  const canSave     = amountPence > 0 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true); setError(null);
    const trade = members.find((m) => m.listing_id === tradeId);
    try {
      const res = await fetch("/api/homeowner/costs", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          projectId,
          postId,
          agreedPence:    amountPence,
          tradeListingId: trade?.listing_id ?? null,
          tradeName:      trade?.merchant_name ?? null,
          kind,
          description:    description.trim() || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setError(prettyError(data.error));
        setBusy(false);
        return;
      }
      setOpen(false);
      setAmount("");
      setDescription("");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition hover:brightness-95"
        style={{ backgroundColor: BRAND_YELLOW }}
      >
        <Wallet size={11} strokeWidth={2.5}/>
        Log agreed price
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="w-full rounded-xl border-2 bg-white p-3 shadow-sm" style={{ borderColor: BRAND_YELLOW }}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10.5px] font-black uppercase tracking-[0.22em]" style={{ color: BRAND_GREEN }}>
          Log agreed price
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
          aria-label="Cancel"
        >
          <X size={12} strokeWidth={2.5}/>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {members.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">Trade</span>
            <select
              value={tradeId}
              onChange={(e) => setTradeId(e.target.value)}
              className="h-9 rounded-lg border border-neutral-300 bg-white px-2 text-[12px]"
            >
              {members.map((m) => (
                <option key={m.listing_id} value={m.listing_id}>{m.merchant_name || m.merchant_slug || "Trade"}</option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">Amount (£)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="480.00"
            className="h-9 rounded-lg border border-neutral-300 bg-white px-2 text-[12.5px] tabular-nums"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">Kind</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CostKind)}
            className="h-9 rounded-lg border border-neutral-300 bg-white px-2 text-[12px]"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.id} value={k.id}>{k.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">Note (optional)</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 120))}
            placeholder="e.g. deposit for demolition work"
            className="h-9 rounded-lg border border-neutral-300 bg-white px-2 text-[12px]"
          />
        </label>
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-[11px] font-bold text-red-800">{error}</p>
      )}

      <button
        type="submit"
        disabled={!canSave}
        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[11px] font-black uppercase tracking-wider text-white shadow-sm transition hover:brightness-95 disabled:opacity-50"
        style={{ backgroundColor: BRAND_GREEN }}
      >
        <Check size={12} strokeWidth={2.5}/>
        {busy ? "Saving…" : "Log cost"}
      </button>
      <p className="mt-1 text-center text-[10px] text-neutral-500">
        Private to you. Trades never see other trades&rsquo; amounts.
      </p>
    </form>
  );
}

function prettyError(code: string): string {
  switch (code) {
    case "missing-amount":   return "Enter an amount first.";
    case "missing-project":  return "No project selected.";
    case "negative-amount":  return "Amount must be positive.";
    case "amount-too-large": return "Over £100,000 — split into multiple entries.";
    case "project-not-found":return "That project isn't yours.";
    default:                 return "Couldn't save that. Try again.";
  }
}
