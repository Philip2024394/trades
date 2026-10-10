// src/app/nex1/workstation-live/onboard/page.tsx
//
// NEX1 · Workstation · Onboard route · CONSOLIDATED 2026-09-17.
// Founder rule: /nex1/workstation-live is the ONLY coding workstation. The
// repo-onboarding capability now lives as the "◱ Repo" tab inside that
// workstation. This route redirects any legacy links there to preserve
// bookmarks + the constitution rule against dead URLs.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function OnboardRedirectPage() {
  // The workstation opens on the Repo tab by default now (see
  // NexAgentWorkstation useState<TabView>("repo")). No query param needed ·
  // avoids RSC-payload cache-key mismatch that caused fetch loops on 2026-09-17.
  redirect("/nex1/workstation-live");
}
