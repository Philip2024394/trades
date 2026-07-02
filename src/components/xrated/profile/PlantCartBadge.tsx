"use client";

// Floating cart badge — bottom-right FAB on plant hire pages. Auto-
// updates when the localStorage cart changes via the plant-cart-change
// custom event.

import Link from "next/link";
import { useEffect, useState } from "react";
import { readCart, cartTotalPence } from "@/lib/plantCart";

export function PlantCartBadge({ merchantSlug }: { merchantSlug: string }) {
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const load = () => {
      const items = readCart(merchantSlug);
      const c = items.reduce((s, i) => s + i.quantity, 0);
      setCount(c);
      setTotal(cartTotalPence(items));
    };
    load();
    setMounted(true);
    const onChange = (e: Event) => {
      const custom = e as CustomEvent<{ merchantSlug: string }>;
      if (custom.detail?.merchantSlug === merchantSlug) load();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === `plant-cart-${merchantSlug}`) load();
    };
    window.addEventListener("plant-cart-change", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("plant-cart-change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [merchantSlug]);

  if (!mounted || count === 0) return null;

  return (
    <Link
      href={`/${merchantSlug}/plant-hire/cart`}
      aria-label={`View hire list — ${count} item${count === 1 ? "" : "s"}`}
      className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-full bg-neutral-900 py-3 pl-4 pr-3 text-white shadow-2xl transition hover:bg-black sm:bottom-8 sm:right-8"
    >
      <span
        aria-hidden="true"
        className="grid h-9 w-9 place-items-center rounded-full text-[16px] font-extrabold text-neutral-900"
        style={{ background: "#FFB300" }}
      >
        {count}
      </span>
      <span className="text-left">
        <span className="block text-[9px] font-extrabold uppercase tracking-widest text-white/70">
          Hire list
        </span>
        <span className="block text-[13px] font-extrabold leading-none">
          £{(total / 100).toFixed(2)}
        </span>
      </span>
      <span aria-hidden="true" className="pl-2 pr-1">→</span>
    </Link>
  );
}
