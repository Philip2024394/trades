"use client";

// Lifted PDP quantity stepper.
//
// Previously the qty +/- controls lived INSIDE ProductPageAddToCart. They
// now live on the price row instead, so the buyer can dial in qty BEFORE
// scrolling past the price/stock signals. This component is the visible
// stepper; ProductPageAddToCart still owns the base/line-total math and
// the actual add-to-cart write.
//
// State sync model:
//   - localStorage key `xrated_pdp_qty:${productId}` is the source of
//     truth (scoped per product so navigating between PDPs doesn't bleed
//     a 10-pack qty into a different product).
//   - Whenever qty changes here, we write to localStorage AND dispatch a
//     CustomEvent("xrated:pdp-qty-change", { detail: { productId, qty } }).
//   - ProductPageAddToCart mounts the same hook and listens for the
//     event (filtered to its own productId) so both surfaces stay in
//     lockstep without prop-drilling.
//
// Visual: small inline-flex stepper, no card wrapper, 13px floor.

import { useEffect, useState } from "react";

export const QTY_STORAGE_KEY = "xrated_pdp_qty";
export const QTY_CHANGE_EVENT = "xrated:pdp-qty-change";

export type QtyChangeDetail = { productId: string; qty: number };

function storageKey(productId: string): string {
  return `${QTY_STORAGE_KEY}:${productId}`;
}

function clampQty(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(99, Math.floor(n)));
}

export function QtyStepper({ productId }: { productId: string }) {
  const [qty, setQty] = useState<number>(1);

  // Hydrate from localStorage on mount. Falls back to 1 if missing /
  // malformed. Also subscribes to the cross-component change event so a
  // qty change driven elsewhere (e.g. a future +/- in the cart drawer)
  // re-renders the stepper without a remount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(productId));
      if (raw !== null) {
        const parsed = clampQty(Number(raw));
        setQty(parsed);
      }
    } catch {
      /* localStorage may throw in private mode — fall back to default. */
    }
    function onChange(e: Event) {
      const detail = (e as CustomEvent<QtyChangeDetail>).detail;
      if (!detail || detail.productId !== productId) return;
      setQty(clampQty(detail.qty));
    }
    window.addEventListener(QTY_CHANGE_EVENT, onChange as EventListener);
    return () => {
      window.removeEventListener(QTY_CHANGE_EVENT, onChange as EventListener);
    };
  }, [productId]);

  function commit(next: number) {
    const clamped = clampQty(next);
    setQty(clamped);
    try {
      window.localStorage.setItem(storageKey(productId), String(clamped));
    } catch {
      /* ignore — local state still updates */
    }
    try {
      window.dispatchEvent(
        new CustomEvent<QtyChangeDetail>(QTY_CHANGE_EVENT, {
          detail: { productId, qty: clamped }
        })
      );
    } catch {
      /* ignore — older browsers without CustomEvent ctor */
    }
  }

  return (
    <div
      className="inline-flex items-center overflow-hidden rounded-lg border border-neutral-200 bg-white"
      role="group"
      aria-label="Quantity"
    >
      <button
        type="button"
        onClick={() => commit(qty - 1)}
        aria-label="Decrease quantity"
        disabled={qty <= 1}
        className="inline-flex h-9 w-9 items-center justify-center text-[13px] font-extrabold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40"
      >
        −
      </button>
      <span className="grid h-9 min-w-[2.5rem] place-items-center bg-white px-2 text-[13px] font-extrabold text-neutral-900">
        {qty}
      </span>
      <button
        type="button"
        onClick={() => commit(qty + 1)}
        aria-label="Increase quantity"
        disabled={qty >= 99}
        className="inline-flex h-9 w-9 items-center justify-center text-[13px] font-extrabold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
