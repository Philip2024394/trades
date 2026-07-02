"use client";

// KeyCuttingAddToCart — per-category quantity stepper + Add-to-cart
// button + optional "key number / name" input.
//
// Uses the merchant's existing xratedCart (localStorage) so payment
// flows through whatever provider the merchant already configured
// (Stripe / PayPal / Square / Payment Link). Cart lines are tagged
// with the key category slug + optional note so the merchant sees
// what to cut when the order lands.

import { useState } from "react";
import { addItem } from "@/lib/xratedCart";

export function KeyCuttingAddToCart({
  slug,
  categorySlug,
  categoryLabel,
  pricePence
}: {
  slug: string;
  categorySlug: string;
  categoryLabel: string;
  pricePence: number;
}) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [added, setAdded] = useState(false);

   function add() {
    const nameSuffix = note.trim() ? ` (${note.trim().slice(0, 60)})` : "";
    addItem(slug, {
      // Composite key includes category slug + note so different notes
      // stay as distinct cart lines instead of silently merging into
      // one qty.
      product_id: `key_cutting__${categorySlug}`,
      variant_label: note.trim() ? note.trim().slice(0, 80) : null,
      name: `Key cut — ${categoryLabel}${nameSuffix}`,
      price_pence: pricePence,
      cover_url: null,
      qty: Math.max(1, Math.min(20, Math.floor(qty)))
    });
    // Fire-and-forget beacon so we can see which categories drive
    // add-to-cart. Uses sendBeacon so navigation isn't blocked.
    try {
      const payload = JSON.stringify({
        kind: "page",
        event_type: "cart_view",
        product_id: `key_cutting__${categorySlug}`,
        path: window.location.pathname
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
      }
    } catch {
      /* silent */
    }
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="mt-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <label className="block">
        <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
          Key number / name (optional)
        </span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Yale KB-51 — we'll cut what you type"
          maxLength={80}
          className="mt-1 h-9 w-full rounded-md border border-neutral-200 bg-white px-2 text-[12px] text-neutral-900 outline-none focus:border-[#FFB300]"
        />
      </label>
      <div className="mt-2 flex items-center gap-2">
        <div
          className="inline-flex items-center overflow-hidden rounded-md border border-neutral-200 bg-white"
          role="group"
          aria-label="Quantity"
        >
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="grid h-8 w-8 place-items-center text-[13px] font-extrabold text-neutral-700 hover:bg-neutral-50"
          >
            −
          </button>
          <span className="grid h-8 min-w-[2rem] place-items-center px-1 text-[13px] font-extrabold text-neutral-900">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(20, q + 1))}
            aria-label="Increase quantity"
            className="grid h-8 w-8 place-items-center text-[13px] font-extrabold text-neutral-700 hover:bg-neutral-50"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={add}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90 active:scale-[0.98]"
          style={{ background: "#FFB300" }}
          aria-label={added ? "Added to cart" : "Add to cart"}
        >
          {added ? (
            <>Added ✓</>
          ) : (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Add to cart
            </>
          )}
        </button>
      </div>
    </div>
  );
}
