// src/app/nex-native/settings/storage/page.tsx
//
// Phase 1 scaffold · route-only · backend not implemented · sealed
// 2026-10-06.

import { ComingSoonSettingsPage } from "../_coming-soon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function StorageSettingsPage() {
  return ComingSoonSettingsPage({
    dataScope: "storage",
    groupLabel: "Storage & Data",
    title: "Storage",
    description:
      "See and manage your NEX storage.",
    explain:
      "You'll be able to see how much space your chats and media are using · and clear what you don't need any more.",
  });
}
