"use client";

// OfflineBanner — sticky top ribbon shown when the merchant is
// offline. Non-blocking; the editor still works (autosave will hold
// mutations until fetchWithRetry drains them on reconnect).
//
// Auto-hides ~2 seconds after reconnect so "you're back online" gets
// a moment of acknowledgement before disappearing.

import { useEffect, useState } from "react";
import { useOnline } from "@/hooks/useOnline";

const AMBER = "#F59E0B";
const GREEN = "#10B981";

export function OfflineBanner() {
  const online = useOnline();
  const [reconnectFlash, setReconnectFlash] = useState(false);
  const [everOffline, setEverOffline] = useState(false);

  useEffect(() => {
    if (!online) {
      setEverOffline(true);
      setReconnectFlash(false);
      return;
    }
    // Only flash if we actually recovered from an offline period —
    // suppresses "You're back online" on initial page load.
    if (everOffline) {
      setReconnectFlash(true);
      const id = window.setTimeout(() => setReconnectFlash(false), 2200);
      return () => window.clearTimeout(id);
    }
  }, [online, everOffline]);

  if (online && !reconnectFlash) return null;

  const isOnline = online;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 px-4 py-2 text-[11px] font-extrabold uppercase tracking-widest text-white shadow-md"
      style={{
        background: isOnline ? GREEN : AMBER,
        color: isOnline ? "#FFFFFF" : "#0A0A0A"
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: isOnline ? "#FFFFFF" : "#0A0A0A"
        }}
      />
      <span>
        {isOnline
          ? "You’re back online — syncing changes"
          : "Offline — your edits are queued and will save when you reconnect"}
      </span>
    </div>
  );
}
