"use client";

// src/app/nex-native/_header-cart-icon.tsx
//
// Cart icon that sits in the top header of shop/restaurant surfaces.
// Two visual variants:
//   • "fixed"  (default) · absolute-positioned floating icon · used on
//                          subpages without a header right-cluster
//                          (e.g. /nex-native/[businessSlug]/menu).
//   • "inline"           · 15px icon that slots into the shop landing
//                          page's Home/Settings cluster · matches the
//                          HeaderIconLink styling exactly.
//
// Reads NEX_CART_STORAGE_KEY on mount + listens for `nex-cart-changed`
// so the badge count updates whenever any AddToCartButton fires. Zero
// count renders the icon without a badge · the icon stays visible so
// buyers always know where the cart lives.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  NEX_CART_STORAGE_KEY,
  type NexCartItem,
} from "@/lib/nex-native/cart-types";

function readCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(NEX_CART_STORAGE_KEY);
    if (!raw) return 0;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return 0;
    return arr.reduce(
      (n, x) =>
        n +
        (x && typeof x === "object" && typeof (x as NexCartItem).quantity === "number"
          ? Math.max(0, Math.floor((x as NexCartItem).quantity))
          : 0),
      0,
    );
  } catch {
    return 0;
  }
}

export function HeaderCartIcon({
  variant = "fixed",
}: {
  variant?: "fixed" | "inline";
} = {}) {
  const [count, setCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCount(readCount());
    setHydrated(true);
    const onChange = () => setCount(readCount());
    window.addEventListener("nex-cart-changed", onChange);
    const onStorage = (e: StorageEvent) => {
      if (e.key === NEX_CART_STORAGE_KEY) setCount(readCount());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("nex-cart-changed", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const isInline = variant === "inline";
  const iconSize = isInline ? 15 : 20;

  const svg = (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={isInline ? 1.9 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="21" r="1.5" />
      <circle cx="18" cy="21" r="1.5" />
      <path d="M3 3h2l2.7 12.3a2 2 0 0 0 2 1.7h7.6a2 2 0 0 0 2-1.6L21 8H6" />
    </svg>
  );

  const badge =
    hydrated && count > 0 ? (
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: isInline ? -5 : -4,
          right: isInline ? -6 : -4,
          minWidth: isInline ? 14 : 20,
          height: isInline ? 14 : 20,
          padding: isInline ? "0 3px" : "0 5px",
          borderRadius: 999,
          background: "linear-gradient(180deg, #FF77BC, #FF3F9F)",
          color: "#0B0F1A",
          fontSize: isInline ? 9 : 11,
          fontWeight: 800,
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: isInline ? "1px solid #050f1e" : "1.5px solid #050f1e",
          boxShadow: "0 4px 10px rgba(255,63,159,0.55)",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {count > 99 ? "99+" : count}
      </span>
    ) : null;

  if (isInline) {
    return (
      <Link
        href="/nex-native/cart"
        aria-label={
          count > 0 ? `Open cart · ${count} item${count === 1 ? "" : "s"}` : "Open cart"
        }
        style={{
          position: "relative",
          display: "inline-grid",
          placeItems: "center",
          padding: 6,
          color: "#FFFFFF",
          textDecoration: "none",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.65))",
        }}
      >
        {svg}
        {badge}
      </Link>
    );
  }

  // "fixed" · 44 (P2 menu) + 16 (right inset) + 8 (gap) = 68px right offset.
  return (
    <Link
      href="/nex-native/cart"
      aria-label={
        count > 0 ? `Open cart · ${count} item${count === 1 ? "" : "s"}` : "Open cart"
      }
      className="fixed z-40 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-neutral-900/80 text-white shadow-md backdrop-blur hover:bg-neutral-900"
      style={{ right: 68, top: 16 }}
    >
      {svg}
      {badge}
    </Link>
  );
}
