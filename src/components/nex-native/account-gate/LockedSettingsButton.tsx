"use client";

// src/components/nex-native/account-gate/LockedSettingsButton.tsx
//
// NEX Settings Header · Locked Settings Button wrapper.
// -----------------------------------------------------------------------
// Sealed 2026-10-10.
//
// Rendered by the shared NEX page header when
// `readAccountExists().accountExists === false`. Owns the local
// prompt-open state and the ref used to restore focus on dismiss.
//
// This component is a <button>, NOT a <Link> · it must NOT navigate
// to /nex-native/settings when clicked. Instead it opens the sealed
// `CreateAccountPrompt` modal which routes to the canonical onboarding
// entry (`/nex-native/create-account`).

import * as React from "react";
import { LockedSettingsIcon } from "./LockedSettingsIcon";
import { CreateAccountPrompt, type CreateAccountPromptVariant } from "./CreateAccountPrompt";

export interface LockedSettingsButtonProps {
  readonly variant: CreateAccountPromptVariant;
  readonly buttonStyle?: React.CSSProperties;
}

export function LockedSettingsButton({
  variant,
  buttonStyle,
}: LockedSettingsButtonProps) {
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);

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
        style={buttonStyle}
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
