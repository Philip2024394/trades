"use client";

// BulkTierTable — public-facing per-product bulk-pricing table.
//
// Rows: qty band + price each. The tier matching the current qty is
// highlighted in yellow. Used inside ProductModal (Wholesale Mode on)
// and Phase 3 may reuse it on a standalone product page.

import { formatGbp } from "@/lib/xratedCart";

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
  currentQty
}: {
  tiers: Tier[];
  currentQty: number;
}) {
  if (!Array.isArray(tiers) || tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  const active = tierForQty(sorted, currentQty);
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
              className={`flex items-baseline justify-between gap-2 rounded-lg border-2 px-3 py-2 text-[13px] font-extrabold transition ${
                isActive
                  ? "border-[#FFB300] bg-[#FFB300]/15 text-neutral-900"
                  : "border-neutral-200 bg-white text-neutral-700"
              }`}
            >
              <span>{tierLabel(t)} units</span>
              <span>{formatGbp(t.price_pence)} each</span>
            </li>
          );
        })}
      </ul>
      <p className="text-[13px] font-bold text-neutral-500">
        Add the qty to apply the matching tier price.
      </p>
    </div>
  );
}
