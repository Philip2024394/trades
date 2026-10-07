// src/app/nex-native/nex-socials/discover/page.tsx
//
// NEX Socials · intent-less discover route · founder-sealed 2026-10-07.
//
// There is no "all-lenses" view by design (founder brief: NEX Socials
// is entering a social world, not browsing a database). Hitting
// /nex-native/nex-socials/discover without a lens redirects to the
// chooser so every arrival on the floating-profile canvas is through
// an explicit intent selection.

import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function NexSocialsDiscoverNoIntentPage(): never {
  redirect("/nex-native/nex-socials");
}
