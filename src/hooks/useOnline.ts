"use client";

// useOnline — reactive navigator.onLine.
//
// Subscribes to browser `online` / `offline` events. Returns `true`
// on the server so SSR renders don't flash an offline banner during
// hydration.

import { useEffect, useState } from "react";

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // Sync initial state after hydration
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}
