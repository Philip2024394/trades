"use client";

// Client component · lets the user pick variant options and shows resolved
// price/stock via the pure variant-resolver.

import { useState } from "react";
import { resolveVariant, type SelectionMap } from "@/lib/nex-shop/variant-resolver";
import type { Product } from "@/lib/nex-shop/types";

function fmtIdr(n: number): string { return "Rp " + n.toLocaleString("id-ID"); }

export default function VariantSelector({ product }: { product: Product }): React.JSX.Element {
  const [selection, setSelection] = useState<SelectionMap>({});
  const result = resolveVariant(product, selection);

  const setValue = (optionName: string, value: string) => {
    setSelection((s) => ({ ...s, [optionName]: value }));
  };

  return (
    <div>
      {product.options.map((opt) => (
        <div key={opt.optionId} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, color: "#8a8776", marginBottom: 6 }}>{opt.name}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {opt.values.map((v) => {
              const picked = selection[opt.name]?.toLowerCase() === v.value.toLowerCase();
              return (
                <button
                  key={v.optionValueId}
                  type="button"
                  onClick={() => setValue(opt.name, v.value)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: picked ? "2px solid #1a1a1a" : "1px solid #ddd",
                    background: picked ? "#1a1a1a" : "#fff",
                    color: picked ? "#fff" : "#1a1a1a",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {v.value}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 24, padding: 16, borderRadius: 12, background: "#faf7f2", border: "1px solid #eee" }}>
        {result.status === "BASE_PRODUCT" && (
          <>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtIdr(result.priceIdr)}</div>
            <div style={{ marginTop: 4, fontSize: 13, color: result.outOfStock ? "#a52020" : "#1f6b1f" }}>
              {result.outOfStock ? "Out of stock" : `${result.stock} in stock · SKU ${result.sku ?? "—"}`}
            </div>
          </>
        )}
        {result.status === "OK" && (
          <>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtIdr(result.priceIdr)}</div>
            <div style={{ marginTop: 4, fontSize: 13, color: result.outOfStock ? "#a52020" : "#1f6b1f" }}>
              {result.outOfStock ? "Out of stock" : `${result.stock} in stock · SKU ${result.sku}`}
            </div>
          </>
        )}
        {result.status === "INCOMPLETE_SELECTION" && (
          <div style={{ fontSize: 14, color: "#8a8776" }}>
            Choose {result.missingOptions.join(" · ")} to see price and stock.
          </div>
        )}
        {result.status === "UNAVAILABLE" && (
          <div style={{ fontSize: 14, color: "#a52020" }}>
            Unavailable · this combination is not listed.
          </div>
        )}
        {result.status === "INVALID_OPTION" && (
          <div style={{ fontSize: 14, color: "#a52020" }}>Invalid option value.</div>
        )}
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
        <button
          type="button"
          disabled={!(result.status === "OK" || result.status === "BASE_PRODUCT") || ("outOfStock" in result && result.outOfStock)}
          style={{
            flex: 1, padding: "12px 20px", borderRadius: 999,
            border: "1px solid #1a1a1a", background: "#fff", color: "#1a1a1a",
            fontSize: 14, fontWeight: 500, cursor: "pointer",
            opacity: !(result.status === "OK" || result.status === "BASE_PRODUCT") || ("outOfStock" in result && result.outOfStock) ? 0.5 : 1,
          }}
          onClick={() => alert("Cart is a demo · no real payment.")}
        >Add to cart</button>
        <button
          type="button"
          disabled={!(result.status === "OK" || result.status === "BASE_PRODUCT") || ("outOfStock" in result && result.outOfStock)}
          style={{
            flex: 1, padding: "12px 20px", borderRadius: 999,
            border: "1px solid #1a1a1a", background: "#1a1a1a", color: "#fff",
            fontSize: 14, fontWeight: 500, cursor: "pointer",
            opacity: !(result.status === "OK" || result.status === "BASE_PRODUCT") || ("outOfStock" in result && result.outOfStock) ? 0.5 : 1,
          }}
          onClick={() => alert("Buy Now is a demo · no real payment.")}
        >Buy now</button>
      </div>
    </div>
  );
}
