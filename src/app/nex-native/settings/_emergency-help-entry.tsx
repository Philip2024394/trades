// src/app/nex-native/settings/_emergency-help-entry.tsx
//
// NEX Settings · pinned Emergency Help entry · sealed 2026-10-10.
// ----------------------------------------------------------------
// Lives ABOVE the sealed 7-group `SETTINGS_GROUPS` list. The Emergency
// Help feature is NOT folded into the IA groups because:
//   · The IA tests seal groups at exactly 7 (`_settings-ia.test.ts`).
//   · Emergency Help is visually distinct · a settings row would blend.
//   · The owner's safety entry must sit above every other setting.
//
// This file is a thin server-component wrapper that mounts the shared
// `EmergencyHelpEntryCard` client component (needed for the pulse
// animation style tag).

import * as React from "react";
import { EmergencyHelpEntryCard } from "@/components/nex-native/emergency/EmergencyHelpEntryCard";

export function EmergencyHelpEntry(): React.JSX.Element {
  return (
    <div
      data-nex-settings-emergency-wrap="true"
      style={{ marginBottom: 18 }}
    >
      <EmergencyHelpEntryCard />
    </div>
  );
}
