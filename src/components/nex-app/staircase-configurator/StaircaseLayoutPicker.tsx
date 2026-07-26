"use client";

// StaircaseLayoutPicker — horizontal scrolling strip of layout chips beneath
// the 3D preview. Every layout option gets a small schematic SVG diagram +
// name. Clicking a chip immediately swaps the 3D preview to that layout so
// Philip can flip through all 13 UK staircase plans without opening the
// drawer. Active chip gets a primary-accent ring.

import type { ComponentCategory } from "./StaircaseConfiguratorDrawer";

/** Tiny top-down schematic per layout id — 40×40 viewBox, monochrome so it
 *  inherits the surrounding text colour. Rough shapes only; iterated on as
 *  the geometry engine evolves. */
function LayoutIcon({ id }: { id: string }) {
  const stroke = "currentColor";
  const fill = "none";
  switch (id) {
    case "straight":
      return (
        <svg viewBox="0 0 40 40" className="w-6 h-6" aria-hidden="true">
          <rect x="14" y="6"  width="12" height="28" stroke={stroke} fill={fill} strokeWidth="1.5" />
          {[10, 14, 18, 22, 26, 30].map((y) => (
            <line key={y} x1="14" y1={y} x2="26" y2={y} stroke={stroke} strokeWidth="1" />
          ))}
        </svg>
      );
    case "quarter-landing":
      return (
        <svg viewBox="0 0 40 40" className="w-6 h-6" aria-hidden="true">
          <rect x="6"  y="18" width="18" height="10" stroke={stroke} fill={fill} strokeWidth="1.5" />
          <rect x="24" y="6"  width="10" height="22" stroke={stroke} fill={fill} strokeWidth="1.5" />
        </svg>
      );
    case "l-shape":
      return (
        <svg viewBox="0 0 40 40" className="w-6 h-6" aria-hidden="true">
          <path d="M 6 26 L 20 26 L 20 6" stroke={stroke} fill={fill} strokeWidth="2" />
          <path d="M 14 20 L 20 26 L 20 20 Z" stroke={stroke} fill={fill} strokeWidth="1" />
        </svg>
      );
    case "half-landing":
      return (
        <svg viewBox="0 0 40 40" className="w-6 h-6" aria-hidden="true">
          <rect x="6"  y="6"  width="10" height="22" stroke={stroke} fill={fill} strokeWidth="1.5" />
          <rect x="16" y="24" width="18" height="4"  stroke={stroke} fill={fill} strokeWidth="1.5" />
          <rect x="24" y="12" width="10" height="16" stroke={stroke} fill={fill} strokeWidth="1.5" />
        </svg>
      );
    case "u-shape":
      return (
        <svg viewBox="0 0 40 40" className="w-6 h-6" aria-hidden="true">
          <rect x="6"  y="6"  width="10" height="20" stroke={stroke} fill={fill} strokeWidth="1.5" />
          <rect x="6"  y="26" width="28" height="8"  stroke={stroke} fill={fill} strokeWidth="1.5" />
          <rect x="24" y="6"  width="10" height="20" stroke={stroke} fill={fill} strokeWidth="1.5" />
        </svg>
      );
    case "double-winder":
      return (
        <svg viewBox="0 0 40 40" className="w-6 h-6" aria-hidden="true">
          <path d="M 6 30 L 12 24 L 6 18" stroke={stroke} fill={fill} strokeWidth="1.5" />
          <rect x="12" y="18" width="16" height="6" stroke={stroke} fill={fill} strokeWidth="1.5" />
          <path d="M 28 22 L 34 16 L 28 10" stroke={stroke} fill={fill} strokeWidth="1.5" />
        </svg>
      );
    case "winder-entry":
      return (
        <svg viewBox="0 0 40 40" className="w-6 h-6" aria-hidden="true">
          <path d="M 6 30 L 14 22 L 6 14" stroke={stroke} fill={fill} strokeWidth="1.5" />
          <rect x="14" y="10" width="16" height="12" stroke={stroke} fill={fill} strokeWidth="1.5" />
        </svg>
      );
    case "winder-halfway":
      return (
        <svg viewBox="0 0 40 40" className="w-6 h-6" aria-hidden="true">
          <rect x="6"  y="24" width="8"  height="10" stroke={stroke} fill={fill} strokeWidth="1.5" />
          <path d="M 14 34 L 22 24 L 14 14 Z" stroke={stroke} fill={fill} strokeWidth="1.5" />
          <rect x="22" y="6"  width="8"  height="12" stroke={stroke} fill={fill} strokeWidth="1.5" />
        </svg>
      );
    case "winder-top":
      return (
        <svg viewBox="0 0 40 40" className="w-6 h-6" aria-hidden="true">
          <rect x="6"  y="18" width="16" height="12" stroke={stroke} fill={fill} strokeWidth="1.5" />
          <path d="M 22 26 L 30 18 L 22 10" stroke={stroke} fill={fill} strokeWidth="1.5" />
        </svg>
      );
    case "t-shape":
      return (
        <svg viewBox="0 0 40 40" className="w-6 h-6" aria-hidden="true">
          <rect x="14" y="20" width="12" height="14" stroke={stroke} fill={fill} strokeWidth="1.5" />
          <rect x="4"  y="14" width="32" height="6"  stroke={stroke} fill={fill} strokeWidth="1.5" />
        </svg>
      );
    case "curved":
      return (
        <svg viewBox="0 0 40 40" className="w-6 h-6" aria-hidden="true">
          <path d="M 8 32 Q 20 32 20 20 T 32 8" stroke={stroke} fill={fill} strokeWidth="2" />
        </svg>
      );
    case "spiral":
      return (
        <svg viewBox="0 0 40 40" className="w-6 h-6" aria-hidden="true">
          <circle cx="20" cy="20" r="4"  stroke={stroke} fill={fill} strokeWidth="1.5" />
          <circle cx="20" cy="20" r="14" stroke={stroke} fill={fill} strokeWidth="1.5" strokeDasharray="4 3" />
        </svg>
      );
    case "ladder":
      return (
        <svg viewBox="0 0 40 40" className="w-6 h-6" aria-hidden="true">
          <rect x="12" y="6"  width="4"  height="28" stroke={stroke} fill={fill} strokeWidth="1.5" />
          <rect x="24" y="6"  width="4"  height="28" stroke={stroke} fill={fill} strokeWidth="1.5" />
          {[10, 16, 22, 28].map((y) => (
            <line key={y} x1="12" y1={y} x2="28" y2={y} stroke={stroke} strokeWidth="1.5" />
          ))}
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 40 40" className="w-6 h-6" aria-hidden="true">
          <rect x="10" y="10" width="20" height="20" stroke={stroke} fill={fill} strokeWidth="1.5" />
        </svg>
      );
  }
}

export function StaircaseLayoutPicker({
  categories,
  selectedLayout,
  onLayoutChange,
}: {
  categories: ComponentCategory[];
  selectedLayout: string;
  onLayoutChange: (layoutId: string) => void;
}) {
  const layoutCat = categories.find((c) => c.id === "layout");
  if (!layoutCat) return null;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-eyebrow uppercase tracking-wider text-muted-foreground">Layout plan</span>
        <span className="text-caption text-muted-foreground">
          — flip through 13 UK staircase plans
        </span>
      </div>
      <div
        role="tablist"
        aria-label="Staircase layout"
        className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory"
        style={{ scrollbarWidth: "thin" }}
      >
        {layoutCat.options.map((opt) => {
          const active = selectedLayout === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onLayoutChange(opt.id)}
              title={opt.description ?? opt.label}
              className={[
                "shrink-0 snap-start flex flex-col items-center gap-1 py-2 px-3 rounded-lg border transition-all",
                "min-w-[88px] text-caption",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow"
                  : "bg-card text-foreground border-border hover:border-primary/60 hover:bg-muted",
              ].join(" ")}
            >
              <LayoutIcon id={opt.id} />
              <span className="text-center leading-tight">{opt.label.split(" (")[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
