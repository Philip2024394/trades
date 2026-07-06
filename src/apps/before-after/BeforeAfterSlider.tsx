// BeforeAfterSlider — the interactive comparison slider. Designed to
// beat every trade-website competitor on 3 things:
//
//   1. Mobile-first drag: pointer events work identically on touch +
//      mouse. Most competitors are janky on touch.
//   2. Keyboard-accessible: arrow keys move the divider in 1% steps,
//      Shift+arrow in 10% steps.
//   3. Snap-to-compare: divider softly snaps to 25/50/75% so users
//      hit the common comparison points without fiddling.
//
// Handles both modes:
//   - dual: two separate URLs. Standard clip-path reveals more of
//           the after image as the divider moves.
//   - composite: one URL with before/after merged. The whole image
//           is always visible; the divider is a "focus guide" — a
//           thin line + handle the user can drag to draw attention
//           to a specific comparison point. Also carries the label
//           chips that mark which side is which.

"use client";

import { GripVertical, GripHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BeforeAfterPair } from "@/lib/before-after/types";

export type BeforeAfterSliderProps = {
  pair: BeforeAfterPair;
  /** Initial divider position in %. Defaults to 50. */
  initial?: number;
  /** Optional callback for analytics or persist-on-move. */
  onPositionChange?: (percent: number) => void;
  className?: string;
};

const SNAP_POINTS = [25, 50, 75];
const SNAP_THRESHOLD = 2;

function maybeSnap(pos: number): number {
  for (const snap of SNAP_POINTS) {
    if (Math.abs(pos - snap) < SNAP_THRESHOLD) return snap;
  }
  return pos;
}

export function BeforeAfterSlider({
  pair,
  initial = 50,
  onPositionChange,
  className = ""
}: BeforeAfterSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<number>(initial);
  const [dragging, setDragging] = useState(false);

  const isVertical = pair.orientation === "vertical";
  const isDual = pair.mode === "dual";

  const updateFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const raw = isVertical
        ? ((clientY - rect.top) / rect.height) * 100
        : ((clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(0, Math.min(100, raw));
      const snapped = maybeSnap(clamped);
      setPosition(snapped);
      onPositionChange?.(snapped);
    },
    [isVertical, onPositionChange]
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      updateFromClient(e.clientX, e.clientY);
    };
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, updateFromClient]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    if (
      isVertical
        ? e.key === "ArrowUp"
        : e.key === "ArrowLeft"
    ) {
      e.preventDefault();
      setPosition((p) => Math.max(0, p - step));
    }
    if (
      isVertical
        ? e.key === "ArrowDown"
        : e.key === "ArrowRight"
    ) {
      e.preventDefault();
      setPosition((p) => Math.min(100, p + step));
    }
  };

  // Clip-path for the after image in dual mode
  const afterClip = isVertical
    ? `inset(${position}% 0 0 0)`
    : `inset(0 0 0 ${position}%)`;

  // Divider positioning
  const dividerStyle: React.CSSProperties = isVertical
    ? { top: `${position}%`, left: 0, right: 0, height: 2 }
    : { left: `${position}%`, top: 0, bottom: 0, width: 2 };

  const handleStyle: React.CSSProperties = isVertical
    ? { top: `${position}%`, left: "50%", transform: "translate(-50%, -50%)" }
    : { left: `${position}%`, top: "50%", transform: "translate(-50%, -50%)" };

  const HandleIcon = isVertical ? GripHorizontal : GripVertical;

  const aspectClass = isVertical ? "aspect-[4/5]" : "aspect-[16/9]";

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label="Before / After comparison slider"
      aria-orientation={isVertical ? "vertical" : "horizontal"}
      aria-valuenow={Math.round(position)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        setDragging(true);
        updateFromClient(e.clientX, e.clientY);
      }}
      className={`relative select-none overflow-hidden rounded-2xl bg-neutral-100 shadow-inner focus-visible:ring-4 focus-visible:ring-blue-300 ${aspectClass} ${className}`}
      style={{ touchAction: "none", cursor: isVertical ? "row-resize" : "col-resize" }}
    >
      {/* Base image — always fully visible.
          - Composite mode: this IS the whole before+after image.
          - Dual mode: this is the BEFORE image. */}
      <img
        src={pair.before_url}
        alt={pair.before_label ?? "Before"}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />

      {/* Dual mode: after image layered on top, clipped by divider */}
      {isDual && pair.after_url ? (
        <img
          src={pair.after_url}
          alt={pair.after_label ?? "After"}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: afterClip }}
          draggable={false}
        />
      ) : null}

      {/* Label chips — pinned to their respective sides */}
      <div
        className="pointer-events-none absolute inline-flex items-center rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-md"
        style={
          isVertical
            ? { top: 12, left: 12 }
            : { top: 12, left: 12 }
        }
      >
        {pair.before_label ?? "Before"}
      </div>
      <div
        className="pointer-events-none absolute inline-flex items-center rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-md"
        style={
          isVertical
            ? { bottom: 12, right: 12 }
            : { top: 12, right: 12 }
        }
      >
        {pair.after_label ?? "After"}
      </div>

      {/* Divider line */}
      <div
        aria-hidden
        className="pointer-events-none absolute bg-white shadow-md"
        style={dividerStyle}
      />

      {/* Draggable handle */}
      <div
        aria-hidden
        className="absolute flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg ring-2 ring-black/10 transition-transform"
        style={{
          ...handleStyle,
          transform: `${handleStyle.transform} scale(${dragging ? 1.1 : 1})`
        }}
      >
        <HandleIcon className="h-5 w-5 text-neutral-700" />
      </div>

      {/* Percentage indicator — appears while dragging */}
      {dragging ? (
        <div
          className="pointer-events-none absolute rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-semibold text-white shadow-md"
          style={
            isVertical
              ? {
                  top: `${position}%`,
                  right: 12,
                  transform: "translateY(-50%)"
                }
              : {
                  left: `${position}%`,
                  bottom: 12,
                  transform: "translateX(-50%)"
                }
          }
        >
          {Math.round(position)}%
        </div>
      ) : null}

      {/* Caption below the frame */}
      {pair.caption ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 text-[13px] font-medium text-white">
          {pair.caption}
        </div>
      ) : null}
    </div>
  );
}
