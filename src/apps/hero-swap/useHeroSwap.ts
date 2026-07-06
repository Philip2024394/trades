// useHeroSwap — merchant-facing state hook for the live "change image"
// flow. Owns the hero slot's current image, preset, edits, and text
// colour. Provides mutations that the sheet + edit controls call.

"use client";

import { useCallback, useMemo, useState } from "react";
import { evaluateHeroSlot } from "@/lib/hero-swap/suggestionEngine";
import {
  heroImageById,
  matchImagesForMerchant,
  siblingsForImage
} from "@/lib/hero-swap/library";
import {
  DEFAULT_HERO_EDITS
} from "@/lib/hero-swap/types";
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
};

export function useHeroSwap(options: UseHeroSwapOptions) {
  const matchedImages = useMemo(
    () => matchImagesForMerchant(options.merchantTradeKeywords),
    [options.merchantTradeKeywords]
  );

  const initialImage: HeroImage | null = useMemo(() => {
    if (options.initialImageId) {
      const found = heroImageById(options.initialImageId);
      if (found) return found;
    }
    return matchedImages[0] ?? null;
  }, [options.initialImageId, matchedImages]);

  const [image, setImage] = useState<HeroImage | null>(initialImage);
  const [preset, setPreset] = useState<HeroPreset>(
    options.initialPreset ?? "full_bleed"
  );
  const [edits, setEdits] = useState<HeroEdits>(DEFAULT_HERO_EDITS);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);

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
   *  Empty when the current image has no group. Powers the SiblingsRail. */
  const siblings = useMemo<HeroImage[]>(
    () => (image ? siblingsForImage(image.id) : []),
    [image]
  );

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
  }, []);

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
    // actions
    swapToImageId,
    swapToImage,
    applyPreset,
    patchEdit,
    restoreOriginal,
    setUpload
  };
}

export type UseHeroSwapReturn = ReturnType<typeof useHeroSwap>;
