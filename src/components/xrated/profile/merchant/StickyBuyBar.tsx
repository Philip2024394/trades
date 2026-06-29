"use client";

/**
 * @fileoverview MERCHANT-ONLY component.
 * @merchantOnly Only renders when isStorefrontOn(listing) === true.
 * Importing this from a service-trade context is a code smell — use
 * the service/ siblings instead.
 */


// StickyBuyBar — fixed-bottom rebuy island for long PDPs.
//
// Hidden on initial paint; reveals when the customer scrolls past the
// main buy column (sentinel ref at the bottom of #buy-column). When the
// user clicks "Add to cart" we use the scroll-anchor fallback documented
// in the brief: smooth-scroll back to #buy-column. The existing
// ProductPageAddToCart island stays the single source of truth for cart
// writes, so we never risk mismatched state.
//
// Layered above ShopCartIsland (z-40) but the cart island sits at its
// own z-index — visually the sticky buy bar reveals first, the cart
// island still hovers above it because we offset bottom with a margin
// equal to the cart island's 72px reservation on mobile.

import { useEffect, useRef, useState } from "react";
import type { HammerexXratedProduct } from "@/lib/supabase";
import { StarsRating } from "../StarsRating";

export function StickyBuyBar({
  product,
  stats,
  whatsappHref
}: {
  product: HammerexXratedProduct;
  stats: { rating: number | null; count: number };
  /** Pre-composed wa.me URL for the right-hand Chat Now CTA. */
  whatsappHref: string;
}) {
  const [show, setShow] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // The sentinel is rendered as a sibling of the buy column wrapper
  // (id="buy-column"). We watch a marker we mount at the bottom of the
  // buy column via querySelector after mount — simpler than threading a
  // ref through the existing buy column UI.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const target = document.getElementById("buy-column");
    if (!target) return;

    // Sentinel: a 1px tall div appended to the END of #buy-column. When
    // the sentinel scrolls out of view (top), we show the sticky bar.
    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.height = "1px";
    sentinel.style.width = "100%";
    target.appendChild(sentinel);
    sentinelRef.current = sentinel;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        // Show the bar when the sentinel is ABOVE the viewport (i.e. the
        // buy column has been scrolled past).
        const isBelowViewport = entry.boundingClientRect.top > 0;
        const visible = !entry.isIntersecting && !isBelowViewport;
        setShow(visible);
      },
      { threshold: 0, rootMargin: "0px 0px 0px 0px" }
    );
    io.observe(sentinel);
    return () => {
      io.disconnect();
      if (sentinel.parentNode) sentinel.parentNode.removeChild(sentinel);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 shadow-2xl"
      style={{ background: "#0A0A0A", paddingBottom: "env(safe-area-inset-bottom)" }}
      role="region"
      aria-label="Quick add to cart"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-3 py-2 sm:px-6">
        {product.cover_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.cover_url}
            alt=""
            className="h-10 w-10 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded-md bg-white/10" />
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-[13px] font-extrabold text-white">
            {product.name}
          </p>
          <div className="mt-0.5">
            <StarsRating rating={stats.rating} reviewCount={stats.count} />
          </div>
        </div>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-extrabold uppercase tracking-wider text-white shadow-lg transition active:scale-[0.98]"
          style={{
            background: "#0F7A3F",
            boxShadow: "0 6px 16px rgba(15,122,63,0.45)"
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Z" />
          </svg>
          Chat now
        </a>
      </div>
    </div>
  );
}

export default StickyBuyBar;
