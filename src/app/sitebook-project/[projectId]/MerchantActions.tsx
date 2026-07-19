"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BRAND_GREEN = "#166534";

export function MerchantAcceptButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onClick() {
    setBusy(true);
    await fetch(`/api/merchant/sitebook/${projectId}/accept`, { method: "POST" });
    router.refresh();
  }
  return (
    <button onClick={onClick} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-sm disabled:opacity-60" style={{ backgroundColor: BRAND_GREEN }}>
      {busy ? "Accepting…" : "Accept invite →"}
    </button>
  );
}

export function MerchantDeclineButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onClick() {
    if (!confirm("Decline this SiteBook invite? You'll drop off the homeowner's list.")) return;
    setBusy(true);
    await fetch(`/api/merchant/sitebook/${projectId}/decline`, { method: "POST" });
    router.refresh();
  }
  return (
    <button onClick={onClick} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 text-[11px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50 disabled:opacity-60">
      {busy ? "Declining…" : "Decline"}
    </button>
  );
}

export function MerchantQuoteForm({ projectId, currentAmount, currentNotes }: {
  projectId:     string;
  currentAmount: number | null;
  currentNotes:  string | null;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(currentAmount?.toString() || "");
  const [notes, setNotes]   = useState(currentNotes || "");
  const [busy, setBusy]     = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) return;
    setBusy(true);
    await fetch(`/api/merchant/sitebook/${projectId}/quote`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ amount_gbp: parseFloat(amount), notes: notes || null })
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3">
      <label className="block">
        <span className="mb-1 block text-[10.5px] font-black uppercase tracking-wider text-neutral-600">Quote amount (£)</span>
        <input
          type="number"
          min={0}
          step={0.01}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"
          placeholder="e.g. 3800"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10.5px] font-black uppercase tracking-wider text-neutral-600">Notes (optional)</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"
          placeholder="e.g. Includes materials + 5-year workmanship warranty. Available from mid-Feb."
        />
      </label>
      <button type="submit" disabled={busy || !amount} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-sm disabled:opacity-60" style={{ backgroundColor: BRAND_GREEN }}>
        {busy ? "Sending…" : currentAmount === null ? "Submit quote →" : "Update quote →"}
      </button>
    </form>
  );
}
