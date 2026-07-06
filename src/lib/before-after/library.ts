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

/** Pure sibling lookup — takes a matched list + entryId and returns
 *  siblings within that list. Analogous to hero-swap's
 *  siblingsFromList. Preserves strict-match: a paver merchant only
 *  sees siblings that also matched their trade keywords, never leaks
 *  a roofer sibling into a paver's carousel. Returns [] if the entry
 *  has no sibling_group_id. */
export function siblingsFromBeforeAfterList(
  entries: BeforeAfterLibraryEntry[],
  entryId: string
): BeforeAfterLibraryEntry[] {
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return [];
  const groupId = (
    entry as BeforeAfterLibraryEntry & { sibling_group_id?: string }
  ).sibling_group_id;
  if (!groupId) return [];
  return entries.filter((e) => {
    const g = (
      e as BeforeAfterLibraryEntry & { sibling_group_id?: string }
    ).sibling_group_id;
    return g === groupId && e.id !== entry.id;
  });
}
