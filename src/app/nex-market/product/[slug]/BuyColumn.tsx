"use client";

// NEX Market BuyColumn · patterned after Hammer's BuyColumn/VariantSelector/StockBadge.
// Right-side sticky-ish column · variant selectors · honest price/stock · Add-to-cart CTA.
// Uses the shared variant-resolver so business logic is one place.

import { useState } from "react";
import { resolveVariant, type SelectionMap } from "@/lib/nex-shop/variant-resolver";
import { computeQuantityPricing } from "@/lib/nex-shop/pricing";
import type { Product } from "@/lib/nex-shop/types";

function fmtIdr(n: number): string { return "Rp " + n.toLocaleString("id-ID"); }

export default function BuyColumn({ product }: { product: Product }): React.JSX.Element {
  const [selection, setSelection] = useState<SelectionMap>({});
  const [quantity, setQuantity] = useState<number>(1);
  const result = resolveVariant(product, selection);

  const setValue = (optionName: string, value: string) => {
    setSelection((s) => ({ ...s, [optionName]: value }));
  };

  const okOrBase = result.status === "OK" || result.status === "BASE_PRODUCT";
  const outOfStock = okOrBase && "outOfStock" in result && result.outOfStock;
  const canBuy = okOrBase && !outOfStock;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Options */}
      {product.options.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {product.options.map((opt) => (
            <div key={opt.optionId}>
              <div style={{
                fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6,
                color: "#8a8776", marginBottom: 8, fontWeight: 500,
              }}>
                {opt.name}
                {selection[opt.name] && (
                  <span style={{ marginLeft: 8, textTransform: "none", color: "#1a1a1a", fontWeight: 600, letterSpacing: 0 }}>
                    · {selection[opt.name]}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {opt.values.map((v) => {
                  const picked = selection[opt.name]?.toLowerCase() === v.value.toLowerCase();
                  return (
                    <button
                      key={v.optionValueId}
                      type="button"
                      onClick={() => setValue(opt.name, v.value)}
                      style={{
                        padding: "9px 14px",
                        borderRadius: 999,
                        border: picked ? "2px solid #1a1a1a" : "1px solid rgba(0,0,0,0.14)",
                        background: picked ? "#1a1a1a" : "#fff",
                        color: picked ? "#fff" : "#1a1a1a",
                        fontSize: 13, fontWeight: picked ? 600 : 500,
                        cursor: "pointer",
                        transition: "all .12s ease",
                      }}
                    >
                      {v.value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Price + stock (pattern from Hammer StockBadge · honest labelling) */}
      <div style={{
        padding: 18, borderRadius: 16,
        background: "#faf7f2", border: "1px solid rgba(0,0,0,0.06)",
      }}>
        {result.status === "BASE_PRODUCT" && (() => {
          // Live quantity pricing · signature behaviour #2 · every claim on
          // this panel traces to seller-configured qtyPriceTiers (evidence-or-silence).
          const qp = computeQuantityPricing(result.priceIdr, product.qtyPriceTiers, quantity);
          const activeTier = qp.activeTier;
          return (
            <>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "#1a1a1a" }}>
                {fmtIdr(qp.pricePerUnitIdr)}
                <span style={{ fontSize: 13, fontWeight: 400, color: "#8a8776", marginLeft: 8 }}>/ unit</span>
              </div>
              {quantity > 1 && (
                <div style={{ marginTop: 6, fontSize: 14, color: "#333" }}>
                  <span style={{ fontWeight: 600 }}>{fmtIdr(qp.lineTotalIdr)}</span>
                  <span style={{ color: "#8a8776" }}> total for {quantity}</span>
                </div>
              )}
              {activeTier && qp.savingsLineTotalIdr > 0 && (
                <div style={{
                  marginTop: 8, display: "inline-block",
                  padding: "4px 10px", background: "#e8f5e9", color: "#1f6b1f",
                  borderRadius: 999, fontSize: 12, fontWeight: 600,
                }}>
                  Quantity price · save {fmtIdr(qp.savingsLineTotalIdr)}
                </div>
              )}
              {qp.nextTier && qp.unitsToNextTier !== null && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#8a8776" }}>
                  Add {qp.unitsToNextTier} more to get {fmtIdr(qp.nextTier.pricePerUnitIdr)} / unit
                </div>
              )}
              {product.qtyPriceTiers.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed rgba(0,0,0,0.1)" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "#8a8776", marginBottom: 6 }}>
                    Buy more, pay less
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 12 }}>
                    <span style={{ padding: "3px 8px", background: quantity < (product.qtyPriceTiers[0]?.minQty ?? Infinity) ? "#1a1a1a" : "#fff", color: quantity < (product.qtyPriceTiers[0]?.minQty ?? Infinity) ? "#fff" : "#333", border: "1px solid rgba(0,0,0,0.14)", borderRadius: 999 }}>
                      1× · {fmtIdr(result.priceIdr)}
                    </span>
                    {product.qtyPriceTiers.map((t) => {
                      const active = activeTier?.minQty === t.minQty;
                      return (
                        <span key={t.minQty} style={{ padding: "3px 8px", background: active ? "#1a1a1a" : "#fff", color: active ? "#fff" : "#333", border: "1px solid rgba(0,0,0,0.14)", borderRadius: 999 }}>
                          {t.minQty}× · {fmtIdr(t.pricePerUnitIdr)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 500, color: result.outOfStock ? "#a52020" : "#1f6b1f" }}>
                {result.outOfStock ? "Sold out" : `In stock · ${result.stock}${result.sku ? ` · SKU ${result.sku}` : ""}`}
              </div>
            </>
          );
        })()}
        {result.status === "OK" && (
          <>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "#1a1a1a" }}>
              {fmtIdr(result.priceIdr)}
            </div>
            <div style={{ marginTop: 6, fontSize: 13, fontWeight: 500, color: result.outOfStock ? "#a52020" : "#1f6b1f" }}>
              {result.outOfStock ? "Sold out" : `In stock · ${result.stock} · SKU ${result.sku}`}
            </div>
          </>
        )}
        {result.status === "INCOMPLETE_SELECTION" && (
          <div style={{ fontSize: 14, color: "#8a8776", padding: "4px 0" }}>
            Choose {result.missingOptions.join(" · ")} to see price and stock.
          </div>
        )}
        {result.status === "UNAVAILABLE" && (
          <div style={{ fontSize: 14, color: "#a52020", fontWeight: 500 }}>
            Unavailable · this combination is not listed by the seller.
          </div>
        )}
        {result.status === "INVALID_OPTION" && (
          <div style={{ fontSize: 14, color: "#a52020" }}>Invalid option value.</div>
        )}
      </div>

      {/* Quantity + CTAs (Hammer BuyColumn pattern) */}
      {canBuy && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            display: "inline-flex", alignItems: "center",
            border: "1px solid rgba(0,0,0,0.14)", borderRadius: 999, overflow: "hidden",
          }}>
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              style={{ padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", fontSize: 16 }}>−</button>
            <span style={{ minWidth: 32, textAlign: "center", fontSize: 14, fontWeight: 500 }}>{quantity}</span>
            <button type="button" onClick={() => setQuantity((q) => q + 1)}
              style={{ padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", fontSize: 16 }}>+</button>
          </div>
          <span style={{ fontSize: 12, color: "#8a8776" }}>Qty</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="button"
          disabled={!canBuy}
          onClick={() => alert("Cart is a demo · no real payment.")}
          style={{
            flex: 1, padding: "13px 20px", borderRadius: 999,
            border: "1px solid #1a1a1a", background: "#fff", color: "#1a1a1a",
            fontSize: 14, fontWeight: 500, cursor: canBuy ? "pointer" : "not-allowed",
            opacity: canBuy ? 1 : 0.5,
          }}
        >Add to cart</button>
        <button
          type="button"
          disabled={!canBuy}
          onClick={() => alert("Buy Now is a demo · no real payment.")}
          style={{
            flex: 1, padding: "13px 20px", borderRadius: 999,
            border: "1px solid #1a1a1a", background: "#1a1a1a", color: "#fff",
            fontSize: 14, fontWeight: 600, cursor: canBuy ? "pointer" : "not-allowed",
            opacity: canBuy ? 1 : 0.5,
          }}
        >Buy now</button>
      </div>

      <div style={{ fontSize: 11, color: "#8a8776", lineHeight: 1.5 }}>
        NEX Market demo · no real payment · buttons are placeholders.
        {" · "}Delivery is future-arch · not enabled.
      </div>
    </div>
  );
}
