// Client-side notebook items hook.
//
// Reads from /api/apps/notebook/items with a fixture fallback so the
// notebook is never blank in dev / pre-auth. Optimistic writes with
// a light localStorage cache mirror the quote-basket pattern.

"use client";

import { useEffect, useState } from "react";
import { DEMO_NOTEBOOK, type NotebookItem } from "../data/notebook";

type ServerRow = {
  id: string;
  product_name: string;
  spec: string | null;
  category_slug: string | null;
  usual_qty: number;
  unit: string;
  last_ordered_iso: string | null;
  image_url: string | null;
  last_quoted_at?: string | null;
  last_quoted_price_gbp?: number | string | null;
  last_quoted_merchant_slug?: string | null;
  last_quoted_merchant_name?: string | null;
};

export type NotebookItemHistory = {
  lastQuotedAt?: string;
  lastQuotedPriceGbp?: number;
  lastQuotedMerchantSlug?: string;
  lastQuotedMerchantName?: string;
};

const CACHE_KEY = "tc.notebook.items";
const EVT = "tc:notebook-items-change";
const API = "/api/apps/notebook/items";

function fromRow(r: ServerRow): NotebookItem & NotebookItemHistory {
  return {
    id:              r.id,
    productName:     r.product_name,
    spec:            r.spec ?? "",
    usualQty:        Number(r.usual_qty),
    unit:            r.unit,
    categorySlug:    r.category_slug ?? "materials",
    lastOrderedIso:  r.last_ordered_iso ?? undefined,
    lastQuotedAt:            r.last_quoted_at ?? undefined,
    lastQuotedPriceGbp:      r.last_quoted_price_gbp !== null && r.last_quoted_price_gbp !== undefined
      ? Number(r.last_quoted_price_gbp)
      : undefined,
    lastQuotedMerchantSlug:  r.last_quoted_merchant_slug ?? undefined,
    lastQuotedMerchantName:  r.last_quoted_merchant_name ?? undefined
  };
}

function writeCache(items: NotebookItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVT));
}

function readCache(): NotebookItem[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NotebookItem[];
  } catch {
    return null;
  }
}

export function useNotebookItems() {
  const [items, setItems] = useState<NotebookItem[]>(() => readCache() ?? DEMO_NOTEBOOK.items);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(API, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((json: { items?: ServerRow[] }) => {
        if (cancelled) return;
        const serverItems = (json.items ?? []).map(fromRow);
        if (serverItems.length === 0) {
          // Show fixtures so the UI is never empty in dev.
          setItems(DEMO_NOTEBOOK.items);
          setUsingFallback(true);
        } else {
          setItems(serverItems);
          setUsingFallback(false);
          writeCache(serverItems);
        }
      })
      .catch(() => {
        if (!cancelled) setUsingFallback(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    function refresh() {
      const cache = readCache();
      if (cache) setItems(cache);
    }
    window.addEventListener(EVT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(EVT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  async function add(input: {
    productName: string;
    spec?: string;
    categorySlug?: string;
    usualQty?: number;
    unit?: string;
    imageUrl?: string;
  }) {
    try {
      const res = await fetch(API, {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify(input)
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { item: ServerRow };
      const newItem = fromRow(json.item);
      const nextItems = usingFallback ? [newItem] : [newItem, ...items];
      setItems(nextItems);
      writeCache(nextItems);
      setUsingFallback(false);
      return newItem;
    } catch (err) {
      throw err;
    }
  }

  async function update(id: string, patch: Partial<NotebookItem>) {
    // Optimistic
    const optimistic = items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    setItems(optimistic);
    writeCache(optimistic);
    try {
      await fetch(`${API}/${encodeURIComponent(id)}`, {
        method:  "PATCH",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify(patch)
      });
    } catch {
      /* keep optimistic */
    }
  }

  async function remove(id: string) {
    const optimistic = items.filter((i) => i.id !== id);
    setItems(optimistic);
    writeCache(optimistic);
    try {
      await fetch(`${API}/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      /* keep optimistic */
    }
  }

  return { items, loading, usingFallback, add, update, remove };
}
