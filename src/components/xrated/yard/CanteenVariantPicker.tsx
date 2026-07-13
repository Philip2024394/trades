"use client";

// CanteenVariantPicker — buyer-side variant selector. Mobile-first
// chip rows (size + colour). Selecting a combination resolves through
// the merchant's per-variant `overrides` map to determine the effective
// price, image, stock and SKU for that combo. Parent gets the resolved
// state via `onChange` so it can:
//   - Swap the visible image (image → merchant's variant photo if set)
//   - Update the displayed price (price → override price if set)
//   - Compose the WhatsApp message with the exact variant chosen
//   - Route "Buy on Trade Center" to the correct combo URL
//
// Design goals:
//   - Chip rows read naturally on a phone — no dropdowns, no modals
//   - Colour swatches use the merchant-set hex if provided
//   - Out-of-stock combinations show a strike + greyed treatment,
//     but stay tappable so buyers can still enquire
//   - Selected state = solid yellow chip with dark text (brand contrast)

import { useEffect, useMemo, useState } from "react";
import type { CanteenProductVariants, VariantOverride } from "@/lib/canteens";

const BRAND_YELLOW = "#FFB300";

export type VariantSelectionState = {
  /** Combo key resolved from the current selections. `null` when the
   *  buyer hasn't made a full selection yet (e.g. picked size but not
   *  colour on a size×colour product). */
  comboKey: string | null;
  /** Human-readable label of the current selection. "M · Ivory Mist"
   *  or "Ivory Mist" — null when nothing meaningful selected. */
  label: string | null;
  /** The price the buyer sees. Merchant's override price if set,
   *  otherwise the base product price. */
  priceGbp: number;
  /** The image the buyer sees. Merchant's variant image if set,
   *  otherwise the base product image. */
  imageUrl: string;
  /** True when the merchant has an override with stock=0 for this
   *  combo. Buyers still can enquire but the CTA copy changes. */
  isOutOfStock: boolean;
  /** SKU if the merchant set one — displayed as "Ref: {sku}" on PDPs. */
  sku: string | undefined;
};

function comboKeyFor(
  axis: CanteenProductVariants["axis"],
  size: string | null,
  color: string | null
): string | null {
  if (axis === "size") return size;
  if (axis === "color") return color;
  if (!size || !color) return null;
  return `${size}|${color}`;
}

function labelFor(
  axis: CanteenProductVariants["axis"],
  size: string | null,
  color: string | null
): string | null {
  if (axis === "size") return size;
  if (axis === "color") return color;
  if (!size && !color) return null;
  if (size && color) return `${size} · ${color}`;
  return size ?? color;
}

export function CanteenVariantPicker({
  variants,
  basePriceGbp,
  baseImageUrl,
  initialComboKey = null,
  onChange
}: {
  variants: CanteenProductVariants;
  basePriceGbp: number;
  baseImageUrl: string;
  /** Optional combo key to pre-select (from a URL param, referrer
   *  state, etc.). Parsed against the current axis shape; invalid
   *  values are ignored and defaults apply. */
  initialComboKey?: string | null;
  onChange: (state: VariantSelectionState) => void;
}) {
  const wantsSize = variants.axis === "size" || variants.axis === "size_color";
  const wantsColor = variants.axis === "color" || variants.axis === "size_color";
  const sizeOptions = variants.sizeOptions ?? [];
  const colorOptions = variants.colorOptions ?? [];
  const overrides = variants.overrides ?? {};

  // Parse initialComboKey against the axis shape → seeded selections.
  const seeded = useMemo(() => {
    if (!initialComboKey) return { size: null as string | null, color: null as string | null };
    if (variants.axis === "size") {
      return { size: sizeOptions.includes(initialComboKey) ? initialComboKey : null, color: null };
    }
    if (variants.axis === "color") {
      const name = colorOptions.find((c) => c.name === initialComboKey)?.name ?? null;
      return { size: null, color: name };
    }
    // size_color
    const [s, c] = initialComboKey.split("|");
    return {
      size: sizeOptions.includes(s ?? "") ? s : null,
      color: colorOptions.find((cc) => cc.name === c)?.name ?? null
    };
  }, [initialComboKey, variants.axis, sizeOptions, colorOptions]);

  // Default selection: seeded value if URL-provided, else first option
  // on each axis. Gives buyers a sensible starting price without
  // forcing a tap.
  const [selectedSize, setSelectedSize] = useState<string | null>(
    wantsSize ? (seeded.size ?? sizeOptions[0] ?? null) : null
  );
  const [selectedColor, setSelectedColor] = useState<string | null>(
    wantsColor ? (seeded.color ?? colorOptions[0]?.name ?? null) : null
  );

  const state = useMemo<VariantSelectionState>(() => {
    const key = comboKeyFor(variants.axis, selectedSize, selectedColor);
    const label = labelFor(variants.axis, selectedSize, selectedColor);
    const override: VariantOverride | undefined = key ? overrides[key] : undefined;
    const priceGbp = override?.priceGbp ?? basePriceGbp;
    const imageUrl = override?.imageUrl || baseImageUrl;
    const isOutOfStock = override?.stock === 0;
    return {
      comboKey: key,
      label,
      priceGbp,
      imageUrl,
      isOutOfStock,
      sku: override?.sku
    };
  }, [variants.axis, selectedSize, selectedColor, overrides, basePriceGbp, baseImageUrl]);

  useEffect(() => {
    onChange(state);
  }, [state, onChange]);

  // Stock lookup for a hypothetical selection — used to grey out chips
  // that lead to guaranteed out-of-stock combinations. For size axis
  // (or when partial), we can't infer stock without both axes chosen.
  function isChipOutOfStock(kind: "size" | "color", value: string): boolean {
    if (variants.axis === "size" && kind === "size") {
      return overrides[value]?.stock === 0;
    }
    if (variants.axis === "color" && kind === "color") {
      return overrides[value]?.stock === 0;
    }
    if (variants.axis === "size_color") {
      // Only mark OOS when the OTHER axis has an active selection —
      // otherwise "colour X" might be in stock for a different size.
      if (kind === "size" && selectedColor) {
        return overrides[`${value}|${selectedColor}`]?.stock === 0;
      }
      if (kind === "color" && selectedSize) {
        return overrides[`${selectedSize}|${value}`]?.stock === 0;
      }
    }
    return false;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Size row */}
      {wantsSize && sizeOptions.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Size
            </span>
            {selectedSize && (
              <span className="text-[10.5px] font-bold text-neutral-700">
                {selectedSize}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sizeOptions.map((s) => {
              const active = selectedSize === s;
              const oos = isChipOutOfStock("size", s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSize(s)}
                  aria-pressed={active}
                  aria-label={`Size ${s}${oos ? " (out of stock)" : ""}`}
                  className={`relative min-w-[44px] rounded-full border px-3 py-1.5 text-[12px] font-black uppercase tracking-wider transition active:scale-[0.97] ${
                    active
                      ? "border-neutral-900 text-neutral-900"
                      : oos
                        ? "border-neutral-200 text-neutral-400 line-through"
                        : "border-neutral-300 text-neutral-800 hover:border-neutral-500"
                  }`}
                  style={active ? { backgroundColor: BRAND_YELLOW } : undefined}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Colour row — chips include a hex swatch when the merchant
          provided one, otherwise just the name. */}
      {wantsColor && colorOptions.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Colour
            </span>
            {selectedColor && (
              <span className="text-[10.5px] font-bold text-neutral-700">
                {selectedColor}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {colorOptions.map((c) => {
              const active = selectedColor === c.name;
              const oos = isChipOutOfStock("color", c.name);
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setSelectedColor(c.name)}
                  aria-pressed={active}
                  aria-label={`Colour ${c.name}${oos ? " (out of stock)" : ""}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11.5px] font-black transition active:scale-[0.97] ${
                    active
                      ? "border-neutral-900 text-neutral-900"
                      : oos
                        ? "border-neutral-200 text-neutral-400 line-through"
                        : "border-neutral-300 text-neutral-800 hover:border-neutral-500"
                  }`}
                  style={active ? { backgroundColor: BRAND_YELLOW } : undefined}
                >
                  {c.hex && (
                    <span
                      aria-hidden
                      className="inline-block h-3.5 w-3.5 flex-shrink-0 rounded-full border border-neutral-300"
                      style={{ backgroundColor: c.hex }}
                    />
                  )}
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stock line — quiet unless the current combo is OOS or the SKU
          is set. Skips when everything is stock-not-tracked. */}
      {(state.isOutOfStock || state.sku) && (
        <div className="flex flex-wrap items-center gap-2 text-[10.5px] font-bold text-neutral-600">
          {state.isOutOfStock && (
            <span className="rounded-sm bg-red-50 px-1.5 py-0.5 uppercase tracking-wider text-red-700">
              Out of stock — enquire anyway
            </span>
          )}
          {state.sku && (
            <span className="text-neutral-500">
              Ref: {state.sku}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
