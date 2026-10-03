// src/components/nex-native/HauntedHotelChrome.tsx
//
// Haunted Hotel theme chrome · composable overlay bundle.
// -----------------------------------------------------------------------------
// Mounts the three Haunted Hotel visual layers as a single unit:
//
//   1. <HauntedHotelAtmosphere /> · server component · pure CSS. Hotel
//      photograph background + two flickering lights + 36 choreographed
//      spark particles + the 60-second one-shot "blow-out" timeline that
//      fades to the lights-dead photo at t=60s.
//
//   2. <HauntedSmokeClient /> · client component · 11-particle smoke
//      overlay rising from the bottom of the viewport.
//
//   3. <HauntedHotelController /> · client component · floating 3-dots
//      trigger (bottom-right) that opens a full-screen panel with 10
//      opt-in FX toggles (lightning, fog, rain, vignette, dust, phantom,
//      chime, cobweb, candelabra, blow-out). Toggles persist in
//      localStorage · default state is OFF.
//
// MOUNTING RULES
// --------------
// This component is a SERVER component. It is safe to mount it as a
// SIBLING of a client component (e.g. the ThemeViewerClient or the
// PortraitBloomShell) from a server parent. Do not try to mount it
// directly inside a client component — React requires server components
// to flow down from a server parent.
//
// Call sites:
//   · src/app/nex-native/themes/[id]/page.tsx       (theme preview)
//   · src/app/nex-native/chat/peer/[accountId]/page.tsx (live peer chat)
//   · src/app/nex-native/chat/prototypes/depth-cards/page.tsx (prototype)
//
// Gate the mount on the active theme id:
//
//   {theme.id === 'haunted-hotel'       && <HauntedHotelChrome />}
//   {peerThemeRow?.id === 'haunted-hotel' && <HauntedHotelChrome />}

import * as React from "react";
import { HauntedHotelAtmosphere } from "./HauntedHotelAtmosphere";
import { HauntedSmokeClient } from "./HauntedHotelSmoke";
import { HauntedHotelController } from "./HauntedHotelController";

export function HauntedHotelChrome(): React.ReactElement {
  return (
    <>
      <HauntedHotelAtmosphere />
      <HauntedSmokeClient />
      <HauntedHotelController />
    </>
  );
}
