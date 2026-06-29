"use client";

/**
 * @fileoverview MERCHANT-ONLY component.
 * @merchantOnly Only renders when isStorefrontOn(listing) === true.
 * Importing this from a service-trade context is a code smell — use
 * the service/ siblings instead.
 */


// BulkTierTable — public-facing per-product bulk-pricing table.
//
// Rows: qty band + price each. The tier matching the current qty is
// highlighted in yellow with a green "Applied" tick. The active row
// auto-updates as the QtyStepper above changes the cart quantity —
// both subscribe to the same QTY_CHANGE_EVENT + read the same
// localStorage key keyed by productId.

import { useEffect, useState } from "react";
import { formatGbp } from "@/lib/xratedCart";
import { QTY_CHANGE_EVENT, QTY_STORAGE_KEY } from "./QtyStepper";

type Tier = {
  min_qty: number;
  max_qty?: number | null;
  price_pence: number;
};

function tierLabel(t: Tier): string {
  if (t.max_qty === null || t.max_qty === undefined) {
    return `${t.min_qty}+`;
  }
  if (t.max_qty === t.min_qty) return String(t.min_qty);
  return `${t.min_qty}–${t.max_qty}`;
}

export function tierForQty(tiers: Tier[], qty: number): Tier | null {
  if (!Array.isArray(tiers) || tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  let match: Tier | null = null;
  for (const t of sorted) {
    const max = t.max_qty ?? Number.POSITIVE_INFINITY;
    if (qty >= t.min_qty && qty <= max) {
      match = t;
    }
  }
  // If qty is below the first band, no tier applies — caller should
  // fall back to base price.
  return match;
}

export function BulkTierTable({
  tiers,
  currentQty,
  productId
}: {
  tiers: Tier[];
  /** Optional starting qty. Ignored when productId is provided —
   *  in that case the table subscribes to the live QtyStepper event. */
  currentQty?: number;
  /** When provided, the table self-syncs with the QtyStepper above by
   *  reading localStorage on mount + listening to QTY_CHANGE_EVENT. */
  productId?: string;
}) {
  const [liveQty, setLiveQty] = useState<number>(
    typeof currentQty === "number" && Number.isFinite(currentQty) ? currentQty : 1
  );
  useEffect(() => {
    if (!productId) return;
    const key = `${QTY_STORAGE_KEY}:${productId}`;
    try {
      const raw = window.localStorage.getItem(key);
      const n = raw !== null ? Number(raw) : NaN;
      if (Number.isFinite(n) && n >= 1) setLiveQty(Math.floor(n));
    } catch {
      /* ignore */
    }
    function onChange(e: Event) {
      const detail = (e as CustomEvent<{ productId: string; qty: number }>).detail;
      if (!detail || detail.productId !== productId) return;
      if (Number.isFinite(detail.qty) && detail.qty >= 1) setLiveQty(Math.floor(detail.qty));
    }
    window.addEventListener(QTY_CHANGE_EVENT, onChange as EventListener);
    return () => window.removeEventListener(QTY_CHANGE_EVENT, onChange as EventListener);
  }, [productId]);
  if (!Array.isArray(tiers) || tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  const active = tierForQty(sorted, liveQty);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <p
        className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
        style={{ color: "#FFB300" }}
      >
        Bulk pricing
      </p>
      <ul className="flex flex-col gap-1.5">
        {sorted.map((t, i) => {
          const isActive = active !== null && t.min_qty === active.min_qty;
          return (
            <li
              key={`${t.min_qty}-${i}`}
              className={`flex items-center justify-between gap-2 rounded-lg border-2 px-3 py-2 text-[13px] font-extrabold transition ${
                isActive
                  ? "border-[#FFB300] bg-[#FFB300]/25 text-neutral-900 shadow-sm"
                  : "border-neutral-200 bg-white text-neutral-700"
              }`}
            >
              <span>{tierLabel(t)} units</span>
              <span className="flex items-center gap-2">
                <span>{formatGbp(t.price_pence)} each</span>
                {/* Applied confirmation — solid green tick + label only
                    on the row whose qty band currently matches. Reads
                    as "this tier is locked in". */}
                {isActive && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white"
                    title="Tier applied to your current quantity"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    Applied
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-[13px] font-bold text-neutral-500">
        {active
          ? "Bulk price applied at this quantity. Add more to unlock the next tier."
          : "Add the qty to apply the matching tier price."}
      </p>
    </div>
  );
}
