// Cream-palette wrapper for the free-tier edit dashboard.
//
// The rest of the platform (landing, /home, /trade-hq, /join, /why,
// /foreman, /entity) uses the Construction Notebook cream palette
// (#FBF6EC / #1B1A17 / #FFB300). The /trade-off/edit surface was
// still on the legacy dark brand tokens (--brand-bg = #000). This
// layout overrides the CSS custom properties for the entire
// /trade-off/edit/[slug]/* subtree so every `bg-brand-*` /
// `text-brand-*` class in TradeOffForm + all sub-panels resolves
// to cream without touching a single component.
//
// Brand accent stays #FFB300 (yellow) — inherited from globals.css.

import type { CSSProperties } from "react";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { resolveInitialAuth } from "@/components/shell/resolveInitialAuth";

export default async function TradeOffEditLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // Same server-side auth resolve as the Yard layout — signed-in state
  // is known on first paint, no client-side header flash.
  const initialAuth = await resolveInitialAuth();
  return (
    <div
      className="min-h-screen bg-[#FBF6EC] text-[#1B1A17]"
      style={
        {
          "--brand-bg": "251 246 236", // #FBF6EC
          "--brand-surface": "247 240 224", // subtly warmer than bg
          "--brand-line": "229 217 189", // soft cream border
          "--brand-text": "27 26 23", // #1B1A17
          "--brand-muted": "115 105 82" // muted warm grey
          // --brand-accent intentionally unchanged (#FFB300 yellow)
        } as CSSProperties
      }
    >
      {/* Persistent app shell — same top bar + mobile bottom nav +
          avatar drawer as /trade-off/yard, /trade-off/prices,
          /trade-off/following. Turns the dashboard from a separate
          "admin" area into part of the same product. Suspense boundary
          matches the pattern used by the other shell mounts. */}
      <Suspense fallback={<div className="min-h-[100dvh]">{children}</div>}>
        <AppShell initialAuth={initialAuth}>{children}</AppShell>
      </Suspense>
    </div>
  );
}
