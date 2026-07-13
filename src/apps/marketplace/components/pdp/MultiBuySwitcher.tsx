// Multi-Buy Switcher — the Hammerex signature 1/2/3/4 with % off buttons.
// Sits under the gallery on desktop / above the buy column on mobile.
// Emits a callback so the parent buy column can re-price live.

"use client";

import type { MultiBuyTier } from "../../data/productDetails";

type Props = {
  tiers: MultiBuyTier[];
  unitPriceGbp: number;
  activeQty: number | null;      // null = single unit
  onChange: (qty: number | null) => void;
};

function discountPctFor(tier: MultiBuyTier, unitPrice: number): number {
  if (unitPrice <= 0) return 0;
  const list = unitPrice * tier.qty;
  const saving = list - tier.totalPriceGbp;
  return Math.round((saving / list) * 100);
}

export function MultiBuySwitcher({ tiers, unitPriceGbp, activeQty, onChange }: Props) {
  if (tiers.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[10px] font-black uppercase tracking-[0.16em]"
        style={{ color: "#0A0A0A" }}
      >
        Multi Purchase
      </span>
      <div className="flex flex-wrap items-start gap-2">
        {/* Synthetic "1" button — single unit / no bundle */}
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Buy 1 (no bundle)"
            aria-pressed={activeQty === null}
            className="grid h-16 w-16 place-items-center rounded-xl border-2 text-[22px] font-black transition active:scale-95"
            style={{
              borderColor: activeQty === null ? "#FFB300" : "rgba(139,69,19,0.20)",
              backgroundColor: activeQty === null ? "#FFB300" : "#FFFFFF",
              color: "#0A0A0A",
              boxShadow: activeQty === null ? "0 2px 10px rgba(255,179,0,0.45)" : "none"
            }}
            title="Buy 1"
          >
            1
          </button>
          <span className="text-[10px] font-black uppercase tracking-wider opacity-0">−</span>
        </div>

        {tiers.map((t) => {
          const isActive = activeQty === t.qty;
          const pct = discountPctFor(t, unitPriceGbp);
          return (
            <div key={t.qty} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => onChange(isActive ? null : t.qty)}
                aria-label={`Buy ${t.qty} — ${t.label ?? "multi-buy"}`}
                aria-pressed={isActive}
                className="grid h-16 w-16 place-items-center rounded-xl border-2 text-[22px] font-black transition active:scale-95"
                style={{
                  borderColor: isActive ? "#FFB300" : "rgba(139,69,19,0.20)",
                  backgroundColor: isActive ? "#FFB300" : "#FFFFFF",
                  color: "#0A0A0A",
                  boxShadow: isActive ? "0 2px 10px rgba(255,179,0,0.45)" : "none"
                }}
                title={t.label ?? `Buy ${t.qty}`}
              >
                {t.qty}
              </button>
              {pct > 0 && (
                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#166534" }}>
                  −{pct}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
