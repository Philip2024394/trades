"use client";

// CornerCategoryButton — one of the four circular category buttons
// pinned to the four corners of the discovery canvas. All four are
// always orange (per spec "the 4 buttons are yellow"). Active state
// adds a subtle glowing ring around the button; label colour stays
// orange in both states.

import type { LucideIcon } from "lucide-react";

type Position = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const POSITION_STYLES: Record<Position, { top?: number; bottom?: number; left?: number; right?: number }> = {
  "top-left":     { top: 12,    left:  12 },
  "top-right":    { top: 12,    right: 12 },
  "bottom-left":  { bottom: 12, left:  12 },
  "bottom-right": { bottom: 12, right: 12 }
};

export function CornerCategoryButton({
  position, active, onClick, icon: Icon, label
}: {
  position: Position;
  active:   boolean;
  onClick:  () => void;
  icon:     LucideIcon;
  label:    string;
}) {
  const posStyle = POSITION_STYLES[position];
  const labelBottom = position.startsWith("top");
  return (
    <div
      className="absolute z-40 flex flex-col items-center gap-1"
      style={{ ...posStyle, pointerEvents: "none" }}
    >
      {!labelBottom && (
        <span className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: active ? "var(--nex-accent-500)" : "var(--nex-neutral-500)" }}>
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className="grid h-12 w-12 place-items-center rounded-full transition-colors active:scale-95"
        style={{
          background: active ? "var(--nex-accent-500)" : "var(--nex-neutral-200)",
          color:      active ? "var(--nex-neutral-0)"  : "var(--nex-neutral-500)",
          boxShadow:  "var(--nex-shadow-md)",
          pointerEvents: "auto"
        }}
      >
        <Icon size={20} strokeWidth={2} />
      </button>
      {labelBottom && (
        <span className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: active ? "var(--nex-accent-500)" : "var(--nex-neutral-500)" }}>
          {label}
        </span>
      )}
    </div>
  );
}
