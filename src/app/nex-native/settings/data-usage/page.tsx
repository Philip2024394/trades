// src/app/nex-native/settings/data-usage/page.tsx
//
// Phase 1 scaffold · route-only · backend not implemented · sealed
// 2026-10-06.

import { ComingSoonSettingsPage } from "../_coming-soon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DataUsageSettingsPage() {
  return ComingSoonSettingsPage({
    dataScope: "data-usage",
    groupLabel: "Storage & Data",
    title: "Data usage",
    description:
      "Control how NEX uses your mobile data.",
    explain:
      "Auto-download of photos and videos, media quality on mobile data, and offline behaviour will all live here.",
  });
}
