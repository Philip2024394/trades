// Shared helpers for navigation pattern renderers.

"use client";

import * as LucideIcons from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }>;

/** Resolve a Lucide icon name to its component. Falls back to a
 *  ChevronRight if the name is unknown. */
export function iconFor(name: string | undefined): LucideIcon {
  if (!name) return LucideIcons.ChevronRight as LucideIcon;
  const capitalised = name
    .split("-")
    .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
    .join("");
  const candidate = (LucideIcons as unknown as Record<string, LucideIcon>)[
    capitalised
  ];
  return candidate ?? (LucideIcons.ChevronRight as LucideIcon);
}

/** Publisher block shared by every platform-authored pattern. */
export const P = {
  name: "Xrated Trades Platform",
  verified: true
} as const;
