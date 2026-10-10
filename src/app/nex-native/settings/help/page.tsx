// src/app/nex-native/settings/help/page.tsx
//
// Phase 1 scaffold · routes to NEX1 for help · sealed 2026-10-06.
// Help is "coming soon" as a dedicated surface, but a sensible
// Phase 1 behaviour is to point users at the NEX1 support chat
// (which already exists) rather than silently defer.

import { ComingSoonSettingsPage } from "../_coming-soon";
import { NEX_OFFICIAL_CHAT_HREF } from "@/lib/nex-native/nex-official";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HelpSettingsPage() {
  return ComingSoonSettingsPage({
    dataScope: "help",
    groupLabel: "Help",
    title: "Help & support",
    description:
      "Get help with NEX.",
    explain:
      "The dedicated help centre is being written. Until it's ready, message NEX1 directly — we read every message.",
    ctaHref: `${NEX_OFFICIAL_CHAT_HREF}?intent=help_support`,
    ctaLabel: "Message NEX1",
  });
}
