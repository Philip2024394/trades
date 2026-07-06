// Before/After library loader — mirrors the pattern of hero-swap
// library. Static JSON + strict-match query.

import libraryJson from "../../../scripts/beforeafter-library.json";
import type { BeforeAfterLibraryEntry } from "./types";

type LibraryFileShape = {
  entries: BeforeAfterLibraryEntry[];
};

const LIBRARY = libraryJson as unknown as LibraryFileShape;

export function allBeforeAfterEntries(): BeforeAfterLibraryEntry[] {
  return LIBRARY.entries;
}

export function beforeAfterEntryById(
  id: string
): BeforeAfterLibraryEntry | undefined {
  return LIBRARY.entries.find((e) => e.id === id);
}

/** Strict-match query — same rule as hero library. Merchants only see
 *  before/after showcases whose keywords_strict intersects with their
 *  trade_keywords. Carpenter never sees roofer pairs and vice versa. */
export function matchBeforeAfterForMerchant(
  merchantTradeKeywords: string[]
): BeforeAfterLibraryEntry[] {
  if (!merchantTradeKeywords.length) return [];
  const normalised = new Set(
    merchantTradeKeywords.map((k) => k.toLowerCase().trim())
  );
  return LIBRARY.entries.filter((entry) =>
    entry.keywords_strict.some((k) =>
      normalised.has(k.toLowerCase().trim())
    )
  );
}
