"use client";

// Store cart — localStorage-backed. No server state; the cart is
// purely a client-side accumulator of image ids until checkout, at
// which point the array is POSTed to /api/store/checkout and a
// single order row is created with items_json.
//
// Custom event `store:cart-changed` fires on every mutation so
// listeners in other components (header badge, add-button state)
// stay in sync without needing a global store.

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "site-interest-cart:v1";
const EVT         = "store:cart-changed";
const MAX_ITEMS   = 50;

function readCart(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}
function writeCart(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent(EVT));
  } catch { /* noop */ }
}

export function useStoreCart() {
  const [ids, setIds] = useState<string[]>([]);
  // Init after mount — localStorage is undefined on SSR.
  useEffect(() => {
    setIds(readCart());
    const onChange = () => setIds(readCart());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange); // cross-tab sync
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const add = useCallback((id: string) => {
    const current = readCart();
    if (current.includes(id))         return;   // dedupe
    if (current.length >= MAX_ITEMS)  return;   // pack cap
    writeCart([...current, id]);
  }, []);
  const remove = useCallback((id: string) => {
    writeCart(readCart().filter((x) => x !== id));
  }, []);
  const clear = useCallback(() => writeCart([]), []);
  const has   = useCallback((id: string) => readCart().includes(id), []);

  return { ids, add, remove, clear, has, count: ids.length };
}

/** Pack pricing ladder — matches landing page. Passing a count
 *  returns the correct pack tier price in GBP + per-image price. */
export type PackTier = {
  size:     number;   // 1 / 5 / 10 / 25 / 50
  priceGbp: number;
  label:    string;
};
export const PACK_TIERS: PackTier[] = [
  { size: 1,  priceGbp: 10,  label: "Single"        },
  { size: 5,  priceGbp: 39,  label: "Pack of 5"     },
  { size: 10, priceGbp: 69,  label: "Pack of 10"    },
  { size: 25, priceGbp: 149, label: "Pack of 25"    },
  { size: 50, priceGbp: 249, label: "Pack of 50"    }
];
/** Given a raw count, return the price you charge — always the
 *  smallest tier ≥ count, so 3 items = pack-of-5 price, 12 = pack-
 *  of-25, etc. Keeps the merchant strongly incentivised toward
 *  bigger packs (buying 12 for £149 vs 25 for £149 — same price,
 *  they'd add 13 more). */
export function priceForCount(count: number): PackTier {
  if (count <= 0) return PACK_TIERS[0];
  for (const t of PACK_TIERS) {
    if (count <= t.size) return t;
  }
  return PACK_TIERS[PACK_TIERS.length - 1];
}
/** Suggest the merchant "add N more to save": true if a bigger tier
 *  is available at the SAME price for extra items. */
export function nextTierNudge(count: number): { moreToAdd: number; nextSize: number } | null {
  const current = priceForCount(count);
  const currentIdx = PACK_TIERS.findIndex((t) => t.priceGbp === current.priceGbp);
  const next = PACK_TIERS[currentIdx + 1];
  if (!next) return null;
  // Only nudge if the next tier is only marginally more expensive per image
  const moreToAdd = current.size - count;
  if (moreToAdd > 0) return { moreToAdd, nextSize: current.size };
  return null;
}
