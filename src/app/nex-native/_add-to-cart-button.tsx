"use client";

// src/app/nex-native/_add-to-cart-button.tsx
//
// Bridge 22 · Small "Add to cart" button that writes into
// localStorage. Reusable across the shop landing product cards,
// the product detail page, the menu page dish cards, and the
// menu-first shop landing.
//
// Deduplication: if an item with the same (shop_id, id, variants)
// already exists, we bump its quantity by qtyToAdd rather than
// creating a duplicate line.

import { useState } from "react";
import {
  NEX_CART_STORAGE_KEY,
  type NexCartItem,
} from "@/lib/nex-native/cart-types";

export interface AddToCartItemInit {
  kind: "product" | "menu_item";
  id: string;
  shop_id: string;
  shop_slug: string;
  shop_owner_account_id: string;
  shop_display_name: string;
  name: string;
  price_pence: number;
  currency: string;
  image_url: string | null;
  variants?: string[];
  qty?: number;
}

export function AddToCartButton({
  item,
  label = "Add to cart",
  tone = "primary",
  compact = false,
}: {
  item: AddToCartItemInit;
  label?: string;
  tone?: "primary" | "ghost" | "green";
  compact?: boolean;
}) {
  const [added, setAdded] = useState(false);

  function onClick() {
    try {
      const raw = window.localStorage.getItem(NEX_CART_STORAGE_KEY);
      const arr: NexCartItem[] = raw ? JSON.parse(raw) : [];
      const variants = item.variants ?? [];
      const qtyToAdd = item.qty ?? 1;
      const dedupeKey = `${item.shop_id}::${item.id}::${variants
        .slice()
        .sort()
        .join("|")}`;
      const existingIdx = arr.findIndex(
        (x) => x && `${x.shop_id}::${x.id}::${(x.variants ?? [])
          .slice()
          .sort()
          .join("|")}` === dedupeKey,
      );
      if (existingIdx >= 0) {
        arr[existingIdx] = {
          ...arr[existingIdx]!,
          quantity: (arr[existingIdx]!.quantity || 1) + qtyToAdd,
        };
      } else {
        arr.push({
          key:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${dedupeKey}::${Date.now()}`,
          kind: item.kind,
          id: item.id,
          shop_id: item.shop_id,
          shop_slug: item.shop_slug,
          shop_owner_account_id: item.shop_owner_account_id,
          shop_display_name: item.shop_display_name,
          name: item.name,
          price_pence: item.price_pence,
          currency: item.currency,
          image_url: item.image_url,
          quantity: qtyToAdd,
          variants,
          note: null,
          added_at: Date.now(),
        });
      }
      window.localStorage.setItem(NEX_CART_STORAGE_KEY, JSON.stringify(arr));
      window.dispatchEvent(new CustomEvent("nex-cart-changed"));
      setAdded(true);
      setTimeout(() => setAdded(false), 1400);
    } catch {
      // Silently swallow · localStorage may be disabled in private
      // browsing · UI just doesn't confirm.
    }
  }

  const isGreen = tone === "green" || added;
  const isPrimary = tone === "primary" && !added;
  const isGhost = tone === "ghost" && !added;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        padding: compact ? "6px 12px" : "10px 14px",
        borderRadius: compact ? 999 : 12,
        background: isGreen
          ? "linear-gradient(180deg, #22E37A 0%, #16D66B 100%)"
          : isPrimary
            ? "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)"
            : "rgba(0,175,255,0.14)",
        border: isGreen
          ? "1px solid rgba(22,214,107,0.55)"
          : isPrimary
            ? "1px solid rgba(255,114,0,0.6)"
            : "1px solid rgba(0,175,255,0.5)",
        color: isGreen ? "#0B0F1A" : isPrimary ? "#0B0F1A" : "#F4F7FC",
        fontSize: compact ? 10 : 12,
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: "pointer",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        boxShadow: isGreen
          ? "0 6px 14px rgba(22,214,107,0.35), inset 0 1px 0 rgba(255,255,255,0.28)"
          : isPrimary
            ? "0 6px 14px rgba(255,114,0,0.35), inset 0 1px 0 rgba(255,255,255,0.28)"
            : "none",
        transition: "background 160ms ease",
        // Keep the button under any full-card <a> overlays by making
        // it position: relative so it sits above via stacking.
        position: "relative",
        zIndex: 4,
      }}
    >
      {added ? "✓ Added" : label}
    </button>
  );
}
