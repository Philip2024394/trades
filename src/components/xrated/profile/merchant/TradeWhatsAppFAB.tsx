"use client";

// TradeWhatsAppFAB — trades-themed port of Hammerex's WhatsAppFAB.
//
// Floating WhatsApp pill fixed to the bottom-right. Hidden while the
// buy column (the `#buy-column` sentinel injected by BuyColumnFlip) is
// still in view — the user already has the primary Enquire button
// there — and slides in the moment the sentinel scrolls out of frame.
// Prevents dead chrome above the fold on mobile without wiring a
// custom scroll listener.
//
// Deep-links wa.me/<seller-digits>?text=<pre-composed message with
// product name, ref, and page URL>. No analytics wiring — trades don't
// have a per-tradesperson quote-signal logger yet; when they do, drop
// a fire-and-forget POST in the onClick.

import { useEffect, useState } from "react";

export function TradeWhatsAppFAB({
  sellerWhatsapp,
  sellerName,
  productName,
  productRef
}: {
  sellerWhatsapp: string | null | undefined;
  sellerName: string;
  productName: string;
  productRef: string | null | undefined;
}) {
  const [sentinelPassed, setSentinelPassed] = useState(false);
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    setPageUrl(window.location.href);
    // BuyColumnFlip renders `<div id="buy-column">…</div>` on the trades
    // PDP — mirror hammer's #pdp-buy-sentinel intent without depending
    // on hammer-specific markup.
    const sentinel = document.getElementById("buy-column");
    if (!sentinel) {
      // No sentinel means we can't detect scroll — show the FAB
      // immediately so the CTA is still reachable.
      setSentinelPassed(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => setSentinelPassed(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  const digits = (sellerWhatsapp ?? "").replace(/\D/g, "");
  if (!digits) return null;

  const first = sellerName.trim().split(/\s+/)[0] || "there";
  const refPart = productRef ? ` (Ref: ${productRef})` : "";
  const urlPart = pageUrl ? `\n${pageUrl}` : "";
  const text = `Hi ${first} — I'd like to ask about ${productName}${refPart}.${urlPart}`;
  const href = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={
        productRef
          ? `Quote on WhatsApp about Ref ${productRef}`
          : "Quote on WhatsApp"
      }
      className={`fixed right-4 z-30 inline-flex items-center gap-2 rounded-full px-4 py-3 text-[13px] font-black text-white shadow-[0_12px_32px_-8px_rgba(37,211,102,0.45)] transition-all duration-300 ease-out active:scale-95 hover:brightness-95 md:right-6 ${
        sentinelPassed
          ? "bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6 opacity-100"
          : "bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6 pointer-events-none opacity-0"
      }`}
      style={{ background: "#25D366" }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M20.5 3.5A11.85 11.85 0 0 0 3 19.7L2 22l2.4-1.05A11.86 11.86 0 1 0 20.5 3.5Zm-8.4 18a9.8 9.8 0 0 1-5-1.36l-.36-.22-2.84.62.6-2.77-.23-.37A9.83 9.83 0 1 1 12.1 21.5Zm5.6-7.32c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.97-.96 1.17-.18.2-.36.22-.66.07-1.78-.89-2.95-1.59-4.12-3.6-.31-.54.31-.5.89-1.67.1-.2.05-.37-.02-.52-.07-.15-.66-1.59-.9-2.18-.23-.57-.47-.5-.66-.5h-.56c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.06 2.89 1.21 3.09.15.2 2.09 3.19 5.07 4.48 1.77.76 2.46.83 3.34.7.54-.08 1.66-.68 1.89-1.34.23-.66.23-1.22.16-1.34-.07-.13-.27-.2-.57-.35Z" />
      </svg>
      <span className="hidden sm:inline">Quote on WhatsApp</span>
      <span className="sm:hidden">Quote</span>
    </a>
  );
}
