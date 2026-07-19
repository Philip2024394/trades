"use client";

// Guide progress — localStorage-backed set of feature IDs the user has
// already opened. Powers the green "seen" tick on each card and the
// "N of 12 explored" counter in the guide header.
//
// Keyed by a version constant so a manifest bump can reset progress
// cleanly ("we added new features, take another look").

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY     = "tn.howItWorks.seen.v1";
const STORAGE_VERSION = 1;

export function useGuideProgress() {
  const [seen, setSeen] = useState<Set<string>>(new Set());

  // Read on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { v: number; ids: string[] };
      if (parsed.v === STORAGE_VERSION && Array.isArray(parsed.ids)) {
        setSeen(new Set(parsed.ids));
      }
    } catch { /* ignore parse errors */ }
  }, []);

  // Persist on change
  const persist = useCallback((next: Set<string>) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ v: STORAGE_VERSION, ids: Array.from(next) })
      );
    } catch { /* quota / private mode → fail silent */ }
  }, []);

  const markSeen = useCallback((id: string) => {
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      persist(next);
      return next;
    });
  }, [persist]);

  const reset = useCallback(() => {
    setSeen(new Set());
    if (typeof window !== "undefined") {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
  }, []);

  return { seen, markSeen, reset };
}
