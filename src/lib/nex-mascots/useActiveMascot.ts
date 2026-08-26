// NEX Active Mascot · localStorage-backed React hook · 2026-08-27.
//
// Persistence key: `nex.mascot.active.v1` (mirror of nex.guidance.memory.v1
// pattern from nexGuidanceMemory.ts · anonymous · single-device).
//
// Stores mascot ID only. Full mascot resolved via findById() on read so a
// removed mascot degrades gracefully (returns undefined · caller shows the
// default state).

"use client";

import { useCallback, useEffect, useState } from "react";
import { findById } from "./registry";
import type { Mascot } from "./types";

const STORAGE_KEY = "nex.mascot.active.v1";

function readStoredId(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function writeStoredId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id === null) window.localStorage.removeItem(STORAGE_KEY);
    else            window.localStorage.setItem(STORAGE_KEY, id);
  } catch { /* silent · quota / private-mode fallback */ }
}

export interface UseActiveMascot {
  activeMascot: Mascot | undefined;
  activeMascotId: string | null;
  setActive: (id: string) => void;
  clear: () => void;
}

export function useActiveMascot(): UseActiveMascot {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => { setId(readStoredId()); }, []);

  const setActive = useCallback((next: string) => {
    setId(next);
    writeStoredId(next);
  }, []);

  const clear = useCallback(() => {
    setId(null);
    writeStoredId(null);
  }, []);

  return {
    activeMascot:   id ? findById(id) : undefined,
    activeMascotId: id,
    setActive,
    clear,
  };
}
