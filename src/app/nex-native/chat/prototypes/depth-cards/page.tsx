// src/app/nex-native/chat/prototypes/depth-cards/page.tsx
//
// Legacy URL redirect. The depth-cards surface was renamed to
// hauntedhoteltheme in commit d0db94a7 (2026-10-03). This page exists
// only to catch stale bookmarks + any lingering browser-cache hits
// at the old URL and send them to the current canonical location.
//
// Keep this file minimal · no deck, no composer, no backend. Delete
// freely once stale references stop appearing in logs.

import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function LegacyDepthCardsRedirect(): never {
  redirect("/nex-native/chat/prototypes/hauntedhoteltheme");
}
