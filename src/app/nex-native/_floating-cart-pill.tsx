"use client";

// src/app/nex-native/_floating-cart-pill.tsx
//
// Bridge 22 · Floating cart pill visible on visitor surfaces when
// the cart has items. Reads localStorage on mount + listens for
// nex-cart-changed events so the badge updates instantly after an
// Add-to-cart click anywhere on the page. Tap opens /nex-native/cart.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  NEX_CART_STORAGE_KEY,
  type NexCartItem,
} from "@/lib/nex-native/cart-types";

export function FloatingCartPill() {
  const [count, setCount] = useState(0);
  const [subtotal, setSubtotal] = useState(0);
  const [currency, setCurrency] = useState("IDR");

  useEffect(() => {
    function refresh() {
      try {
        const raw = window.localStorage.getItem(NEX_CART_STORAGE_KEY);
        if (!raw) {
          setCount(0);
          setSubtotal(0);
          return;
        }
        const arr = JSON.parse(raw) as NexCartItem[];
        let n = 0;
        let sum = 0;
        let cur = "IDR";
        for (const it of arr) {
          n += it.quantity;
          sum += it.price_pence * it.quantity;
          cur = it.currency || cur;
        }
        setCount(n);
        setSubtotal(sum);
        setCurrency(cur);
      } catch {
        setCount(0);
      }
    }
    refresh();
    const onChange = () => refresh();
    window.addEventListener("nex-cart-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("nex-cart-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  if (count === 0) return null;

  const majors = Math.round(subtotal / 100);
  const priceLabel =
    currency === "IDR"
      ? `Rp ${majors.toLocaleString()}`
      : currency === "GBP"
        ? `£${(subtotal / 100).toFixed(2)}`
        : currency === "USD"
          ? `$${(subtotal / 100).toFixed(2)}`
          : `${currency} ${majors.toLocaleString()}`;

  return (
    <Link
      href="/nex-native/cart"
      aria-label={`View cart · ${count} items`}
      style={{
        position: "fixed",
        left: "50%",
        bottom: "calc(env(safe-area-inset-bottom, 0) + 20px)",
        transform: "translateX(-50%)",
        zIndex: 55,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 18px",
        borderRadius: 999,
        background: "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
        border: "1px solid rgba(255,114,0,0.6)",
        color: "#0B0F1A",
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        textDecoration: "none",
        boxShadow:
          "0 14px 34px rgba(255,114,0,0.42), inset 0 1px 0 rgba(255,255,255,0.35)",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <span aria-hidden style={{ fontSize: 16 }}>
        🛒
      </span>
      <span>
        {count} item{count === 1 ? "" : "s"}
      </span>
      <span
        aria-hidden
        style={{
          padding: "2px 10px",
          borderRadius: 999,
          background: "rgba(11,15,26,0.14)",
          color: "#0B0F1A",
          fontWeight: 900,
        }}
      >
        {priceLabel}
      </span>
      <span aria-hidden>→</span>
    </Link>
  );
}
