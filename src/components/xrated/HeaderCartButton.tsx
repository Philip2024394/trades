"use client";

// HeaderCartButton — yellow round cart icon with a red live-count badge.
//
// Reads the per-slug Xrated cart from localStorage on mount, listens for
// the cross-component `xrated-cart-change` CustomEvent that xratedCart.ts
// dispatches on add/update/remove, and renders a small red circle on the
// top-right with the total item count when > 0. Badge disappears at 0.

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_VERSION = "v1";

function storageKey(slug: string): string {
  return `xrated_cart_${STORAGE_VERSION}::${slug}`;
}

function readCount(slug: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { items?: Array<{ qty?: number }> };
    if (!Array.isArray(parsed.items)) return 0;
    return parsed.items.reduce((sum, it) => {
      const q = typeof it.qty === "number" && Number.isFinite(it.qty) ? it.qty : 0;
      return sum + Math.max(0, Math.floor(q));
    }, 0);
  } catch {
    return 0;
  }
}

export function HeaderCartButton({
  slug,
  cartHref
}: {
  slug: string;
  cartHref: string;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(readCount(slug));
    function onChange(e: Event) {
      const ce = e as CustomEvent<{ slug?: string }>;
      if (!ce.detail?.slug || ce.detail.slug === slug) {
        setCount(readCount(slug));
      }
    }
    window.addEventListener("xrated-cart-change", onChange as EventListener);
    function onStorage(e: StorageEvent) {
      if (e.key === storageKey(slug)) setCount(readCount(slug));
    }
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("xrated-cart-change", onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [slug]);

  return (
    <Link
      href={cartHref}
      aria-label={`View cart${count > 0 ? ` — ${count} item${count === 1 ? "" : "s"}` : ""}`}
      className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-900 transition hover:opacity-90"
      style={{ background: "#FFB300" }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {count > 0 && (
        <span
          className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-extrabold leading-none text-white"
          style={{ background: "#DC2626", boxShadow: "0 0 0 2px #0A0A0A" }}
          aria-hidden="true"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

export default HeaderCartButton;
