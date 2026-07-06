// Hero Swap — public exports for the merchant hero-swap feature.
//
// Consumers embed <HeroSwapSlot ... /> anywhere they need a swappable
// merchant hero. The hook can also be used directly if a bespoke
// layout is needed.

export { HeroSwapSlot } from "./HeroSwapSlot";
export type { HeroSwapSlotProps } from "./HeroSwapSlot";
export { useHeroSwap } from "./useHeroSwap";
export type { UseHeroSwapOptions, UseHeroSwapReturn } from "./useHeroSwap";
export { HeroPreview } from "./shared/HeroPreview";
export { HeroSwapSheet } from "./shared/HeroSwapSheet";
export { ChangeImageChip } from "./shared/ChangeImageChip";

// Re-export the library helpers for advanced usage
export {
  matchImagesForMerchant,
  heroImageById,
  allHeroImages,
  groupBySibling
} from "@/lib/hero-swap/library";
export type {
  HeroImage,
  HeroPreset,
  HeroEdits,
  HeroSlotState,
  HeroSuggestion,
  HeroImagePalette
} from "@/lib/hero-swap/types";
