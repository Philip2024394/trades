// src/app/nex-native/nex-socials/page.tsx
//
// NEX Socials · intro gate · founder-sealed 2026-10-07.
//
// Entry point for the Social surface (floating profiles). Rather
// than dropping users straight into the discover canvas, we show
// a cinematic entrance:
//
//   1. Fullscreen night-life hero (public/nex-socials/night-life-background.png)
//   2. "Enter NEX Socials" call-to-action over the hero
//   3. On tap · intro video plays end-to-end (user gesture → audio allowed)
//   4. On "ended" OR Skip tap · router.push("/nex-app/discover")
//
// Tap-to-play chosen over autoplay-with-sound because:
//   · Browsers block autoplay-with-sound unless the user interacted
//     with the page first. A click in /nex-native/settings DOES count
//     as a user gesture for the next navigation but it's fragile ·
//     a direct link or deep-link bypasses it. Tap-to-play is bulletproof.
//   · The night-life hero gives the user context before the video
//     loads · if they're on a slow connection they still see the brand.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { NexSocialsIntro } from "./_intro-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function NexSocialsIntroPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/nex-socials");
  }
  return <NexSocialsIntro />;
}
