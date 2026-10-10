// src/app/nex-native/settings/about/page.tsx
//
// Phase 1 scaffold · route-only · backend not implemented · sealed
// 2026-10-06.

import { ComingSoonSettingsPage } from "../_coming-soon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AboutSettingsPage() {
  return ComingSoonSettingsPage({
    dataScope: "about",
    groupLabel: "Help",
    title: "About NEX",
    description:
      "App information, version and credits.",
    explain:
      "The About page is being written and will include version information, acknowledgements and NEX community links.",
  });
}
