// useNotifications — client-side notification feed hook.
//
// Polls /api/apps/notifications every 30s. Also refreshes on:
//   • window focus
//   • `tc:notifications-refresh` custom event
// Paints the app icon badge via `navigator.setAppBadge()` on every
// refresh so the icon count stays in sync with the unread count.

"use client";

import { useCallback, useEffect, useState } from "react";

export type Notification = {
  id: string;
  recipient_kind: "trade" | "merchant";
  kind: string;
  title: string;
  body: string;
  action_url: string | null;
  subject_type: string | null;
  subject_id: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

const API = "/api/apps/notifications";
const POLL_MS = 30_000;

async function paintAppBadge(count: number) {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0) await nav.setAppBadge?.(count);
    else await nav.clearAppBadge?.();
  } catch {
    /* not supported on this platform */
  }
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(API, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { notifications: Notification[]; unread: number };
      setNotifications(json.notifications ?? []);
      setUnread(json.unread ?? 0);
      paintAppBadge(json.unread ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    const onFocus = () => load();
    const onEvent = () => load();
    // Live push messages from the SW arrive as postMessage — refresh instantly.
    function onSwMessage(e: MessageEvent) {
      const data = e.data as { type?: string } | null;
      if (data?.type === "tc-notification") load();
    }
    window.addEventListener("focus", onFocus);
    window.addEventListener("tc:notifications-refresh", onEvent);
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSwMessage);
    }
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("tc:notifications-refresh", onEvent);
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSwMessage);
      }
    };
  }, [load]);

  async function markRead(id: string) {
    // Optimistic
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n))
    );
    setUnread((u) => Math.max(0, u - 1));
    paintAppBadge(Math.max(0, unread - 1));
    await fetch(`${API}/${encodeURIComponent(id)}/read`, { method: "POST" }).catch(() => null);
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnread(0);
    paintAppBadge(0);
    await fetch(`${API}/all/read`, { method: "POST" }).catch(() => null);
  }

  return { notifications, unread, loading, refresh: load, markRead, markAllRead };
}
