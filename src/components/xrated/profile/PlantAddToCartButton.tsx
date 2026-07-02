"use client";

// Add-to-cart button — client component embedded on machine detail
// pages. Duration + quantity picker, then adds to localStorage cart.

import Link from "next/link";
import { useState } from "react";
import { addToCart, type PlantCartItem } from "@/lib/plantCart";

export function PlantAddToCartButton({
  merchantSlug,
  slug,
  label,
  dayPricePence,
  weekPricePence,
  monthPricePence,
  wetDayPricePence
}: {
  merchantSlug: string;
  slug: string;
  label: string;
  dayPricePence: number | null;
  weekPricePence: number | null;
  monthPricePence: number | null;
  wetDayPricePence?: number | null;
}) {
  const [duration, setDuration] = useState<"day" | "week" | "month">("day");
  const [qty, setQty] = useState(1);
  const [wet, setWet] = useState(false);
  const [added, setAdded] = useState(false);

  const unit =
    wet && wetDayPricePence
      ? wetDayPricePence
      : duration === "day"
        ? dayPricePence
        : duration === "week"
          ? weekPricePence
          : monthPricePence;

  const totalPence = (unit ?? 0) * qty;
  const disabled = !unit || unit <= 0;

  const handle = () => {
    if (disabled) return;
    const item: PlantCartItem = {
      slug,
      label,
      duration,
      quantity: qty,
      wet_hire: wet,
      unit_price_pence: unit ?? 0
    };
    addToCart(merchantSlug, item);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        Add to hire list
      </p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {(["day", "week", "month"] as const).map((d) => {
          const p =
            d === "day" ? dayPricePence : d === "week" ? weekPricePence : monthPricePence;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className={`h-11 rounded-lg border text-[11px] font-extrabold uppercase tracking-widest transition ${
                duration === d
                  ? "border-[#FFB300] bg-[#FFB300] text-neutral-900"
                  : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400"
              }`}
            >
              <span className="block leading-none">1 {d}</span>
              {p && p > 0 && (
                <span className="mt-0.5 block text-[9px] font-bold text-neutral-500">
                  £{(p / 100).toFixed(0)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
            Quantity
          </span>
          <input
            type="number"
            min={1}
            max={20}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 text-[13px] font-bold outline-none focus:border-[#FFB300] focus:bg-white"
          />
        </label>
        {wetDayPricePence && (
          <label className="flex items-end gap-2 pb-1">
            <input
              type="checkbox"
              checked={wet}
              onChange={(e) => setWet(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 accent-[#FFB300]"
            />
            <span className="text-[11px] font-bold text-neutral-900">Wet-hire</span>
          </label>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Subtotal
        </span>
        <span className="text-[16px] font-extrabold text-neutral-900">
          £{(totalPence / 100).toFixed(2)}
        </span>
      </div>

      <button
        type="button"
        onClick={handle}
        disabled={disabled}
        className={`mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl text-[12px] font-extrabold uppercase tracking-widest transition ${
          disabled
            ? "cursor-not-allowed bg-neutral-200 text-neutral-500"
            : added
              ? "bg-emerald-600 text-white"
              : "bg-neutral-900 text-white hover:bg-black"
        }`}
      >
        {added ? "✓ Added to list" : "+ Add to hire list"}
      </button>

      <Link
        href={`/${merchantSlug}/plant-hire/cart`}
        className="mt-2 block text-center text-[10px] font-extrabold uppercase tracking-widest text-neutral-500 hover:text-neutral-900"
      >
        View hire list →
      </Link>
    </div>
  );
}
