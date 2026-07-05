// BeforeAfterSlider — drag-reveal image comparison.
//
// Reference: shadcn.io / shadcnspace — search `compare`.
// Rewritten in our token vocabulary; touch + mouse + keyboard.
//
// Mobile-native: 44×44 drag handle, arrow-key +/- 5% for keyboard.
// One of the highest-impact showcase primitives for visual trades
// (roofers · painters · kitchen fitters · landscapers · tilers).

"use client";

import { GripVertical } from "lucide-react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CARD_RADIUS } from "../tokens";

export type BeforeAfterSliderProps = {
  before: ReactNode;                  // image/video for "before"
  after: ReactNode;                   // image/video for "after"
  beforeLabel?: string;
  afterLabel?: string;
  /** Initial split 0-100. Default 60 (favours the after). */
  initial?: number;
  /** Ratio wrapper. Defaults to landscape. */
  aspect?: "landscape" | "portrait" | "square" | "video";
};

const ASPECT_CLASS = {
  landscape: "aspect-[4/3]",
  portrait: "aspect-[3/4]",
  square: "aspect-square",
  video: "aspect-video"
} as const;

export function BeforeAfterSlider({
  before,
  after,
  beforeLabel = "Before",
  afterLabel = "After",
  initial = 60,
  aspect = "landscape"
}: BeforeAfterSliderProps) {
  const [split, setSplit] = useState(initial);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplit(Math.max(0, Math.min(100, pct)));
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  };
  const onPointerUp = () => {
    draggingRef.current = false;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      setSplit((s) => Math.max(0, s - 5));
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      setSplit((s) => Math.min(100, s + 5));
      e.preventDefault();
    } else if (e.key === "Home") {
      setSplit(0);
      e.preventDefault();
    } else if (e.key === "End") {
      setSplit(100);
      e.preventDefault();
    }
  };

  useEffect(() => {
    // Global pointerup so the drag doesn't stick when the cursor
    // leaves the element mid-drag.
    const stop = () => {
      draggingRef.current = false;
    };
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${CARD_RADIUS} ${ASPECT_CLASS[aspect]} select-none bg-neutral-100`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* AFTER — full-width base layer */}
      <div className="absolute inset-0">{after}</div>

      {/* BEFORE — clipped from the right based on split */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
      >
        {before}
      </div>

      {/* Corner labels */}
      <span className="absolute left-2 top-2 rounded-full bg-neutral-900/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
        {beforeLabel}
      </span>
      <span className="absolute right-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-neutral-900">
        {afterLabel}
      </span>

      {/* Divider line */}
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90"
        style={{ left: `${split}%` }}
      />

      {/* Drag handle */}
      <div
        role="slider"
        aria-label="Before / after comparison"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(split)}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full bg-white text-neutral-900 shadow-[0_4px_16px_rgba(0,0,0,0.24)] focus:outline-none focus:ring-2 focus:ring-amber-400 active:cursor-grabbing"
        style={{ left: `${split}%` }}
      >
        <GripVertical className="h-5 w-5" />
      </div>
    </div>
  );
}
