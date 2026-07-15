"use client";

// Before/After showcase card for Site Interest.
//
// Two rendering modes, chosen from the entry's `mode` field:
//
//   • composite — one image with before + after already merged.
//                 Card displays the full composite, with corner
//                 labels on each half + a "wipe" slider that
//                 crops the frame to reveal MORE of before or
//                 MORE of after (drag horizontal for a
//                 vertical-composite reveal).
//
//   • dual      — two separate image URLs. Renders the classic
//                 side-by-side reveal: `after_url` on top,
//                 `before_url` layered underneath, and a
//                 draggable vertical divider that reveals more
//                 of one at the expense of the other.
//
// Both modes use pointer events (works on mouse + touch + pen)
// and stop drag at 0-100% clamped.

import { useCallback, useEffect, useRef, useState } from "react";
import type { BeforeAfterEntry } from "@/lib/beforeAfterLibrary";
import { watermarkImageUrl } from "@/lib/imageWatermark";
import { ShareButton } from "./ShareButton";

const CREAM = "#FBF6EC";
const BRAND_BLACK = "#0A0A0A";
const BRAND_YELLOW = "#FFB300";

export function BeforeAfterCard({
  entry,
  shareUrl,
  actionSlot
}: {
  entry: BeforeAfterEntry;
  /** Absolute URL used by the Share button. */
  shareUrl: string;
  /** Optional slot rendered under the caption — used by the search
   *  page to inject the "I like it, how much?" quote button so the
   *  same lead-capture path fires from Transformations cards too. */
  actionSlot?: React.ReactNode;
}) {
  return (
    <figure
      className="mb-3 overflow-hidden rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="relative">
        {entry.mode === "dual"
          ? <DualSlider entry={entry}/>
          : <CompositeSlider entry={entry}/>}
        <div className="absolute right-2 top-2">
          <ShareButton
            shareUrl={shareUrl}
            shareText={`${entry.subject.split(",")[0]} · Thenetworkers`}
          />
        </div>
        {/* Transformation stamp — reads as "this is a wow", not just
            another photo. Only shown once per card, top-left. */}
        <span
          className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] shadow-md"
          style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
        >
          Transformation
        </span>
      </div>
      <figcaption className="p-2.5">
        <p className="line-clamp-2 text-[11.5px] leading-snug text-neutral-700">
          {entry.subject}
        </p>
        {actionSlot}
      </figcaption>
    </figure>
  );
}

// ─── Composite (one merged image) ──────────────────────────────
//
// Interaction model: the composite already SHOWS both halves at
// once. To create the "wow" reveal, we render two clipped copies
// of the same image, one showing only the BEFORE half, one showing
// only the AFTER half, split by a draggable divider. Dragging the
// divider grows one half at the expense of the other so the user
// can zoom fully into either state.
//
// Vertical composite (top=before, bottom=after): divider is
// horizontal, drag up/down.
// Horizontal composite (left=before, right=after): divider is
// vertical, drag left/right.

function CompositeSlider({ entry }: { entry: BeforeAfterEntry }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState(entry.composite_split ?? 50); // percent from start (top / left) of BEFORE side
  const [dragging, setDragging] = useState(false);
  const isVertical = entry.orientation === "vertical";
  const src = watermarkImageUrl(entry.image_url ?? "");

  const updateFromPointer = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const raw = isVertical
      ? ((clientY - rect.top) / rect.height) * 100
      : ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(5, Math.min(95, raw)));
  }, [isVertical]);

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: PointerEvent) { updateFromPointer(e.clientX, e.clientY); }
    function onUp() { setDragging(false); }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, updateFromPointer]);

  const beforeLabel = entry.before_label ?? "Before";
  const afterLabel = entry.after_label ?? "After";

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/5] w-full select-none overflow-hidden"
      style={{ backgroundColor: CREAM, userSelect: "none", touchAction: "none" }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        setDragging(true);
        updateFromPointer(e.clientX, e.clientY);
      }}
    >
      {/* Full composite image — always visible. Clipped copies on
          top of it grow/shrink to give the reveal effect. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={entry.subject}
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{ userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
      />

      {/* Corner labels */}
      <span
        className={`pointer-events-none absolute rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] shadow-md ${
          isVertical ? "left-1/2 top-3 -translate-x-1/2" : "left-3 top-1/2 -translate-y-1/2"
        }`}
        style={{ backgroundColor: "rgba(0,0,0,0.75)", color: "#FFFFFF" }}
      >
        {beforeLabel}
      </span>
      <span
        className={`pointer-events-none absolute rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] shadow-md ${
          isVertical ? "bottom-3 left-1/2 -translate-x-1/2" : "right-3 top-1/2 -translate-y-1/2"
        }`}
        style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
      >
        {afterLabel}
      </span>

      {/* Drag divider — line + circular handle. The line runs across
          the frame; the handle sits at midway on the OPPOSITE axis
          so thumb-drag is comfortable. */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          ...(isVertical
            ? { left: 0, right: 0, top: `${pos}%`, height: "2px" }
            : { top: 0, bottom: 0, left: `${pos}%`, width: "2px" }),
          backgroundColor: BRAND_YELLOW,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.35)"
        }}
      />
      <div
        aria-label="Drag to reveal"
        className="absolute flex h-9 w-9 items-center justify-center rounded-full text-white shadow-lg"
        style={{
          ...(isVertical
            ? { top: `${pos}%`, left: "50%", transform: "translate(-50%, -50%)" }
            : { left: `${pos}%`, top: "50%", transform: "translate(-50%, -50%)" }),
          backgroundColor: BRAND_BLACK,
          border: `2px solid ${BRAND_YELLOW}`,
          cursor: isVertical ? "ns-resize" : "ew-resize",
          touchAction: "none"
        }}
      >
        {isVertical ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 6l4-4 4 4M4 10l4 4 4-4" stroke={BRAND_YELLOW} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 4l-4 4 4 4M10 4l4 4-4 4" stroke={BRAND_YELLOW} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
    </div>
  );
}

// ─── Dual (two separate images) ────────────────────────────────
//
// Classic before/after slider. `after_url` layered on top, clipped
// by inset-clip to reveal the `before_url` underneath as the
// divider moves. Divider is vertical (drag left/right) regardless
// of the entry's orientation field — the metadata orientation
// refers to how the compositor SHOT the transformation, not the
// interaction.

function DualSlider({ entry }: { entry: BeforeAfterEntry }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const beforeSrc = watermarkImageUrl(entry.before_url ?? "");
  const afterSrc  = watermarkImageUrl(entry.after_url ?? "");

  const updateFromPointer = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: PointerEvent) { updateFromPointer(e.clientX); }
    function onUp() { setDragging(false); }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, updateFromPointer]);

  const beforeLabel = entry.before_label ?? "Before";
  const afterLabel = entry.after_label ?? "After";

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/5] w-full select-none overflow-hidden"
      style={{ backgroundColor: CREAM, userSelect: "none", touchAction: "none" }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        setDragging(true);
        updateFromPointer(e.clientX);
      }}
    >
      {/* Before base — always fully drawn underneath. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={beforeSrc}
        alt={`${beforeLabel} — ${entry.subject}`}
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{ userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
      />
      {/* After layer — clipped from the LEFT edge to `pos%`. Wider
          the clip, more After shown; drag left = shrink clip = more
          Before revealed. */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={afterSrc}
          alt={`${afterLabel} — ${entry.subject}`}
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          className="pointer-events-none h-full w-full object-cover"
          style={{ userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
        />
      </div>

      {/* Labels */}
      <span
        className="pointer-events-none absolute left-3 top-3 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] shadow-md"
        style={{ backgroundColor: "rgba(0,0,0,0.75)", color: "#FFFFFF" }}
      >
        {beforeLabel}
      </span>
      <span
        className="pointer-events-none absolute right-3 top-3 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] shadow-md"
        style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
      >
        {afterLabel}
      </span>

      {/* Divider + handle */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 bottom-0"
        style={{ left: `${pos}%`, width: "2px", backgroundColor: BRAND_YELLOW, boxShadow: "0 0 0 1px rgba(0,0,0,0.35)" }}
      />
      <div
        aria-label="Drag to compare"
        className="absolute flex h-9 w-9 items-center justify-center rounded-full text-white shadow-lg"
        style={{
          left: `${pos}%`,
          top: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: BRAND_BLACK,
          border: `2px solid ${BRAND_YELLOW}`,
          cursor: "ew-resize",
          touchAction: "none"
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M6 4l-4 4 4 4M10 4l4 4-4 4" stroke={BRAND_YELLOW} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}
