"use client";

// src/app/nex-native/[businessSlug]/[productId]/_order-bar.tsx
//
// Bridge 19 · Product detail sticky bottom Order bar.
// ---------------------------------------------------
// Client-side quantity picker + Order Now button that fires
// sendProductInquiryAction with intent=want + quantity so the
// buyer's chat gets the exact quantity in the opening message.
// Chat Now stays a plain link · that's a pure conversation start
// with no quantity yet.

import { useState } from "react";
import Link from "next/link";

const NEX = {
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  cyanSoft: "rgba(0,175,255,0.5)",
  orangeSoft: "rgba(255,114,0,0.6)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
};

export function OrderBar({
  productId,
  chatHref,
  orderAction,
}: {
  productId: string;
  chatHref: string;
  orderAction: (formData: FormData) => Promise<never> | void;
}) {
  const [qty, setQty] = useState<number>(1);
  const dec = () => setQty((v) => Math.max(1, v - 1));
  const inc = () => setQty((v) => Math.min(99, v + 1));

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      {/* Quantity picker */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0,
          borderRadius: 999,
          background: "rgba(0,0,0,0.35)",
          border: `1px solid ${NEX.borderStrong}`,
          overflow: "hidden",
          height: 46,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={dec}
          aria-label="Decrease quantity"
          disabled={qty <= 1}
          style={qtyButton(qty <= 1)}
        >
          −
        </button>
        <div
          aria-live="polite"
          style={{
            minWidth: 40,
            textAlign: "center",
            fontSize: 15,
            fontWeight: 800,
            color: NEX.text,
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          {qty}
        </div>
        <button
          type="button"
          onClick={inc}
          aria-label="Increase quantity"
          disabled={qty >= 99}
          style={qtyButton(qty >= 99)}
        >
          +
        </button>
      </div>

      {/* Order Now · form submit with quantity */}
      <form action={orderAction} style={{ flex: "1 1 140px", minWidth: 120 }}>
        <input type="hidden" name="product_id" value={productId} />
        <input type="hidden" name="intent" value="want" />
        <input type="hidden" name="quantity" value={qty} readOnly />
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 14,
            background: "linear-gradient(180deg, #FF9033 0%, #FF7800 100%)",
            border: `1px solid ${NEX.orangeSoft}`,
            color: "#0B0F1A",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow:
              "0 12px 28px rgba(255,120,0,0.4), inset 0 1px 0 rgba(255,255,255,0.28)",
          }}
        >
          Order · {qty}
        </button>
      </form>

      {/* Chat Now · plain link */}
      <Link
        href={chatHref}
        style={{
          flex: "1 1 100px",
          minWidth: 100,
          padding: "14px 16px",
          borderRadius: 14,
          background: "rgba(0,175,255,0.16)",
          border: `1px solid ${NEX.cyanSoft}`,
          color: NEX.text,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textDecoration: "none",
          textAlign: "center",
        }}
      >
        Chat Now
      </Link>
    </div>
  );
}

function qtyButton(disabled: boolean): React.CSSProperties {
  return {
    width: 42,
    height: 46,
    background: "transparent",
    border: "none",
    color: disabled ? "rgba(139,169,209,0.35)" : "#F4F7FC",
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
  };
}
