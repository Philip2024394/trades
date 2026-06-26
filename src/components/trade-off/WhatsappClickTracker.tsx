"use client";

// Wraps any anchor that opens WhatsApp (wa.me/...) so a "click counted"
// beacon fires before the navigation. We use navigator.sendBeacon when
// available so the request survives the page unload that comes with the
// browser hopping to WhatsApp.
//
// The wrapper renders a plain <span> that contains the children. Children
// keep their own <a> semantics — right-click + "Open in new tab" still
// works, mid-click still works, the URL still appears in the status bar.
// Only the LEFT-CLICK path is instrumented; everything else falls through.

import type { MouseEvent, ReactNode } from "react";

export function WhatsappClickTracker({
  listingId,
  children
}: {
  listingId: string | null;
  children: ReactNode;
}) {
  function fireBeacon() {
    if (!listingId) return;
    const payload = JSON.stringify({ listing_id: listingId });
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([payload], { type: "application/json" });
        if (navigator.sendBeacon("/api/trade-off/track-whatsapp-click", blob)) return;
      }
    } catch {
      // fall through to fetch
    }
    try {
      fetch("/api/trade-off/track-whatsapp-click", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(() => undefined);
    } catch {
      // best-effort
    }
  }

  function onClick(e: MouseEvent<HTMLSpanElement>) {
    // Only count plain primary-button clicks. Modifier keys or middle-clicks
    // open a new tab and shouldn't be conflated with "customer is hitting
    // Contact and going to WhatsApp now".
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    fireBeacon();
  }

  return (
    <span onClick={onClick} className="contents">
      {children}
    </span>
  );
}

export default WhatsappClickTracker;
