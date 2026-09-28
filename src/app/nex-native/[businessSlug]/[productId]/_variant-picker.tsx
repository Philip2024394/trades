"use client";

// src/app/nex-native/[businessSlug]/[productId]/_variant-picker.tsx
//
// Bridge 20c · Buyer variant picker grouped by attribute.
// -------------------------------------------------------
// Renders one radio row per variant axis (Size · Colour · etc.).
// Selection live-updates the displayed price (if the picked variant
// has a price_pence override) + shows a Sold-out badge when the
// per-variant stock status says so.
//
// The picker is client-only presentation · when the buyer taps
// Order Now, the current selection names are appended to the
// message body so the seller sees exactly what was requested.

import { useState } from "react";
import {
  NEX_CART_STORAGE_KEY,
  type NexCartItem,
} from "@/lib/nex-native/cart-types";

const NEX = {
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  orange: "#FF7200",
  orangeSoft: "rgba(255,114,0,0.6)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  red: "#FF3355",
  panelSoft: "rgba(6, 15, 28, 0.72)",
};

export interface PickerVariant {
  id: string;
  name: string;
  attribute: string;
  price_pence: number | null;
  stock_status: string | null;
}

export interface VariantPickerCartInfo {
  productId: string;
  productName: string;
  imageUrl: string | null;
  shopId: string;
  shopSlug: string;
  shopOwnerAccountId: string;
  shopDisplayName: string;
}

export function VariantPicker({
  variants,
  currency,
  basePricePence,
  formatPrice,
  cartInfo,
}: {
  variants: PickerVariant[];
  currency: string;
  basePricePence: number;
  formatPrice: (pence: number, currency: string) => string;
  /** Bridge 22d · when set, renders a variant-aware Add to Cart
   *  button under the picker · picker's internal selection flows
   *  into the cart line's variants array so the seller sees the
   *  exact combination the buyer picked. */
  cartInfo?: VariantPickerCartInfo;
}) {
  const grouped: Record<string, PickerVariant[]> = {};
  for (const v of variants) {
    const key = v.attribute || "other";
    (grouped[key] ??= []).push(v);
  }

  const [selection, setSelection] = useState<Record<string, string>>({});
  const [addedFlash, setAddedFlash] = useState(false);

  function currentVariantLabels(): string[] {
    return Object.entries(selection)
      .map(([axis, variantId]) => {
        const v = grouped[axis]?.find((x) => x.id === variantId);
        return v?.name ?? null;
      })
      .filter((x): x is string => !!x);
  }

  function addToCart() {
    if (!cartInfo) return;
    try {
      const raw = window.localStorage.getItem(NEX_CART_STORAGE_KEY);
      const arr: NexCartItem[] = raw ? JSON.parse(raw) : [];
      const variantLabels = currentVariantLabels();
      const dedupeKey = `${cartInfo.shopId}::${cartInfo.productId}::${variantLabels
        .slice()
        .sort()
        .join("|")}`;
      const idx = arr.findIndex(
        (x) =>
          x &&
          `${x.shop_id}::${x.id}::${(x.variants ?? []).slice().sort().join("|")}` ===
            dedupeKey,
      );
      if (idx >= 0) {
        arr[idx] = { ...arr[idx]!, quantity: (arr[idx]!.quantity || 1) + 1 };
      } else {
        arr.push({
          key:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${dedupeKey}::${Date.now()}`,
          kind: "product",
          id: cartInfo.productId,
          shop_id: cartInfo.shopId,
          shop_slug: cartInfo.shopSlug,
          shop_owner_account_id: cartInfo.shopOwnerAccountId,
          shop_display_name: cartInfo.shopDisplayName,
          name: cartInfo.productName,
          price_pence: effectivePence,
          currency,
          image_url: cartInfo.imageUrl,
          quantity: 1,
          variants: variantLabels,
          note: null,
          added_at: Date.now(),
        });
      }
      window.localStorage.setItem(NEX_CART_STORAGE_KEY, JSON.stringify(arr));
      window.dispatchEvent(new CustomEvent("nex-cart-changed"));
      setAddedFlash(true);
      setTimeout(() => setAddedFlash(false), 1400);
    } catch {
      // localStorage disabled · silent no-op
    }
  }

  // Compute effective price · sum of overrides where set, else base.
  const overrides = Object.entries(selection)
    .map(([axis, variantId]) => {
      const v = grouped[axis]?.find((x) => x.id === variantId);
      return v?.price_pence ?? null;
    })
    .filter((x): x is number => typeof x === "number");
  const effectivePence =
    overrides.length > 0
      ? Math.max(...overrides) // pick the highest override so any premium option wins
      : basePricePence;

  // Any picked variant is sold out?
  const outSelection = Object.entries(selection).find(([axis, variantId]) => {
    const v = grouped[axis]?.find((x) => x.id === variantId);
    return v?.stock_status === "sold_out";
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {Object.entries(grouped).map(([axis, list]) => (
        <div key={axis}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            {prettify(axis)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {list.map((v) => {
              const isSelected = selection[axis] === v.id;
              const isSoldOut = v.stock_status === "sold_out";
              const priceLabel = v.price_pence
                ? formatPrice(v.price_pence, currency)
                : null;
              return (
                <label
                  key={v.id}
                  aria-disabled={isSoldOut}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 14px",
                    borderRadius: 12,
                    background: isSoldOut
                      ? "rgba(139,169,209,0.05)"
                      : isSelected
                        ? "rgba(0,175,255,0.14)"
                        : "rgba(0,0,0,0.32)",
                    border: isSoldOut
                      ? `1px dashed ${NEX.borderStrong}`
                      : isSelected
                        ? `1px solid ${NEX.cyanSoft}`
                        : `1px solid ${NEX.border}`,
                    color: isSoldOut ? NEX.textMute : NEX.text,
                    cursor: isSoldOut ? "not-allowed" : "pointer",
                    fontFamily:
                      "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                    textDecoration: isSoldOut ? "line-through" : "none",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="radio"
                    name={`variant_${axis}`}
                    value={v.id}
                    checked={isSelected}
                    onChange={() =>
                      setSelection((prev) => ({ ...prev, [axis]: v.id }))
                    }
                    disabled={isSoldOut}
                    style={{ accentColor: NEX.cyan }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{v.name}</span>
                  {priceLabel && (
                    <span
                      style={{
                        fontSize: 11,
                        color: NEX.orange,
                        fontWeight: 700,
                      }}
                    >
                      {priceLabel}
                    </span>
                  )}
                  {isSoldOut && (
                    <span
                      style={{
                        fontSize: 9,
                        color: NEX.red,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        fontWeight: 800,
                      }}
                    >
                      · sold out
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {/* Live price + sold-out banner */}
      <div
        style={{
          marginTop: 6,
          padding: "10px 14px",
          borderRadius: 12,
          background: outSelection
            ? "rgba(255,51,85,0.08)"
            : "rgba(0,175,255,0.08)",
          border: outSelection
            ? "1px solid rgba(255,51,85,0.30)"
            : `1px solid ${NEX.cyanSoft}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          {outSelection ? (
            <div
              style={{
                fontSize: 12,
                color: "#FFB4C0",
                fontWeight: 700,
              }}
            >
              This combination is sold out · pick another
            </div>
          ) : (
            <div style={{ fontSize: 11, color: NEX.textDim }}>
              {Object.keys(selection).length > 0
                ? "Your selection"
                : "Base price · pick options above to see variant pricing"}
            </div>
          )}
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: NEX.orange,
          }}
        >
          {formatPrice(effectivePence, currency)}
        </div>
      </div>

      {cartInfo && (
        <button
          type="button"
          onClick={addToCart}
          disabled={!!outSelection}
          data-nex-variant-add-to-cart
          style={{
            marginTop: 4,
            padding: "13px 18px",
            borderRadius: 14,
            background: outSelection
              ? "rgba(139,169,209,0.10)"
              : addedFlash
                ? "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)"
                : "linear-gradient(180deg, #FF9033 0%, #FF7800 100%)",
            border: outSelection
              ? `1px solid ${NEX.borderStrong}`
              : addedFlash
                ? "1px solid rgba(34,197,94,0.6)"
                : `1px solid ${NEX.orangeSoft}`,
            color: outSelection ? NEX.textMute : "#0B0F1A",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: outSelection ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            boxShadow: outSelection
              ? "none"
              : "0 12px 28px rgba(255,120,0,0.35), inset 0 1px 0 rgba(255,255,255,0.28)",
            transition: "background 200ms ease",
          }}
        >
          {addedFlash
            ? "Added ✓"
            : Object.keys(selection).length > 0
              ? `Add to Cart · ${currentVariantLabels().join(" · ")}`
              : "Add to Cart"}
        </button>
      )}
    </div>
  );
}

function prettify(a: string): string {
  return a.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
