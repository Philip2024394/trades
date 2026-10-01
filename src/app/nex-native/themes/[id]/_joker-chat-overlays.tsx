"use client";

// src/app/nex-native/themes/[id]/_joker-chat-overlays.tsx
//
// Joker-theme production overlay bundle · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// Single client-component wrapper the real peer-chat page (and the
// theme preview viewer) mounts when the current theme is theme-0.
// Encapsulates:
//
//   · JokerController   · 3-dots side panel with the ambient toggles
//                         (Rain / Bats / Lightning) + Wise Card draw
//                         + Trust Scan open button
//   · TrustScan         · opened via the controller's Trust Scan card ·
//                         scoped to the current peer so the report
//                         describes that account
//
// Keeps the state (trustScanOpen / cleared) local so the Server
// Component page doesn't need to track it.

import * as React from "react";
import { JokerController } from "./_joker-controller";
import { JokerMotionOverlay } from "./_joker-motion";
import { TrustScan } from "@/app/nex-native/_trust-scan/TrustScan";
import { mockTrustScanProvider } from "@/app/nex-native/_trust-scan/trust-scan-mock-provider";
import { NEX_TRUST_SCAN_SKIN } from "@/app/nex-native/_trust-scan/trust-scan-skin";
import type { TrustScanProvider } from "@/app/nex-native/_trust-scan/trust-scan-types";

// Entry-theatre lifetime · one-shot lightning + bat silhouette · fires
// ONCE on mount per peer/chat so the first second announces "you're
// inside Joker" without ever repeating during the conversation. 1.2s
// lightning strike + 1.4s bat swoop so the flash lands first and the
// bat follows a hair behind on the fading afterglow.
const ENTRY_LIGHTNING_MS = 1200;
const ENTRY_BAT_MS = 1400;

export interface JokerChatOverlaysProps {
  /** Account the Trust Scan should describe · usually the peer in
   *  the current peer-chat conversation. */
  scannedAccountId: string;
  /** Current viewer · drives the "Your relationship history" block
   *  in the Trust Scan. Null when the viewer is anonymous. */
  viewerAccountId: string | null;
  /** Trust Scan data source · defaults to the mock provider so the
   *  overlay can ship before the Phase 2 live-data audit lands.
   *  Pass `liveTrustScanProvider` once the DB queries are built. */
  trustScanProvider?: TrustScanProvider;
}

export function JokerChatOverlays({
  scannedAccountId,
  viewerAccountId,
  trustScanProvider = mockTrustScanProvider,
}: JokerChatOverlaysProps): React.JSX.Element {
  const [trustScanOpen, setTrustScanOpen] = React.useState(false);
  // Entry theatre · one-shot lightning + bat silhouette · scoped to
  // scannedAccountId so re-opening the same chat later in the session
  // doesn't retrigger (would feel like a bug, not atmosphere). Each
  // DIFFERENT peer gets its own entry moment.
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
  }, [scannedAccountId]);

  return (
    <>
      {/* Entry theatre · fires ONCE per peer-chat mount · lightning
          lands first (1.2s) and the bat silhouette rides out on the
          afterglow (1.4s). Both auto-unmount so the shell is quiet
          again by the time the user starts reading messages. */}
      {entryLightning && <JokerMotionOverlay variant="lightning" />}
      {entryBat && <JokerMotionOverlay variant="bat" />}
      <JokerController onOpenTrustScan={() => setTrustScanOpen(true)} />
      {trustScanOpen && (
        <TrustScan
          scannedAccountId={scannedAccountId}
          viewerAccountId={viewerAccountId}
          skin={NEX_TRUST_SCAN_SKIN}
          provider={trustScanProvider}
          onDismiss={() => setTrustScanOpen(false)}
        />
      )}
    </>
  );
}
