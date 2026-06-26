"use client";

// Page-view analytics beacon for Xrated Trades surfaces. Renders nothing.
// - Posts a "start view" to /api/trade-off/track-view on mount.
// - Pings /api/trade-off/track-view-end via navigator.sendBeacon on the
//   visibilitychange (hidden), pagehide and beforeunload events AND on
//   component unmount, so single-page transitions still get a close.
//
// Session id is generated once per browser tab and persisted in
// sessionStorage so multiple page navigations stitch into one session.

import { useEffect, useRef } from "react";

const SESSION_KEY = "xrated_session_id";

function getOrCreateSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing && existing.length > 0) return existing;
    const fresh =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.sessionStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    // sessionStorage unavailable (privacy mode etc.) — return a one-off id.
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

function sendEndBeacon(viewId: string): void {
  if (!viewId) return;
  const payload = JSON.stringify({ view_id: viewId });
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/trade-off/track-view-end", blob);
      return;
    }
  } catch {
    // fall through to fetch
  }
  try {
    fetch("/api/trade-off/track-view-end", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true
    }).catch(() => undefined);
  } catch {
    // best-effort — never throw
  }
}

export function XratedViewTracker({
  listingId,
  page
}: {
  listingId: string | null;
  page: string;
}): null {
  const viewIdRef = useRef<string>("");
  const sentEndRef = useRef<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    async function startView() {
      try {
        const session_id = getOrCreateSessionId();
        const referrer =
          typeof document !== "undefined" && document.referrer ? document.referrer : null;
        const res = await fetch("/api/trade-off/track-view", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            listing_id: listingId,
            page,
            session_id,
            referrer
          })
        });
        if (cancelled) return;
        if (!res.ok) return;
        const data = (await res.json()) as { ok?: boolean; view_id?: string };
        if (data && data.ok && typeof data.view_id === "string") {
          viewIdRef.current = data.view_id;
        }
      } catch {
        // best-effort
      }
    }

    void startView();

    function endOnce() {
      if (sentEndRef.current) return;
      const id = viewIdRef.current;
      if (!id) return;
      sentEndRef.current = true;
      sendEndBeacon(id);
    }

    function handleVisibilityChange() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        endOnce();
      }
    }

    function handlePageHide() {
      endOnce();
    }

    function handleBeforeUnload() {
      endOnce();
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", handlePageHide);
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      cancelled = true;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("pagehide", handlePageHide);
        window.removeEventListener("beforeunload", handleBeforeUnload);
      }
      // Component unmount (e.g. client-side navigation) — close the row.
      endOnce();
    };
  }, [listingId, page]);

  return null;
}

export default XratedViewTracker;
