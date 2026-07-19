// RevealUsageCard — compact usage tile shown on the /sitebook page
// so the homeowner always knows how many WA reveals they have left
// this month + how many pay-as-you-go pack credits are in reserve.
//
// Fetches /api/homeowner/reveals/status on mount + after any
// composed message (via the `refreshTick` prop bumping to a new value).
// Server-rendered initial state via the `initial` prop keeps it snappy.

"use client";

import { useEffect, useState } from "react";
import { Zap, Plus } from "lucide-react";

const BRAND_YELLOW = "#FFB300";

type Quota = {
  tier:               "free" | "premium";
  monthlyAllowance:   number;
  monthlyUsed:        number;
  monthlyRemaining:   number;
  purchasedRemaining: number;
  totalRemaining:     number;
  periodStart:        string;
};

export function RevealUsageCard({
  initial,
  refreshTick = 0
}: {
  initial?:    Quota | null;
  refreshTick?: number;
}) {
  const [quota, setQuota] = useState<Quota | null>(initial ?? null);
  const [busy,  setBusy]  = useState(false);

  useEffect(() => {
    if (refreshTick === 0 && initial) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const res = await fetch("/api/homeowner/reveals/status", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data.ok) setQuota(data.quota as Quota);
      } catch { /* silent */ }
      finally { if (!cancelled) setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [refreshTick, initial]);

  if (!quota) return null;

  const monthlyPct = quota.monthlyAllowance
    ? Math.min(100, Math.round((quota.monthlyUsed / quota.monthlyAllowance) * 100))
    : 0;
  const tierLabel   = quota.tier === "premium" ? "Pro" : "Free";
  const isLow       = quota.totalRemaining <= 1;

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap size={12} strokeWidth={2.5} style={{ color: BRAND_YELLOW }}/>
          <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
            WhatsApp reveals · {tierLabel}
          </p>
        </div>
        {busy && <span className="text-[9.5px] font-bold text-neutral-400">syncing…</span>}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[22px] font-black leading-none text-neutral-900">
          {quota.totalRemaining}
        </span>
        <span className="text-[11px] font-bold text-neutral-500">left</span>
      </div>

      {/* Monthly bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] font-bold text-neutral-500">
          <span>Monthly · {quota.monthlyUsed} / {quota.monthlyAllowance}</span>
          {quota.purchasedRemaining > 0 && (
            <span>+ {quota.purchasedRemaining} from packs</span>
          )}
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full transition-all"
            style={{
              width: `${monthlyPct}%`,
              backgroundColor: isLow ? "#DC2626" : BRAND_YELLOW
            }}
          />
        </div>
      </div>

      {isLow && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href="/sitebook/reveals/packs"
            className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            <Plus size={11} strokeWidth={2.5}/>
            Top up
          </a>
          {quota.tier === "free" && (
            <a
              href="/sitebook/pro"
              className="inline-flex h-8 items-center gap-1 rounded-full border-2 px-3 text-[10.5px] font-black uppercase tracking-wider"
              style={{ borderColor: "#166534", color: "#166534" }}
            >
              Go Pro · £4.99/mo
            </a>
          )}
        </div>
      )}
    </div>
  );
}
