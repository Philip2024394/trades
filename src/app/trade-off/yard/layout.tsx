// Cream-palette wrapper for The Yard.
//
// Overrides the dark brand tokens for the entire /trade-off/yard subtree
// so every `bg-brand-*` / `text-brand-*` class in the page + card
// components resolves to the Construction Notebook cream palette without
// touching a single component. Same pattern used by /trade-off/edit.

import type { CSSProperties } from "react";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { resolveInitialAuth } from "@/components/shell/resolveInitialAuth";
import { YardDiyGuard } from "@/components/xrated/yard/YardDiyGuard";

export default async function YardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // Server-resolve the trade session cookie so AppShell renders the
  // signed-in header on first paint. No client-side "Join free / Sign
  // in" flash while /api/trade-off/session round-trips.
  const initialAuth = await resolveInitialAuth();
  return (
    <div
      className="min-h-screen bg-[#FBF6EC] text-[#1B1A17]"
      style={
        {
          "--brand-bg": "251 246 236", // #FBF6EC cream
          "--brand-surface": "247 240 224", // warm off-cream
          "--brand-line": "229 217 189", // soft cream border
          "--brand-text": "27 26 23", // #1B1A17 warm ink
          "--brand-muted": "115 105 82" // warm muted grey
          // --brand-accent stays #FFB300 from globals.css
        } as CSSProperties
      }
    >
      {/* Constitutional gate — DIY viewers can never see The Yard.
          See feedback_trade_features_trade_only.md. If the caller is
          authed as DIY via the Trade Center session, YardDiyGuard
          redirects them back to /tc/trade-center with a blocked=
          param the toast picks up. */}
      <YardDiyGuard/>

      {/* App shell — persistent top bar + mobile bottom nav + avatar
          drawer. Same shell wraps every Thenetworkers surface so members
          never feel like they're leaving the platform. */}
      <Suspense fallback={<div className="min-h-[100dvh]">{children}</div>}>
        <AppShell initialAuth={initialAuth}>{children}</AppShell>
      </Suspense>
    </div>
  );
}
