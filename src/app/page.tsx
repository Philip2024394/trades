// Root route redirects to the NEX Product Front Door (Philip 2026-08-14 · Phase 20).
//
// The 2026-08-12 pinned rule made /nex-app/brains/staircase?state=discover
// the canonical customer-facing landing. Phase 20 introduces a distinct
// product front door at /nex-app that offers two clear paths:
//   - Explore  → the pinned staircase discovery landing (preserved)
//   - Create   → the App Builder chat (owner journey)
//
// So `/` bounces to `/nex-app` (the front door); the front door itself
// keeps the pinned landing reachable via its "Explore" card.
//
// The legacy Thenetworkers audience-gate components stay in
// `src/components/homepage/*` — unused from `/` but may still be
// referenced by other routes. Delete separately if truly orphaned.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEX", robots: { index: false } };

export default function Home(): never {
  redirect("/nex-app");
}
