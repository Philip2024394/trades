// useHeroSwap — merchant-facing state hook for the live "change image"
// flow. Owns the hero slot's current image, preset, edits, and text
// colour. Provides mutations that the sheet + edit controls call.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { evaluateHeroSlot } from "@/lib/hero-swap/suggestionEngine";
import {
  heroImageById,
  matchImagesForMerchant,
  siblingsForImage,
  siblingsFromList
} from "@/lib/hero-swap/library";
import { useHeroLibrary } from "./useHeroLibrary";
import type {
  AspectRatio,
  CropFocalPoint
} from "@/lib/hero-swap/imageCrop";
import {
  DEFAULT_HERO_EDITS
} from "@/lib/hero-swap/types";

const DEFAULT_FOCAL: CropFocalPoint = { x: 50, y: 50 };
const DEFAULT_FOCALS: Record<AspectRatio, CropFocalPoint> = {
  "16:9": { ...DEFAULT_FOCAL },
  "1:1": { ...DEFAULT_FOCAL },
  "3:4": { ...DEFAULT_FOCAL }
};
import type {
  HeroEdits,
  HeroImage,
  HeroPreset,
  HeroSlotState,
  HeroSuggestion
} from "@/lib/hero-swap/types";

export type UseHeroSwapOptions = {
  /** Merchant's trade keywords — drives the strict-match carousel. */
  merchantTradeKeywords: string[];
  /** Initial hero image id (from a saved merchant setting). */
  initialImageId?: string;
  /** Initial preset. Defaults to full_bleed. */
  initialPreset?: HeroPreset;
  /** Hero text colour used for contrast checks. */
  heroTextColor?: string;
  /** Slot key for persistence (e.g. "landing_hero", "about_hero").
   *  When set, changes auto-save to /api/hero-library/save-slot with
   *  a 600ms debounce. Omit for demo mode with no persistence. */
  slotKey?: string;
  /** Other slot keys that belong to the same site — used by the
   *  "Apply series across site" bulk write. Defaults to just the
   *  current slotKey (no bulk write). */
  siteSlotKeys?: string[];
  /** Where to load matched images from.
   *  - "static" (default) — bundled JSON, synchronous, zero-config
   *  - "api" — /api/hero-library, async, editable at runtime,
   *    falls back to static on failure. */
  loaderMode?: "static" | "api";
};

export function useHeroSwap(options: UseHeroSwapOptions) {
  const useApi = options.loaderMode === "api";

  // API path — hook always runs (rules-of-hooks). When useApi=false,
  // pass empty keywords so it early-returns without a network request.
  const apiState = useHeroLibrary({
    merchantTradeKeywords: useApi ? options.merchantTradeKeywords : []
  });

  const staticImages = useMemo(
    () =>
      useApi
        ? []
        : matchImagesForMerchant(options.merchantTradeKeywords),
    [useApi, options.merchantTradeKeywords]
  );

  const matchedImages = useApi ? apiState.images : staticImages;
  const isLoadingLibrary = useApi ? apiState.loading : false;
  const librarySource: "api" | "static-fallback" | "static" | "idle" =
    useApi ? apiState.source : "static";

  const initialImage: HeroImage | null = useMemo(() => {
    if (options.initialImageId) {
      // For API mode we can only resolve initialImageId once matched
      // images have loaded — fall through to matched[0] until then.
      const found =
        matchedImages.find((e) => e.id === options.initialImageId) ??
        (useApi ? null : heroImageById(options.initialImageId));
      if (found) return found;
    }
    return matchedImages[0] ?? null;
  }, [options.initialImageId, matchedImages, useApi]);

  const [image, setImage] = useState<HeroImage | null>(initialImage);

  // When API images arrive after the first render, adopt the first
  // one as the current image if we didn't have one yet.
  useEffect(() => {
    if (!image && matchedImages.length > 0) {
      setImage(matchedImages[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedImages]);
  const [preset, setPreset] = useState<HeroPreset>(
    options.initialPreset ?? "full_bleed"
  );
  const [edits, setEdits] = useState<HeroEdits>(DEFAULT_HERO_EDITS);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [uploadFocals, setUploadFocals] = useState<
    Record<AspectRatio, CropFocalPoint>
  >(DEFAULT_FOCALS);

  const heroTextColor = options.heroTextColor ?? "#ffffff";

  const slotState = useMemo<HeroSlotState | null>(
    () =>
      image
        ? {
            image,
            preset,
            edits,
            hero_text_color: heroTextColor
          }
        : null,
    [image, preset, edits, heroTextColor]
  );

  const suggestion = useMemo<HeroSuggestion | null>(
    () => (slotState ? evaluateHeroSlot(slotState) : null),
    [slotState]
  );

  /** Other images in the same sibling group as the current image.
   *  Empty when the current image has no group. Powers the SiblingsRail.
   *  For the API loader mode, siblings are filtered from the merchant's
   *  matched-set — this preserves the strict-match rule (a paver never
   *  sees the roofer variant of a cross-trade sibling group). */
  const siblings = useMemo<HeroImage[]>(() => {
    if (!image) return [];
    return useApi
      ? siblingsFromList(matchedImages, image.id)
      : siblingsForImage(image.id);
  }, [image, useApi, matchedImages]);

  const swapToImageId = useCallback((id: string) => {
    const found = heroImageById(id);
    if (found) {
      setImage(found);
      setEdits(DEFAULT_HERO_EDITS);
      setUploadUrl(null);
    }
  }, []);

  const swapToImage = useCallback((next: HeroImage) => {
    setImage(next);
    setEdits(DEFAULT_HERO_EDITS);
    setUploadUrl(null);
  }, []);

  const applyPreset = useCallback((next: HeroPreset) => {
    setPreset(next);
  }, []);

  const patchEdit = useCallback(<K extends keyof HeroEdits>(
    field: K,
    value: HeroEdits[K]
  ) => {
    setEdits((prev) => ({ ...prev, [field]: value }));
  }, []);

  const restoreOriginal = useCallback(() => {
    setEdits(DEFAULT_HERO_EDITS);
    setPreset("full_bleed");
    if (initialImage) setImage(initialImage);
  }, [initialImage]);

  const setUpload = useCallback((dataUrl: string | null) => {
    setUploadUrl(dataUrl);
    setUploadFocals(DEFAULT_FOCALS);
  }, []);

  const setUploadFocal = useCallback(
    (aspect: AspectRatio, focal: CropFocalPoint) => {
      setUploadFocals((prev) => ({ ...prev, [aspect]: focal }));
    },
    []
  );

  // ---- Persistence (auto-save with debounce) ----
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistCurrentSlot = useCallback(async () => {
    if (!options.slotKey || !image) return;
    setSaveState("saving");
    try {
      const res = await fetch("/api/hero-library/save-slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotKey: options.slotKey,
          imageId: image.id,
          preset,
          edits,
          uploadUrl,
          uploadFocals
        })
      });
      setSaveState(res.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  }, [options.slotKey, image, preset, edits, uploadUrl, uploadFocals]);

  // Debounced auto-save on any state change
  useEffect(() => {
    if (!options.slotKey || !image) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persistCurrentSlot();
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [options.slotKey, image, preset, edits, uploadUrl, uploadFocals, persistCurrentSlot]);

  /** Apply the whole sibling series to every configured site slot.
   *  Cycles through siblings in order — e.g. landing gets the current
   *  image, about gets sibling[0], services gets sibling[1], etc. */
  const applySeriesAcrossSite = useCallback(async () => {
    if (!image || !siblings.length || !options.siteSlotKeys?.length) return;
    const slots = options.siteSlotKeys;
    const chain = [image, ...siblings];
    const imageIdByKey: Record<string, string> = {};
    slots.forEach((slotKey, i) => {
      const chosen = chain[i % chain.length];
      imageIdByKey[slotKey] = chosen.id;
    });
    setSaveState("saving");
    try {
      const res = await fetch("/api/hero-library/save-slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applyAcrossSlots: slots,
          imageIdByKey,
          preset,
          edits
        })
      });
      setSaveState(res.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  }, [image, siblings, options.siteSlotKeys, preset, edits]);

  return {
    // library-matched images (only those legal for merchant's trade)
    matchedImages,
    // current state
    image,
    preset,
    edits,
    uploadUrl,
    slotState,
    // advisory
    suggestion,
    // sibling group
    siblings,
    // upload focals per aspect
    uploadFocals,
    // loader state (useful for showing "Loading" while API fetches)
    isLoadingLibrary,
    librarySource,
    // persistence
    saveState,
    // actions
    swapToImageId,
    swapToImage,
    applyPreset,
    patchEdit,
    restoreOriginal,
    setUpload,
    setUploadFocal,
    applySeriesAcrossSite
  };
}

export type UseHeroSwapReturn = ReturnType<typeof useHeroSwap>;
