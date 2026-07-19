"use client";

// Cart badge for the store header — reads the same localStorage
// cart via useStoreCart. Hidden when empty so the header stays
// clean before the merchant adds anything.

import Link from "next/link";
import { useStoreCart } from "./useStoreCart";

export function CartBadge() {
  const { count } = useStoreCart();
  return (
    <Link
      href="/store/cart"
      className="relative inline-flex h-8 items-center gap-1 rounded-md border px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-50"
      style={{ borderColor: "rgba(0,0,0,0.12)" }}
      aria-label={`Cart — ${count} item${count === 1 ? "" : "s"}`}
    >
      <span aria-hidden>🛒</span>
      Cart
      {count > 0 && (
        <span
          className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black"
          style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
