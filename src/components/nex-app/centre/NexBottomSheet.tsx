"use client";

// NexBottomSheet — the ONE reusable bottom sheet primitive.
//
// Per Philip's architecture direction (2026-07-27):
//   "Don't build multiple pages. Build one reusable NEX Bottom Sheet
//   component. Everything opens with it: Product Details · Merchant
//   Profile · Image Gallery · Customer Reviews · Other Products ·
//   Contact Options · Project Gallery. One component. Many uses.
//   That's exactly how modern apps like Airbnb, Uber, Apple Maps and
//   Google Maps feel."
//
// Behaviour:
//   - Slides up from the bottom with a rounded top corner
//   - Tap the backdrop or drag the handle down to dismiss
//   - Escape key closes the top-most sheet
//   - Supports STACKING: opening another sheet on top layers it above,
//     the underlying sheet stays mounted (state preserved)
//   - Locks body scroll when open
//   - Content is arbitrary React children — the sheet does no layout
//     inside itself beyond the header + scroll region

import { useEffect } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Small pill label at the top so the user always knows what surface
   *  they are looking at (e.g. "Product" / "Merchant" / "Gallery"). */
  eyebrow?: string;
  /** Optional right-side action (e.g. Share button). */
  headerRight?: React.ReactNode;
  /** Higher z-index than the previous sheet if this is a stacked open. */
  zIndex?: number;
  children: React.ReactNode;
};

export function NexBottomSheet({
  open,
  onClose,
  eyebrow,
  headerRight,
  zIndex = 50,
  children,
}: Props) {
  // Lock body scroll while open (only apply once; nested sheets share
  // the same lock)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0" style={{ zIndex }}>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-black/40 transition-opacity"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-3xl bg-white shadow-2xl"
      >
        {/* Grab handle */}
        <div className="flex items-center justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-black/15" />
        </div>

        {/* Header row */}
        <div className="flex items-center gap-2 px-4 pt-1 pb-3">
          {eyebrow && (
            <div className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black/60">
              {eyebrow}
            </div>
          )}
          <div className="flex-1" />
          {headerRight}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-black/50 hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content region */}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
