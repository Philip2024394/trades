// Loader + matcher for the hero library.
//
// The library JSON is authored at scripts/hero-library.json. This
// module imports it, exposes typed access, and provides the
// strict-match query used by the ChangeImageChip carousel.

import libraryJson from "../../../scripts/hero-library.json";
import type { HeroImage } from "./types";

type LibraryFileShape = {
  entries: HeroImage[];
};

const LIBRARY = libraryJson as unknown as LibraryFileShape;

/** All library entries. Do NOT expose to merchants directly — always
 *  route through matchImagesForMerchant so the strict-match rule
 *  is enforced. */
export function allHeroImages(): HeroImage[] {
  return LIBRARY.entries;
}

/** Look up a single image by id. */
export function heroImageById(id: string): HeroImage | undefined {
  return LIBRARY.entries.find((e) => e.id === id);
}

/** Strict-match query: return only images whose keywords_strict
 *  intersects with the merchant's trade_keywords. Case-insensitive.
 *  This is the enforcement point for the "carpenter doesn't see roofing"
 *  rule — merchants CAN'T bypass it because the platform never returns
 *  wrong-trade images to the UI. */
export function matchImagesForMerchant(
  merchantTradeKeywords: string[]
): HeroImage[] {
  if (!merchantTradeKeywords.length) return [];
  const normalised = new Set(
    merchantTradeKeywords.map((k) => k.toLowerCase().trim())
  );
  return LIBRARY.entries.filter((image) => {
    // Filter out entries that shouldn't be used as hero
    if (image.recommended_use !== "hero" && image.recommended_use !== "split-hero") {
      return false;
    }
    return image.keywords_strict.some((k) =>
      normalised.has(k.toLowerCase().trim())
    );
  });
}

/** Group matched images by sibling_group_id so the UI can offer
 *  "swap the whole series" for consistent brand across pages. */
export function groupBySibling(
  images: HeroImage[]
): Map<string | null, HeroImage[]> {
  const groups = new Map<string | null, HeroImage[]>();
  for (const image of images) {
    const key = image.sibling_group_id ?? null;
    const bucket = groups.get(key) ?? [];
    bucket.push(image);
    groups.set(key, bucket);
  }
  return groups;
}

/** Return all images in the same sibling group as `imageId`, EXCLUDING
 *  the image itself. Used to power the "use this series across your
 *  site" prompt. If the image has no sibling group, returns []. */
export function siblingsForImage(imageId: string): HeroImage[] {
  const image = heroImageById(imageId);
  if (!image?.sibling_group_id) return [];
  return LIBRARY.entries.filter(
    (e) =>
      e.sibling_group_id === image.sibling_group_id && e.id !== image.id
  );
}

/** Return ALL images in a sibling group (including the current). Useful
 *  for the "preview whole series" flyout. */
export function imagesInSiblingGroup(groupId: string): HeroImage[] {
  return LIBRARY.entries.filter((e) => e.sibling_group_id === groupId);
}
