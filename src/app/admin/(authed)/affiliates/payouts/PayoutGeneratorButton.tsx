"use client";

import { useState } from "react";

export function PayoutGeneratorButton({
  affiliateId,
  commissionIds,
  totalPence,
  periodMonth
}: {
  affiliateId: number;
  commissionIds: string[];
  totalPence: number;
  periodMonth: string;
}) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/affiliates/payouts/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          affiliate_id: affiliateId,
          commission_ids: commissionIds,
          total_pence: totalPence,
          period_month: periodMonth
        })
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (data.ok) window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="rounded bg-brand-accent px-2 py-1 text-[11px] font-bold text-black disabled:opacity-60"
    >
      {busy ? "…" : "Generate payout"}
    </button>
  );
}
