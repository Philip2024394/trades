// src/app/nex-native/settings/notifications/page.tsx
//
// Phase 1 scaffold · route-only · backend not implemented · sealed
// 2026-10-06. Routes to the shared Coming Soon shell per founder §28
// ("Do not fake the missing capability").

import { ComingSoonSettingsPage } from "../_coming-soon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function NotificationsSettingsPage() {
  return ComingSoonSettingsPage({
    dataScope: "notifications",
    groupLabel: "Messages",
    title: "Notifications",
    description:
      "Control message, call and other NEX notifications in one place.",
    explain:
      "You'll be able to turn message pings, call pings and other NEX notifications on or off here · with per-chat quiet times.",
  });
}
