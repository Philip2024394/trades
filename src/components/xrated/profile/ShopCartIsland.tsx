"use client";

// Floating cart pill — fixed bottom-right. Reads the per-tradesperson
// cart from localStorage and watches for in-tab updates (custom event
// fired by xratedCart helpers) plus cross-tab `storage` events. Hides
// itself entirely when the cart is empty so we don't leave dead chrome
// on the profile.

import { useEffect, useState } from "react";
import {
  cartItemCount,
  cartTotalPence,
  formatGbp,
  readCart,
  type CartState
} from "@/lib/xratedCart";

export function ShopCartIsland({ slug }: { slug: string }) {
  const [state, setState] = useState<CartState | null>(null);

  useEffect(() => {
    setState(readCart(slug));
    function refresh() {
      setState(readCart(slug));
    }
    function onStorage(e: StorageEvent) {
      if (!e.key) return;
      if (e.key.endsWith(`::${slug}`)) refresh();
    }
    window.addEventListener("xrated-cart-change", refresh as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("xrated-cart-change", refresh as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [slug]);

  if (!state) return null;
  const count = cartItemCount(state);
  if (count === 0) return null;

  const total = cartTotalPence(state);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 sm:justify-end sm:px-6 sm:pb-6"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <a
        href={`/${slug}/cart`}
        className="pointer-events-auto inline-flex h-12 items-center gap-3 rounded-full border-2 border-[#FFB300] bg-neutral-900 pl-4 pr-2 text-white shadow-2xl transition active:scale-[0.98] sm:h-14 sm:pl-5"
        style={{ boxShadow: "0 10px 28px rgba(0,0,0,0.35)" }}
        aria-label={`Open cart with ${count} ${count === 1 ? "item" : "items"}`}
      >
        <span className="flex items-center gap-2">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-extrabold text-neutral-900"
            style={{ background: "#FFB300" }}
          >
            {count > 99 ? "99+" : count}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#FFB300]">
              Cart
            </span>
            <span className="text-[13px] font-extrabold text-white sm:text-sm">
              {formatGbp(total)}
            </span>
          </span>
        </span>
        <span
          className="ml-2 inline-flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 sm:h-10 sm:px-4"
          style={{ background: "#FFB300" }}
        >
          View
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </span>
      </a>
    </div>
  );
}
