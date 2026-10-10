"use client";

// src/components/nex-native/account-gate/SettingsHeaderSlot.tsx
//
// NEX Settings Header · Settings-button slot (client component).
// -----------------------------------------------------------------------
// Sealed 2026-10-10.
//
// Rendered inside the shared `NexPageHeader`. Two render states:
//
//   · LOCKED (default on first paint)
//        <button> with the 3D LockedSettingsIcon · tap opens the
//        CreateAccountPrompt modal · variant "anonymous" until the
//        probe resolves.
//
//   · UNLOCKED
//        <a href="/nex-native/settings"> with the standard GearIcon ·
//        preserves today's behaviour for signed-in users with a
//        nex_account row.
//
// Why a client component (not a Server Component prop-drill):
//   NexPageHeader is imported by at least one `"use client"` consumer
//   today (`src/app/nex-native/calls/_calls-client.tsx`). Making the
//   header async + importing `server-only` would break that client
//   module's bundle. Instead we keep the header sync and let this
//   slot fetch its state from `/api/nex/account-gate/exists`.
//
// Load-bearing invariants:
//   · First paint is ALWAYS the locked state · the lock IS the gate.
//     Clients that never hydrate (noscript) still see a visible,
//     tappable gated button — tapping takes them to the onboarding
//     flow via the modal CTA (which also degrades to a link).
//   · The slot is ALWAYS visible · never conditionally rendered to
//     null. Hiding would make the gate invisible.
//   · Fetch error → stay locked. The user retains the "create account"
//     path. Never silently reveal Settings.

import * as React from "react";
import Link from "next/link";
import { LockedSettingsIcon } from "./LockedSettingsIcon";
import { CreateAccountPrompt, type CreateAccountPromptVariant } from "./CreateAccountPrompt";

export interface SettingsHeaderSlotProps {
  /** Visual style used by the sibling icons in the header. */
  readonly iconLinkStyle: React.CSSProperties;
  /** Override the probe endpoint (tests). */
  readonly probeHref?: string;
}

interface GateSnapshot {
  accountExists: boolean;
  signedInWithoutAccount: boolean;
}

const DEFAULT_PROBE = "/api/nex/account-gate/exists";

export function SettingsHeaderSlot({
  iconLinkStyle,
  probeHref = DEFAULT_PROBE,
}: SettingsHeaderSlotProps) {
  const [snap, setSnap] = React.useState<GateSnapshot | null>(null);
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(probeHref, {
      credentials: "include",
      cache: "no-store",
      headers: { accept: "application/json" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: GateSnapshot | null) => {
        if (cancelled || !data) return;
        setSnap({
          accountExists: Boolean(data.accountExists),
          signedInWithoutAccount: Boolean(data.signedInWithoutAccount),
        });
      })
      .catch(() => {
        /* fail-safe · remain locked */
      });
    return () => {
      cancelled = true;
    };
  }, [probeHref]);

  const accountExists = snap?.accountExists === true;
  const variant: CreateAccountPromptVariant =
    snap?.signedInWithoutAccount === true ? "signed_in_no_account" : "anonymous";

  if (accountExists) {
    return (
      <Link
        href="/nex-native/settings"
        aria-label="Settings"
        data-testid="nex-settings-button"
        data-nex-page-header-settings
        data-nex-settings-locked="false"
        style={iconLinkStyle}
      >
        <GearIcon />
      </Link>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Settings · account required"
        data-testid="nex-settings-button"
        data-nex-page-header-settings
        data-nex-settings-locked="true"
        data-nex-settings-locked-variant={variant}
        style={{ ...iconLinkStyle, cursor: "pointer" }}
      >
        <LockedSettingsIcon />
      </button>
      <CreateAccountPrompt
        open={open}
        variant={variant}
        onClose={() => setOpen(false)}
        returnFocusRef={btnRef}
      />
    </>
  );
}

// Local copy of the gear icon · intentionally duplicates the SVG from
// `_page-header.tsx` so this client component has zero dependency on
// the server header module beyond the shared style prop.
function GearIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
