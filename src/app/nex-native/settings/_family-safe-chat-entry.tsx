// src/app/nex-native/settings/_family-safe-chat-entry.tsx
//
// NEX Settings · Family SafeChat entry section · authored 2026-10-10.
// -------------------------------------------------------------------
// Lives BELOW the sealed EmergencyHelpEntry and BELOW the sealed 7-
// group `SETTINGS_GROUPS` list (or wherever the Settings landing
// chooses to call it — the current call-site is above the groups
// grid, consistent with the sealed Emergency entry pattern).
//
// Scope boundary: this file is a THIN wrapper around the shared
// FamilySafeChatEntryCard. It:
//   · reads the sealed `isFamilySafetyEnabled` feature flag
//   · renders the entry card ONLY when the flag is TRUE
//   · surfaces a short section label so the entry doesn't look like
//     a stray row
//
// If the flag is OFF, this component renders NOTHING (not even a
// placeholder) · the sealed 7-group SETTINGS_GROUPS structure
// remains unchanged.
//
// Load-bearing anti-patterns:
//   · Do NOT fold this into `_sections.ts` · that would break the
//     7-group seal in `_settings-ia.test.ts`.
//   · Do NOT re-implement the entry card here · reuse the shared
//     primitive.

import * as React from "react";
import { FamilySafeChatEntryCard } from "@/components/nex-native/family-safety/FamilySafeChatEntryCard";
import { isFamilySafetyEnabled } from "@/lib/nex-native/family-safety/feature-flag";

const NEX_SETTINGS_TEXT_SECONDARY = "#7D9BC0";

export function FamilySafeChatEntry(): React.JSX.Element | null {
  if (!isFamilySafetyEnabled()) return null;
  return (
    <section
      data-nex-settings-family-safe-chat-wrap="true"
      aria-label="Family Safety"
      style={{ marginTop: 22, marginBottom: 10 }}
    >
      <div
        style={{
          margin: "0 2px 8px",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: NEX_SETTINGS_TEXT_SECONDARY,
        }}
      >
        Family Safety
      </div>
      <FamilySafeChatEntryCard />
    </section>
  );
}
