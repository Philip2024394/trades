// Popover — anchored overlay tied to a trigger element.
//
// Uses a click-outside handler + Escape to close. Position is
// controlled by the wrapper (relative + absolute child) — no complex
// portal for v1. If the platform needs collision-detection later,
// swap in @floating-ui/react-dom without changing the API.

"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { ELEVATION } from "../tokens";

export type PopoverPlacement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

const PLACEMENT_CLASS: Record<PopoverPlacement, string> = {
  "bottom-start": "top-full left-0 mt-1",
  "bottom-end": "top-full right-0 mt-1",
  "top-start": "bottom-full left-0 mb-1",
  "top-end": "bottom-full right-0 mb-1"
};

export type PopoverProps = {
  /** The element that toggles the popover — usually a Button. */
  trigger: (props: {
    ref: React.RefObject<HTMLButtonElement | null>;
    onClick: () => void;
    isOpen: boolean;
  }) => ReactNode;
  children: ReactNode;
  placement?: PopoverPlacement;
  /** Fixed panel width — px or CSS unit. */
  width?: string | number;
};

export function Popover({
  trigger,
  children,
  placement = "bottom-start",
  width = 240
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div className="relative inline-block">
      {trigger({ ref: triggerRef, onClick: () => setOpen((v) => !v), isOpen: open })}
      {open ? (
        <div
          ref={panelRef}
          className={`absolute z-40 ${PLACEMENT_CLASS[placement]} ${ELEVATION[4]} rounded-xl border border-neutral-200 bg-white`}
          style={{ width: typeof width === "number" ? `${width}px` : width }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
