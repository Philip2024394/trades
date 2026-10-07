"use client";

// src/app/nex-native/vault/home/_lock-button-client.tsx
//
// Vault Phase A · Commit A.3b · "Lock Vault Now" primary control.
//
// Design §G.2 primacy: this is the authoritative user-initiated lock
// control. Idle/visibility timers are safety nets · beforeunload is
// not a security boundary. Click → clear VMK locally + POST /lock + nav.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { lockVault } from "@/lib/nex-native/vault/client/unlock-orchestrator";
import { useVaultSession } from "@/lib/nex-native/vault/client/vault-session";
import { useT } from "@/lib/nex/i18n/I18nProvider";
import { NEX } from "./_palette";

export function LockVaultNowButton() {
  const t = useT();
  const router = useRouter();
  const session = useVaultSession();
  const [busy, setBusy] = useState(false);

  async function onLock() {
    if (busy) return;
    setBusy(true);
    await lockVault();
    router.push("/nex-native/vault");
    router.refresh();
  }

  // Master-pass 2026-10-07 · colour semantics now match the NEX
  // visual system:
  //   · UNLOCKED · button is a cyan "secure" chip · tells the user
  //     the Vault is open and the action will protect it.
  //   · LOCKED   · button becomes a cyan ghost pill with the
  //     closed-lock icon · communicates "Vault is currently locked"
  //     without pretending to be an action.
  const isUnlocked = session.unlocked;
  const chipBg = isUnlocked ? NEX.secureSoft : "transparent";
  const chipBorder = isUnlocked ? NEX.secureStrong : NEX.glassBorderStrong;
  const chipFg = isUnlocked ? NEX.secure : NEX.textSecondary;

  return (
    <button
      type="button"
      data-nex-vault-lock-now
      data-nex-vault-lock-state={isUnlocked ? "unlocked" : "locked"}
      onClick={onLock}
      disabled={busy || !isUnlocked}
      aria-label={
        isUnlocked
          ? t("vault.home.lockBtn.unlocked")
          : t("vault.home.lockBtn.locked")
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        borderRadius: 999,
        background: chipBg,
        border: `1px solid ${chipBorder}`,
        color: chipFg,
        fontSize: 12.5,
        letterSpacing: "0.01em",
        fontFamily: "inherit",
        cursor: busy || !isUnlocked ? "default" : "pointer",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {isUnlocked ? (
        <Unlock size={14} strokeWidth={1.8} aria-hidden />
      ) : (
        <Lock size={14} strokeWidth={1.8} aria-hidden />
      )}
      <span>
        {isUnlocked
          ? t("vault.home.lockBtn.unlocked")
          : t("vault.home.lockBtn.locked")}
      </span>
    </button>
  );
}
