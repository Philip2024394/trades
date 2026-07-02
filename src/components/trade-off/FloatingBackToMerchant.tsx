"use client";

// FloatingBackToMerchant — sticky chip that follows a customer onto a
// trade's app when they got there via the Trade Connections carousel.
// Solves the "you sent my customer away" merchant complaint that would
// otherwise kill adoption of the carousel.
//
// Behaviour:
//   - Reads ?from=<merchantSlug>&fromProduct=<productSlug> on first
//     mount, persists into sessionStorage with a 60-minute TTL
//   - Bottom-left, 50 px tall pill so it doesn't fight WhatsApp green
//     CTAs that traditionally live bottom-right
//   - On click → POSTs a `return_to_merchant` tracking event then
//     navigates back to the originating product page (full restore)
//   - Pulses softly for the first 3 seconds on initial appearance so
//     the user notices it
//   - Hidden entirely if no ?from= param (organic visit to the trade's
//     app)

import { useEffect, useState } from "react";

type Anchor = {
  merchant_slug: string;
  merchant_name?: string;
  product_slug?: string;
  expires_at: number;
};

const STORAGE_KEY = "xrated_tc_back_anchor_v1";
const TTL_MS = 60 * 60 * 1000;

export function FloatingBackToMerchant({
  merchantNameOverride
}: {
  /** Optional friendly name to render in the chip — when omitted we
   *  fall back to the slug (still readable but less polished). */
  merchantNameOverride?: string;
}) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const from = url.searchParams.get("from");
    const fromProduct = url.searchParams.get("fromProduct") ?? undefined;

    // 1. New ?from= → persist into sessionStorage
    if (from) {
      const a: Anchor = {
        merchant_slug: from,
        merchant_name: merchantNameOverride,
        product_slug: fromProduct,
        expires_at: Date.now() + TTL_MS
      };
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(a));
      } catch {
        /* private mode — anchor stays in component state only */
      }
      setAnchor(a);
      return;
    }

    // 2. No fresh ?from= — read whatever was stored within the TTL
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Anchor;
      if (parsed.expires_at < Date.now()) {
        window.sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      setAnchor(parsed);
    } catch {
      /* ignore */
    }
  }, [merchantNameOverride]);

  if (!anchor) return null;

  const label = anchor.merchant_name ?? prettifySlug(anchor.merchant_slug);
  const href = anchor.product_slug
    ? `/${encodeURIComponent(anchor.merchant_slug)}/shop/${encodeURIComponent(anchor.product_slug)}`
    : `/${encodeURIComponent(anchor.merchant_slug)}`;

  function onClick() {
    // Fire-and-forget tracking before navigating away. anchor is
    // guaranteed non-null here because the early-return above bails
    // when there's no anchor, but TS can't see that across the
    // closure boundary — snapshot to a local for narrowing.
    const a = anchor;
    if (!a) return;
    try {
      navigator.sendBeacon?.(
        "/api/trade-off/trade-connections/track",
        new Blob(
          [
            JSON.stringify({
              merchant_slug: a.merchant_slug,
              product_slug: a.product_slug,
              action: "return_to_merchant"
            })
          ],
          { type: "application/json" }
        )
      );
    } catch {
      /* ignore */
    }
    // Clear the anchor — return-trip used
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <style>{`
        @keyframes tc-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 179, 0, 0.45); }
          50%      { box-shadow: 0 0 0 8px rgba(255, 179, 0, 0); }
        }
        .tc-back-chip {
          animation: tc-pulse 1.5s ease-out 2;
        }
      `}</style>
      <a
        href={href}
        onClick={onClick}
        className="tc-back-chip fixed bottom-4 left-4 z-50 inline-flex h-12 items-center gap-2 rounded-full bg-neutral-900 px-4 text-[12px] font-extrabold text-white shadow-lg transition hover:bg-[#FFB300] hover:text-neutral-900"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to {label}
      </a>
    </>
  );
}

function prettifySlug(slug: string): string {
  return slug
    .replace(/^demo-/, "")
    .split("-")
    .slice(0, 3)
    .map((p) => p[0]?.toUpperCase() + p.slice(1))
    .join(" ");
}
