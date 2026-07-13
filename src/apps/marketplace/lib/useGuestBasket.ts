// useGuestBasket — cart hook used by every marketplace surface.
//
// Guest visitors write to localStorage only. Signed-in users get the
// same interface but every mutation also syncs to
// /api/apps/marketplace/cart so the cart follows them across devices.
// The server row is authoritative once fetched; localStorage is the
// warm cache that survives page loads + offline windows.
//
// Merge-on-signup: drainGuestBasket() reads + clears the local store
// so the sign-up flow can POST /api/apps/marketplace/cart PUT to land
// pre-auth items on the newly-authed account.

"use client";

import { useEffect, useState } from "react";
import { useCurrentTrade } from "@/lib/useCurrentTrade";

export type GuestBasketItem = {
  productId: string;
  productSlug: string;
  productName: string;
  imageUrl?: string;
  qty: number;
  unit?: string;
  unitPriceGbp: number;
  merchantSlug: string;
  merchantName: string;
  addedAt: string;
};

const STORAGE_KEY = "tc.guest-basket";
const EVT = "tc:guest-basket-change";
const API = "/api/apps/marketplace/cart";

function readStore(): GuestBasketItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GuestBasketItem[]) : [];
  } catch {
    return [];
  }
}

function writeStore(items: GuestBasketItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVT));
}

/** Read + clear the localStorage cart. Called by the sign-up flow so
 *  the guest basket transfers to the newly-authed server cart via
 *  PUT /api/apps/marketplace/cart. */
export function drainGuestBasket(): GuestBasketItem[] {
  const items = readStore();
  writeStore([]);
  return items;
}

/** Fire-and-forget merge of the local guest basket into the server
 *  cart. Safe to call after any successful auth transition — the API
 *  is additive so no items are lost. */
export async function mergeGuestBasketToServer(): Promise<void> {
  const items = drainGuestBasket();
  if (items.length === 0) return;
  try {
    await fetch(API, {
      method:  "PUT",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify({ items })
    });
  } catch {
    // Server unreachable — put the items back in localStorage so a
    // future merge attempt can retry.
    writeStore(items);
  }
}

export function useGuestBasket() {
  const [items, setItems] = useState<GuestBasketItem[]>(() => readStore());
  const { trade } = useCurrentTrade();
  const authed = trade !== null;

  // Sync from server on mount + when auth changes. Server is
  // authoritative for authed users. Two edge cases prevent local
  // data-loss:
  //   1. Non-ok response (migration not applied, network error) —
  //      skip sync entirely, keep local intact.
  //   2. Ok response with empty server items but populated local —
  //      keep local. Happens in dev before the marketplace_cart
  //      table exists, or in the race between sign-up merge PUT
  //      and the useEffect mount. Overwriting local with empty
  //      wipes the user's cart.
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    fetch(API, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || json === null) return;
        const server = Array.isArray(json.items) ? (json.items as GuestBasketItem[]) : [];
        const local = readStore();
        if (server.length === 0 && local.length > 0) return;
        writeStore(server);
        setItems(server);
      })
      .catch(() => {
        /* keep local cache on network error */
      });
    return () => {
      cancelled = true;
    };
  }, [authed]);

  useEffect(() => {
    function sync() {
      setItems(readStore());
    }
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function add(item: Omit<GuestBasketItem, "addedAt">) {
    const now = new Date().toISOString();
    const next = [...readStore()];
    const existing = next.findIndex((i) => i.productId === item.productId);
    if (existing >= 0) {
      next[existing] = { ...next[existing], qty: next[existing].qty + item.qty };
    } else {
      next.push({ ...item, addedAt: now });
    }
    writeStore(next);
    if (authed) {
      fetch(API, {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify(item)
      }).catch(() => null);
    }
  }

  function remove(productId: string) {
    writeStore(readStore().filter((i) => i.productId !== productId));
    if (authed) {
      fetch(`${API}?productId=${encodeURIComponent(productId)}`, {
        method: "DELETE"
      }).catch(() => null);
    }
  }

  function clear() {
    writeStore([]);
    if (authed) {
      fetch(API, { method: "DELETE" }).catch(() => null);
    }
  }

  /** Clear a single merchant's slice — used by the merchant checkout
   *  page after a successful order. */
  function clearMerchant(merchantSlug: string) {
    writeStore(readStore().filter((i) => i.merchantSlug !== merchantSlug));
    if (authed) {
      fetch(`${API}?merchantSlug=${encodeURIComponent(merchantSlug)}`, {
        method: "DELETE"
      }).catch(() => null);
    }
  }

  function has(productId: string): boolean {
    return items.some((i) => i.productId === productId);
  }

  const count = items.reduce((n, i) => n + i.qty, 0);
  const totalGbp = items.reduce((n, i) => n + i.qty * i.unitPriceGbp, 0);

  return { items, add, remove, clear, clearMerchant, has, count, totalGbp };
}
