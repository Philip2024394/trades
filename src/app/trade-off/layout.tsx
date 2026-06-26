// Xrated Trades — light-theme wrapper for /trade-off/*.
// Scopes a CSS-var override to every page under this segment so the
// shared `bg-brand-*` / `text-brand-*` / `border-brand-*` Tailwind
// utilities flip to a white surface inside Xrated routes — without
// touching the global Hammerex shop theme.
//
// Hardcoded dark colours inside components (XratedHeader / XratedFooter
// `bg-black`, banner overlays, modal backdrops, hero photos) are
// unaffected by these var overrides and are handled component-by-
// component.

import type { CSSProperties } from "react";

export default function TradeOffLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen bg-white text-neutral-900"
      style={
        {
          // Body / card surfaces.
          "--brand-bg": "255 255 255",
          "--brand-surface": "249 250 251",
          "--brand-line": "229 231 235",
          // Body copy + headings + muted secondary copy.
          "--brand-text": "17 24 39",
          "--brand-muted": "107 114 128"
          // --brand-accent intentionally inherited from globals.css (Hammerex yellow).
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
