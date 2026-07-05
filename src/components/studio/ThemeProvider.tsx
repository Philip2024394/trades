// ThemeProvider — applies a theme preset's CSS variables to a wrapper.
//
// Every rebuilt section reads Tailwind classes like `font-heading`,
// `font-body`, and `rounded-lg` (which resolve to `var(--radius)`).
// When the preset changes, ONE wrapper flips its inline style and the
// whole subtree instantly re-renders with the new fonts + radii +
// spacing rhythm.
//
// Server component — no client-side JS needed. Just wraps children
// with an element that has the preset's CSS variables applied.

import type { CSSProperties } from "react";
import {
  THEME_PRESETS,
  type ThemePresetId
} from "@/lib/studio/themePresets";
import { cn } from "@/lib/utils";

export function ThemeProvider({
  preset = "modern",
  className,
  children
}: {
  preset?: ThemePresetId;
  className?: string;
  children: React.ReactNode;
}) {
  const config = THEME_PRESETS[preset] ?? THEME_PRESETS.modern;

  // Applying CSS variables via inline style is the only way to compose
  // an arbitrary preset without pre-defining every preset as a class
  // in the stylesheet. Deterministic — same preset id always same vars.
  const style = config.vars as unknown as CSSProperties;

  return (
    <div
      data-theme-preset={config.id}
      className={cn("font-body", className)}
      style={style}
    >
      {children}
    </div>
  );
}
