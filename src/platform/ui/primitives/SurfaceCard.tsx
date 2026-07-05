// SurfaceCard — the base card primitive.
//
// One card component with variants covers:
//   primary / secondary / glass / warning / success / info / danger.
//
// Never write a card without this. If you find yourself writing
// `rounded-2xl border border-neutral-200 bg-white p-5` you should be
// using SurfaceCard variant="primary".

import type { ReactNode } from "react";
import { CARD_RADIUS } from "../tokens";

export type SurfaceVariant =
  | "primary"      // white card, neutral border — default
  | "secondary"    // muted background, no border
  | "glass"        // translucent, for hero overlays
  | "info"         // blue tint
  | "warning"      // amber tint
  | "success"      // emerald tint
  | "danger"       // red tint
  | "dark"         // dark background, light text
  | "highlight";   // amber tint with amber border — for featured items

const VARIANT_CLASS: Record<SurfaceVariant, string> = {
  primary: "border border-neutral-200 bg-white",
  secondary: "bg-neutral-50 border border-transparent",
  glass: "border border-white/10 bg-white/10 backdrop-blur",
  info: "border border-blue-200 bg-blue-50 text-blue-900",
  warning: "border border-amber-200 bg-amber-50 text-amber-900",
  success: "border border-emerald-200 bg-emerald-50 text-emerald-900",
  danger: "border border-red-200 bg-red-50 text-red-900",
  dark: "border border-neutral-800 bg-neutral-900 text-white",
  highlight: "border border-amber-300 bg-amber-50"
};

export type SurfacePadding = "none" | "sm" | "md" | "lg";

const PADDING_CLASS: Record<SurfacePadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4 md:p-5",
  lg: "p-5 md:p-6"
};

export type SurfaceCardProps = {
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  interactive?: boolean;
  className?: string;
  children: ReactNode;
};

export function SurfaceCard({
  variant = "primary",
  padding = "md",
  interactive = false,
  className = "",
  children
}: SurfaceCardProps) {
  const hover = interactive
    ? "transition hover:border-neutral-300 hover:shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
    : "";
  return (
    <div
      className={`${CARD_RADIUS} ${VARIANT_CLASS[variant]} ${PADDING_CLASS[padding]} ${hover} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
