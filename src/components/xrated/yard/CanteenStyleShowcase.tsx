"use client";

// CanteenStyleShowcase — Tinder-style full-screen swipe view for the
// Trending Kitchen Style tiles (and any future style-showcase trending
// grids). Distinct from CanteenTrendingSwipeSheet — that one browses
// PRODUCTS matching a category; this one browses the STYLES themselves
// as portfolio credibility content with an Enquire Now WhatsApp CTA.
//
// Interaction:
//   - Tap a tile → sheet opens on that style
//   - Swipe left/right (touch) OR ← → arrow keys → previous / next style
//   - Tap dots at the bottom → jump to that style
//   - Tap X (top-right) or backdrop → close
//
// Price display rules:
//   - both priceFromGbp + priceToGbp set → "£X,XXX – £Y,YYY"
//   - only priceFromGbp set → "from £X,XXX"
//   - neither set → no price line (enquire-only style)

import { useState, useEffect, useCallback, useRef } from "react";
import { X, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { VerifiedContactButton } from "@/components/xrated/VerifiedContactButton";

const TAN = "#B8860B";

export type StyleShowcaseItem = {
  slug: string;
  label: string;
  imageUrl: string;
  description?: string;
  priceFromGbp?: number;
  priceToGbp?: number;
};

function formatPriceRange(from?: number, to?: number): string | null {
  if (!from && !to) return null;
  const fmt = (n: number) => `£${n.toLocaleString("en-GB")}`;
  if (from && to) return `${fmt(from)} – ${fmt(to)}`;
  if (from) return `from ${fmt(from)}`;
  if (to) return `up to ${fmt(to)}`;
  return null;
}

export function CanteenStyleShowcase({
  open,
  onClose,
  items,
  initialIndex = 0,
  categoryLabel,
  hostSlug,
  hostFirstName,
  hostDisplayName,
  hostWhatsapp,
  tradeLabel,
  hostCity,
  canteenSlug
}: {
  open: boolean;
  onClose: () => void;
  items: StyleShowcaseItem[];
  initialIndex?: number;
  /** Header label, e.g. "Trending Kitchen Style". */
  categoryLabel: string;
  hostSlug: string;
  hostFirstName: string;
  hostDisplayName: string;
  hostWhatsapp: string | null;
  tradeLabel: string;
  hostCity?: string | null;
  canteenSlug?: string;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Reset index when the sheet re-opens from a different tile.
  useEffect(() => {
    if (open) setIdx(initialIndex);
  }, [open, initialIndex]);

  // Body-scroll lock while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const total = items.length;
  const goto = useCallback((next: number) => {
    if (total === 0) return;
    setIdx(((next % total) + total) % total);
  }, [total]);

  // Keyboard navigation — ← / →  arrows advance styles.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goto(idx - 1);
      else if (e.key === "ArrowRight") goto(idx + 1);
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, idx, goto, onClose]);

  if (!open || total === 0) return null;

  const active = items[idx];
  const priceLabel = formatPriceRange(active.priceFromGbp, active.priceToGbp);

  // WhatsApp Enquire-Now now routes through VerifiedContactButton
  // which collects verified customer details + burns a washer on send.
  // Prev inline wa.me deep-link removed.

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${categoryLabel} — ${active.label}`}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/85 backdrop-blur-sm md:items-center"
      onClick={(e) => {
        // Close if backdrop (not inner content) is clicked.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-neutral-950 md:h-[90vh] md:rounded-2xl"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
          touchStartY.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          const startX = touchStartX.current;
          const startY = touchStartY.current;
          if (startX === null || startY === null) return;
          const endX = e.changedTouches[0].clientX;
          const endY = e.changedTouches[0].clientY;
          const dx = endX - startX;
          const dy = endY - startY;
          touchStartX.current = null;
          touchStartY.current = null;
          // Only treat as swipe if horizontal displacement dominates
          // AND the swipe is meaningful (>50px). Prevents accidental
          // triggers when the user is trying to scroll the sheet.
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) goto(idx + 1);   // swipe left → next
            else goto(idx - 1);           // swipe right → prev
          }
        }}
      >
        {/* Category label — top-left, curved-corner + notch safe. */}
        <div
          className="absolute z-20 rounded-full bg-black/40 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white backdrop-blur"
          style={{
            top:  "max(16px, env(safe-area-inset-top, 0))",
            left: "max(16px, env(safe-area-inset-left, 0))"
          }}
        >
          {categoryLabel}
        </div>

        {/* Close X — top-right, yellow to match the yellow prev/next
            chevrons. 44×44 WCAG hit-area; corner-safe via env() +
            16px fallback so curved iPhone corners can't clip it. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute z-20 flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition hover:brightness-110 active:scale-95"
          style={{
            backgroundColor: "#FFB300",
            color: "#0A0A0A",
            top:   "max(16px, env(safe-area-inset-top, 0))",
            right: "max(16px, env(safe-area-inset-right, 0))"
          }}
        >
          <X size={20} strokeWidth={2.6}/>
        </button>

        {/* Image — full-bleed, contain to preserve the whole style photo */}
        <div className="relative flex-1 overflow-hidden bg-neutral-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.imageUrl}
            alt={`${active.label} kitchen style`}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Dark gradient at the bottom for text legibility */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(180deg, transparent 0%, transparent 55%, rgba(0,0,0,0.85) 100%)" }}
          />

          {/* Prev / Next chevrons — desktop UX. Mobile relies on swipe.
              Yellow (BRAND_YELLOW #FFB300) with black icon reads as the
              active nav affordance while the surrounding image
              dominates. Shadow gives lift over darker photos. */}
          <button
            type="button"
            onClick={() => goto(idx - 1)}
            aria-label="Previous style"
            className="absolute left-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full shadow-lg transition hover:-translate-y-1/2 hover:brightness-110 active:scale-95 md:flex"
            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
          >
            <ChevronLeft size={20} strokeWidth={2.6}/>
          </button>
          <button
            type="button"
            onClick={() => goto(idx + 1)}
            aria-label="Next style"
            className="absolute right-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full shadow-lg transition hover:-translate-y-1/2 hover:brightness-110 active:scale-95 md:flex"
            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
          >
            <ChevronRight size={20} strokeWidth={2.6}/>
          </button>

          {/* Dot indicator — bottom-centre inside the image area */}
          <div className="absolute inset-x-0 bottom-4 z-10 flex items-center justify-center gap-1.5">
            {items.map((s, i) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => goto(i)}
                aria-label={`Go to ${s.label}`}
                className={`h-1.5 rounded-full transition ${i === idx ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
              />
            ))}
          </div>
        </div>

        {/* Info card — style label, description, price, Enquire Now.
            Bottom padding respects the home-indicator safe area so the
            Enquire button isn't overlapped on notched phones. */}
        <div
          className="relative z-10 flex-shrink-0 bg-neutral-950 px-4 pt-5 text-white"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 0))" }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[20px] font-black leading-tight">
              {active.label}
            </h3>
            {priceLabel && (
              <span
                className="flex-shrink-0 rounded-md px-2.5 py-1 text-[13px] font-black"
                style={{ backgroundColor: TAN, color: "#0A0A0A" }}
              >
                {priceLabel}
              </span>
            )}
          </div>
          {active.description && (
            <p className="mt-2 text-[13px] leading-relaxed text-white/85 line-clamp-3">
              {active.description}
            </p>
          )}
          <div className="mt-4 flex items-center gap-2">
            {hostWhatsapp ? (
              <VerifiedContactButton
                merchantSlug={hostSlug}
                merchantDisplayName={hostDisplayName}
                merchantFirstName={hostFirstName}
                merchantWhatsapp={hostWhatsapp}
                tradeLabel={tradeLabel}
                city={hostCity}
                source="canteen-hero"
                sourceLabel={`${hostFirstName}'s ${active.label} kitchen style on Thenetworkers.app`}
                canteenSlug={canteenSlug}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-black uppercase tracking-wider text-white shadow-md transition hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.97]"
                style={{ backgroundColor: "#166534" }}
              >
                <MessageCircle size={15} strokeWidth={2.6}/>
                Enquire Now
              </VerifiedContactButton>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-700 px-4 text-[13px] font-black uppercase tracking-wider text-white/60"
              >
                Contact unavailable
              </button>
            )}
          </div>
          <div className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
            {idx + 1} / {total} · swipe or tap to browse
          </div>
        </div>
      </div>
    </div>
  );
}
