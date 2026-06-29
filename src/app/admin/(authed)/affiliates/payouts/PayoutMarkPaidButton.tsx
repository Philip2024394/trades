"use client";

import { useState } from "react";

export function PayoutMarkPaidButton({ payoutId }: { payoutId: string }) {
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState("");

  async function onClick() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/affiliates/payouts/${payoutId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "paid", reference: ref || null })
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (data.ok) window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-1">
      <input
        type="text"
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        placeholder="Reference"
        className="h-7 w-28 rounded border border-brand-line bg-brand-bg px-2 text-[11px] text-brand-text"
      />
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className="rounded bg-brand-accent px-2 py-1 text-[11px] font-bold text-black disabled:opacity-60"
      >
        {busy ? "…" : "Mark paid"}
      </button>
    </div>
  );
}
