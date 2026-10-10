// src/app/nex-native/settings/blocked/page.tsx
//
// Phase 1 scaffold · route-only · backend not implemented · sealed
// 2026-10-06.

import { ComingSoonSettingsPage } from "../_coming-soon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BlockedSettingsPage() {
  return ComingSoonSettingsPage({
    dataScope: "blocked",
    groupLabel: "Privacy & Safety",
    title: "Blocked & restricted",
    description:
      "Manage people you've blocked or restricted on NEX.",
    explain:
      "You'll be able to review your block list, unblock people, and manage restricted contacts from here.",
  });
}
