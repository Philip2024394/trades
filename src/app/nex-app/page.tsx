// NEX Platform landing — Path B redirect (Philip 2026-08-02).
//
// Route: /nex-app
//
// DECISION · Philip 2026-08-02 · single-landing-page audit:
//   The first user experience must be brain-first, not module-grid-first.
//   Every direct visit to /nex-app redirects into the Staircase Brain
//   "discover" surface — that's where Nex's strongest experience lives
//   (Ask Nex → Brain understands context → Tools appear when needed).
//
// PRESERVED (do NOT delete):
//   - src/components/nex-app/platform/PlatformShell.tsx — future "Nex OS"
//     layer for authenticated / power users. Kept intact per Path B.
//   - src/components/nex-app/platform/MainGrid.tsx — 19-module grid
//     available for the future authenticated home.
//   - PlatformBottomNav, LivePlatformCard, RecentProjectsRow etc. all
//     still consumed by MessengerShell and other surfaces.
//
// When authentication + returning-user detection lands, this file becomes
// an auth gate: authed → PlatformShell, unauthed / first-visit → redirect.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PlatformLandingPage() {
  redirect("/nex-app/brains/staircase?state=discover");
}
