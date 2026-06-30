"use client";

// Wholesale Mode — per-product free-delivery picker.
//
// The merchant nominates specific products from their catalogue that
// ship FREE within their stated wholesale zones when the customer orders
// at least `free_delivery_min_qty`. NULL = no free-delivery offer. Each
// row save calls /api/trade-off/products/upsert with the patch (same
// endpoint Shop Mode uses, so validation is centralised).
//
// On the public side, a yellow "FREE DELIVERY on X+" badge renders on the
// product card + PDP whenever this value is set, and the cart zeroes the
// order delivery cost when any qualifying line meets the threshold.

import { useState } from "react";
import type { HammerexXratedProduct } from "@/lib/supabase";

type RowState = {
  enabled: boolean;
  minQty: string;
  busy: boolean;
  err: string | null;
  msg: string | null;
  /** Last value that successfully persisted (or was loaded from the DB).
   *  Drives the green "Saved" Save-button state — when current
   *  enabled/minQty matches `savedValue`, the row is in-sync with the
   *  server and the button reads green. Any local edit pushes it back
   *  out-of-sync → yellow. */
  savedValue: number | null;
};

function initialRow(p: HammerexXratedProduct): RowState {
  const set = typeof p.free_delivery_min_qty === "number" && p.free_delivery_min_qty > 0;
  return {
    enabled: set,
    minQty: set ? String(p.free_delivery_min_qty) : "",
    busy: false,
    err: null,
    msg: null,
    savedValue: set ? (p.free_delivery_min_qty as number) : null
  };
}

export function WholesaleFreeDeliveryPicker({
  slug,
  editToken,
  initialProducts
}: {
  slug: string;
  editToken: string;
  initialProducts: HammerexXratedProduct[];
}) {
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const out: Record<string, RowState> = {};
    for (const p of initialProducts) out[p.id] = initialRow(p);
    return out;
  });

  function patch(id: string, p: Partial<RowState>) {
    setRows((s) => ({ ...s, [id]: { ...s[id], ...p } }));
  }

  async function save(product: HammerexXratedProduct) {
    const row = rows[product.id];
    if (!row) return;
    patch(product.id, { busy: true, err: null, msg: null });

    let nextValue: number | null = null;
    if (row.enabled) {
      const n = Number(row.minQty);
      if (!Number.isFinite(n) || n < 1) {
        patch(product.id, {
          busy: false,
          err: "Enter a minimum quantity of 1 or more."
        });
        return;
      }
      nextValue = Math.round(n);
    }

    try {
      const res = await fetch("/api/trade-off/products/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          product: {
            // Echo every field the upsert API requires so the row updates
            // cleanly — the API treats `id` as the PK and updates only.
            id: product.id,
            name: product.name,
            price_pence: product.price_pence,
            free_delivery_min_qty: nextValue
          }
        })
      });
      const json = await res.json();
      if (!json.ok) {
        patch(product.id, {
          busy: false,
          err: json.error ?? "Save failed — try again."
        });
        return;
      }
      patch(product.id, {
        busy: false,
        savedValue: nextValue,
        msg: nextValue === null
          ? "Free delivery removed from this product."
          : `Free delivery saved — unlocks at ${nextValue}+.`
      });
      setTimeout(() => patch(product.id, { msg: null }), 2400);
    } catch {
      patch(product.id, { busy: false, err: "Network error — try again." });
    }
  }

  if (initialProducts.length === 0) {
    return (
      <div className="rounded-xl border border-brand-line bg-brand-surface p-5">
        <h2 className="text-lg font-extrabold">Free delivery products</h2>
        <p className="mt-1 text-[12px] text-brand-muted">
          Pick the products you'll deliver free of charge inside your
          delivery zones, and set the minimum quantity that unlocks it.
          Each chosen product also gets a <span className="font-bold text-brand-text">Free Delivery</span> badge
          on its Trade Center listing — a killer conversion lever that
          takes minutes to set up.
        </p>
        <p className="mt-4 rounded-lg border border-brand-line bg-brand-bg px-3 py-2 text-[13px] text-brand-muted">
          You haven&rsquo;t added any products yet. Open Trade Center, add
          your catalogue, then come back here to pick which lines ship
          free.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-brand-line bg-brand-surface p-5">
      <div>
        <h2 className="text-lg font-extrabold">Free delivery products</h2>
        <p className="mt-1 text-[12px] text-brand-muted">
          Pick the products you&rsquo;ll deliver free of charge inside
          your delivery zones, and set the minimum quantity that unlocks
          it. Each chosen product also gets a{" "}
          <span className="font-bold text-brand-text">Free Delivery</span>{" "}
          badge on its Trade Center listing — a killer conversion lever
          that takes minutes to set up.
        </p>
      </div>

      <ul className="space-y-3">
        {initialProducts.map((product) => {
          const row = rows[product.id];
          if (!row) return null;
          return (
            <li
              key={product.id}
              className="overflow-hidden rounded-xl border border-brand-line bg-brand-bg p-4"
            >
              <div className="flex items-center gap-3">
                {product.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.cover_url}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-md border border-brand-line object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-brand-line bg-brand-surface text-[10px] font-bold uppercase text-brand-muted">
                    No image
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-extrabold text-brand-text">
                    {product.name}
                  </p>
                  <p className="text-[11px] text-brand-muted">
                    £{(product.price_pence / 100).toFixed(2)} each
                  </p>
                </div>
              </div>

              {/* Controls sit underneath on their own row so they always
               *  stay inside the card edges — no overflow on narrow
               *  containers. Save button is full-width on mobile, sits
               *  inline with the inputs on sm+. */}
              <div className="mt-3 grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                <label className="inline-flex h-11 items-center gap-2 rounded-md border border-brand-line bg-brand-surface px-3">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) =>
                      patch(product.id, { enabled: e.target.checked })
                    }
                    className="h-5 w-5 accent-brand-accent"
                  />
                  <span className="text-[13px] font-bold text-brand-text">
                    Free delivery
                  </span>
                </label>

                <label className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                    Min qty
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    disabled={!row.enabled}
                    value={row.minQty}
                    onChange={(e) =>
                      patch(product.id, { minQty: e.target.value })
                    }
                    placeholder="—"
                    className="block h-11 w-full min-w-0 rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent disabled:opacity-60"
                  />
                </label>

                {(() => {
                  // In-sync = current form state matches what's persisted.
                  // When in-sync AND the merchant has enabled free delivery
                  // with a positive min qty, the button reads green / "Saved
                  // ✓" so they have a clean confirmation. Any local edit
                  // (toggle off, change qty) flips it back to yellow / "Save".
                  const currentVal = row.enabled
                    ? (() => {
                        const n = Number(row.minQty);
                        return Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
                      })()
                    : null;
                  const inSync = currentVal === row.savedValue;
                  const saved = inSync && row.savedValue !== null && !row.busy;
                  return (
                    <button
                      type="button"
                      onClick={() => save(product)}
                      disabled={row.busy}
                      className="inline-flex h-11 items-center justify-center gap-1 rounded-lg px-4 text-[13px] font-bold transition hover:opacity-90 disabled:opacity-60"
                      style={
                        saved
                          ? { background: "#0F5132", color: "#FFFFFF" }
                          : { background: "#FFB300", color: "#0A0A0A" }
                      }
                    >
                      {row.busy ? "Saving…" : saved ? "Saved ✓" : "Save"}
                    </button>
                  );
                })()}
              </div>

              {(row.err || row.msg) && (
                <p
                  className={`mt-2 text-[11px] font-semibold ${
                    row.err ? "text-red-400" : "text-brand-accent"
                  }`}
                >
                  {row.err ?? row.msg}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
