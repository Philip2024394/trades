// src/components/nex-native/family-safety/VerificationStatusChip.tsx
//
// NEX Family Safety · verification state chip · authored 2026-10-10.
// ------------------------------------------------------------------
// Maps a `ChildCreationState` to a user-facing label + a sealed
// `StatusChip` tone. The chip is the single visual element on the
// status page that the parent will anchor on.
//
// Load-bearing anti-patterns:
//   · Do NOT invent new states here · they must come from
//     `ChildCreationState`. Adding a UI-only state would drift from
//     the server contract.
//   · Do NOT recolour the "awaiting_legal_clearance" tone away from
//     pending/amber. The legal clearance banner uses the same tone,
//     which is deliberate.

import * as React from "react";
import { StatusChip } from "./StatusChip";
import type { StatusChipTone } from "./types";
import type { ChildCreationStateUi as ChildCreationState } from "@/lib/nex-native/family-safety/child-account-creation/ui-tokens";

interface Presentation {
  readonly tone: StatusChipTone;
  readonly label: string;
}

const MAP: Readonly<Record<ChildCreationState, Presentation>> = {
  draft: { tone: "neutral", label: "Draft" },
  id_pending_verification: { tone: "pending", label: "Verifying ID" },
  id_verified: { tone: "info", label: "ID verified" },
  id_rejected: { tone: "revoked", label: "ID rejected" },
  awaiting_legal_clearance: {
    tone: "pending",
    label: "Awaiting legal clearance",
  },
  account_created: { tone: "active", label: "Account created" },
  cancelled: { tone: "expired", label: "Cancelled" },
  expired: { tone: "expired", label: "Expired" },
};

export interface VerificationStatusChipProps {
  readonly state: ChildCreationState;
  readonly testId?: string;
}

export function VerificationStatusChip({
  state,
  testId,
}: VerificationStatusChipProps): React.JSX.Element {
  const p = MAP[state];
  return (
    <StatusChip
      tone={p.tone}
      label={p.label}
      testId={testId ?? `nex-family-safety-verification-chip-${state}`}
    />
  );
}
