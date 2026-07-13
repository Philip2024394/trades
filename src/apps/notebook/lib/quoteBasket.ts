// Shared quote-basket store — server-backed via /api/apps/notebook/basket.
//
// A localStorage cache mirrors the server rows so we can render
// optimistically and the UI stays snappy across cards. Every mutation
// fires the API, then re-hydrates the cache from the server response
// so state stays authoritative.

"use client";

import { useEffect, useState } from "react";

export type QuoteBasketItem = {
  itemId: string;                // maps to server `item_key`
  productName: string;
  spec: string;
  imageUrl?: string;
  qty: number;
  unit: string;
  merchantSlug: string;
  merchantName: string;
  productSlug: string;
  unitPriceGbp: number;
};

const CACHE_KEY = "tc.notebook.quote-basket";
const EVT = "tc:quote-basket-change";
const API_ROOT = "/api/apps/notebook/basket";

function readCache(): QuoteBasketItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as QuoteBasketItem[]) : [];
  } catch {
    return [];
  }
}

function writeCache(next: QuoteBasketItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVT));
}

type ServerRow = {
  item_key: string;
  product_name: string;
  spec: string | null;
  image_url: string | null;
  qty: number;
  unit: string;
  merchant_slug: string;
  merchant_name: string;
  product_slug: string;
  unit_price_gbp: number | string;
};

function fromRow(r: ServerRow): QuoteBasketItem {
  return {
    itemId:        r.item_key,
    productName:   r.product_name,
    spec:          r.spec ?? "",
    imageUrl:      r.image_url ?? undefined,
    qty:           Number(r.qty),
    unit:          r.unit,
    merchantSlug:  r.merchant_slug,
    merchantName:  r.merchant_name,
    productSlug:   r.product_slug,
    unitPriceGbp:  Number(r.unit_price_gbp)
  };
}

async function fetchServer(): Promise<QuoteBasketItem[]> {
  try {
    const res = await fetch(API_ROOT, { cache: "no-store" });
    if (!res.ok) return readCache();
    const json = (await res.json()) as { items?: ServerRow[] };
    return (json.items ?? []).map(fromRow);
  } catch {
    return readCache();
  }
}

export function useQuoteBasket() {
  const [items, setItems] = useState<QuoteBasketItem[]>(() => readCache());

  useEffect(() => {
    let cancelled = false;
    fetchServer().then((server) => {
      if (cancelled) return;
      writeCache(server);
      setItems(server);
    });

    function refresh() {
      setItems(readCache());
    }
    window.addEventListener(EVT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(EVT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  async function add(item: QuoteBasketItem) {
    // Optimistic cache write
    const optimistic = readCache().filter((i) => i.itemId !== item.itemId);
    optimistic.push(item);
    writeCache(optimistic);

    try {
      const res = await fetch(API_ROOT, {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({
          itemKey:      item.itemId,
          productName:  item.productName,
          spec:         item.spec,
          imageUrl:     item.imageUrl,
          qty:          item.qty,
          unit:         item.unit,
          merchantSlug: item.merchantSlug,
          merchantName: item.merchantName,
          productSlug:  item.productSlug,
          unitPriceGbp: item.unitPriceGbp
        })
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      // Server errored — keep optimistic cache so UI works offline.
    }
    const fresh = await fetchServer();
    writeCache(fresh);
  }

  async function setQty(itemId: string, qty: number) {
    const next = Math.max(1, qty);
    // Optimistic
    const cache = readCache().map((i) => (i.itemId === itemId ? { ...i, qty: next } : i));
    writeCache(cache);
    try {
      await fetch(`${API_ROOT}/${encodeURIComponent(itemId)}`, {
        method:  "PATCH",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ qty: next })
      });
    } catch {
      /* keep optimistic */
    }
  }

  async function remove(itemId: string) {
    // Optimistic
    writeCache(readCache().filter((i) => i.itemId !== itemId));
    try {
      await fetch(`${API_ROOT}/${encodeURIComponent(itemId)}`, { method: "DELETE" });
    } catch {
      /* keep optimistic */
    }
  }

  async function clear() {
    writeCache([]);
    // Server-side clear happens on quote submit. Standalone clear is
    // a per-item delete loop — cheap enough given basket sizes.
    const ids = readCache().map((i) => i.itemId);
    await Promise.all(
      ids.map((id) =>
        fetch(`${API_ROOT}/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {})
      )
    );
  }

  return {
    items,
    count:    items.length,
    totalGbp: items.reduce((s, i) => s + i.qty * i.unitPriceGbp, 0),
    has:      (itemId: string) => items.some((i) => i.itemId === itemId),
    add,
    setQty,
    remove,
    clear
  };
}
