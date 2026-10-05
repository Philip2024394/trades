"use client";

// src/app/nex-native/themes/[id]/_joker-chat-overlays.tsx
//
// Joker-theme production overlay bundle · sealed 2026-10-01 ·
// re-shaped for Stage 1 universal-chrome convergence 2026-10-05.
//
// What this bundle contains NOW (atmosphere only):
//
//   · Entry theatre  · one-shot lightning + bat silhouette on mount
//   · JokerController · 3-dots side panel with ambient toggles (Rain /
//                        Bats / Lightning) + Wise Card draw
//
// What this bundle used to contain, moved out as part of Stage 1:
//
//   · TrustScan opener · Trust Scan is a universal NEX capability, not
//     a theme feature. It is now rendered by `UniversalChatControls`
//     natively inside PortraitBloomShell on every production chat
//     surface, available on every theme. The props previously used to
//     scope the scan to the current peer (`scannedAccountId`,
//     `viewerAccountId`) are no longer threaded through this file —
//     the shell owns those directly.
//
// Mount pattern (sealed 2026-10-05):
//
//   The production peer-chat page mounts this through the atmosphere
//   registry at `src/lib/nex-native/chat-render/atmosphere-registry.ts`.
//   The page itself carries NO theme-id branches · it renders
//   `<ThemeAtmosphereLayer themeId={peerThemeRow?.id ?? null} ... />`
//   and the registry decides whether to mount this bundle, the Haunted
//   Hotel bundle, or nothing at all.
//
// The old `JokerChatOverlays` export is preserved as an alias so any
// preview surfaces that still import it keep working. The new canonical
// name is `JokerAtmosphereBundle` (same shape as other atmosphere
// components in the registry).

import * as React from "react";
import { JokerController } from "./_joker-controller";
import { JokerMotionOverlay } from "./_joker-motion";

// Entry-theatre lifetime · one-shot lightning + bat silhouette · fires
// ONCE on mount per peer/chat so the first second announces "you're
// inside Joker" without ever repeating during the conversation. 1.2s
// lightning strike + 1.4s bat swoop so the flash lands first and the
// bat follows a hair behind on the fading afterglow.
const ENTRY_LIGHTNING_MS = 1200;
const ENTRY_BAT_MS = 1400;

export interface JokerAtmosphereBundleProps {
  /** The subject whose chat the user is viewing · usually the peer
   *  account id for peer chat. Used ONLY to re-fire the entry theatre
   *  when the viewer navigates between different peers so each new
   *  chat gets its own "welcome to Joker" moment. Not threaded to
   *  Trust Scan anymore · Trust Scan is universal now. */
  subjectId: string | null;
}

export function JokerAtmosphereBundle({
  subjectId,
}: JokerAtmosphereBundleProps): React.JSX.Element {
  // Entry theatre · one-shot lightning + bat silhouette · scoped to
  // subjectId so re-opening the same chat later in the session doesn't
  // retrigger (would feel like a bug, not atmosphere). Each DIFFERENT
  // peer gets its own entry moment.
  const [entryLightning, setEntryLightning] = React.useState(true);
  const [entryBat, setEntryBat] = React.useState(true);

  React.useEffect(() => {
    setEntryLightning(true);
    setEntryBat(true);
    const l = window.setTimeout(
      () => setEntryLightning(false),
      ENTRY_LIGHTNING_MS,
    );
    const b = window.setTimeout(() => setEntryBat(false), ENTRY_BAT_MS);
    return () => {
      window.clearTimeout(l);
      window.clearTimeout(b);
    };
  }, [subjectId]);

  return (
    <>
      {/* Entry theatre · fires ONCE per peer-chat mount · lightning
          lands first (1.2s) and the bat silhouette rides out on the
          afterglow (1.4s). Both auto-unmount so the shell is quiet
          again by the time the user starts reading messages. */}
      {entryLightning && <JokerMotionOverlay variant="lightning" />}
      {entryBat && <JokerMotionOverlay variant="bat" />}
      <JokerController />
    </>
  );
}

// ─── Backwards-compat alias for callers that still import the old
// name. Preserves the previous props contract so legacy preview
// surfaces keep working while the migration completes. Both exports
// render the same atmosphere bundle; the scannedAccountId /
// viewerAccountId props are accepted but ignored (Trust Scan is
// universal now).

export interface JokerChatOverlaysProps {
  scannedAccountId: string;
  viewerAccountId: string | null;
}

export function JokerChatOverlays({
  scannedAccountId,
}: JokerChatOverlaysProps): React.JSX.Element {
  return <JokerAtmosphereBundle subjectId={scannedAccountId} />;
}
