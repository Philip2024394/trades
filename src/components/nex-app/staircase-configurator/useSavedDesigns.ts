"use client";

// useSavedDesigns — client-side persistence for user-saved staircase designs.
// Backed by localStorage under the key "nex.staircase.savedDesigns" for now.
// Swap the readSaved / writeSaved helpers for a Supabase / server-backed store
// when we're ready to sync across devices.
//
// Returns {designs, saveDesign, deleteDesign, renameDesign}. `designs` is
// always sorted newest-first.

import { useEffect, useState, useCallback } from "react";
import type { StaircaseDesign } from "./StaircaseDesignSheet";

const STORAGE_KEY = "nex.staircase.savedDesigns";

function readSaved(): StaircaseDesign[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (d): d is StaircaseDesign =>
          !!d &&
          typeof d === "object" &&
          typeof (d as StaircaseDesign).id === "string" &&
          typeof (d as StaircaseDesign).name === "string" &&
          !!(d as StaircaseDesign).config &&
          typeof (d as StaircaseDesign).config === "object"
      )
      .map((d) => ({ ...d, origin: "saved" as const }));
  } catch {
    return [];
  }
}

function writeSaved(designs: StaircaseDesign[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(designs));
  } catch {
    /* quota exceeded or private-mode — silently drop */
  }
}

export function useSavedDesigns() {
  // Start empty on the server so SSR and first client render match. Hydrate
  // from localStorage in the effect below.
  const [designs, setDesigns] = useState<StaircaseDesign[]>([]);

  useEffect(() => {
    setDesigns(readSaved());
  }, []);

  const saveDesign = useCallback(
    (
      config: Record<string, string>,
      name?: string,
      description?: string,
      thumbnailUrl?: string
    ) => {
      const now = Date.now();
      const nextIndex = designs.length + 1;
      const design: StaircaseDesign = {
        id: `saved-${now}`,
        name: name?.trim() || `My design ${nextIndex}`,
        description: description?.trim() || undefined,
        thumbnailUrl: thumbnailUrl || undefined,
        origin: "saved",
        config: { ...config },
      };
      const next = [design, ...designs];
      setDesigns(next);
      writeSaved(next);
      return design;
    },
    [designs]
  );

  const deleteDesign = useCallback(
    (id: string) => {
      const next = designs.filter((d) => d.id !== id);
      setDesigns(next);
      writeSaved(next);
    },
    [designs]
  );

  const renameDesign = useCallback(
    (id: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      const next = designs.map((d) => (d.id === id ? { ...d, name: trimmed } : d));
      setDesigns(next);
      writeSaved(next);
    },
    [designs]
  );

  return { designs, saveDesign, deleteDesign, renameDesign };
}
