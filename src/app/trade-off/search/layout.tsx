// Cream-palette + AppShell wrapper for /trade-off/search.
//
// Matches the pattern used across /trade-off/yard, /edit, /sell etc.
// AppShell renders the persistent app header (Yard / TC / TN nav +
// avatar drawer + mobile bottom nav) so a homeowner arriving on the
// search page never feels marooned — they can jump to any surface
// from the same chrome.

import type { CSSProperties } from "react";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { resolveInitialAuth } from "@/components/shell/resolveInitialAuth";

export default async function SearchLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const initialAuth = await resolveInitialAuth();
  return (
    <div
      className="min-h-screen bg-[#FBF6EC] text-[#1B1A17]"
      style={
        {
          "--brand-bg":      "251 246 236",
          "--brand-surface": "247 240 224",
          "--brand-line":    "229 217 189",
          "--brand-text":    "27 26 23",
          "--brand-muted":   "115 105 82"
        } as CSSProperties
      }
    >
      <Suspense fallback={<div className="min-h-[100dvh]">{children}</div>}>
        <AppShell initialAuth={initialAuth}>{children}</AppShell>
      </Suspense>
    </div>
  );
}
