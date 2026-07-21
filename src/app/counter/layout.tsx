// Cream-palette wrapper for The Counter.
//
// Wraps /counter routes in the same AppShell as The Yard so users
// get the persistent GlobalHeader (nav + brand + search) + Edit-mode
// pill + Wallet chip + Bell + Avatar drawer without a jump between
// surfaces. Same cream token overrides so `bg-brand-*` classes resolve
// to the off-white platform theme.

import type { CSSProperties } from "react";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { resolveInitialAuth } from "@/components/shell/resolveInitialAuth";

export default async function CounterLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // Server-resolve the trade session cookie so AppShell renders the
  // signed-in header on first paint — no client "Join free / Sign in"
  // flash while /api/trade-off/session round-trips.
  const initialAuth = await resolveInitialAuth();
  return (
    <div
      className="min-h-screen bg-[#FBF6EC] text-[#1B1A17]"
      style={
        {
          "--brand-bg":      "251 246 236",  // #FBF6EC cream
          "--brand-surface": "247 240 224",  // warm off-cream
          "--brand-line":    "229 217 189",  // soft cream border
          "--brand-text":    "27 26 23",     // #1B1A17 warm ink
          "--brand-muted":   "115 105 82"    // warm muted grey
        } as CSSProperties
      }
    >
      <Suspense fallback={<div className="min-h-[100dvh]">{children}</div>}>
        <AppShell initialAuth={initialAuth}>{children}</AppShell>
      </Suspense>
    </div>
  );
}
