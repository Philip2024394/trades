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
import { Lock } from "lucide-react";
import { lockVault } from "@/lib/nex-native/vault/client/unlock-orchestrator";
import { useVaultSession } from "@/lib/nex-native/vault/client/vault-session";
import { useT } from "@/lib/nex/i18n/I18nProvider";

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

  return (
    <button
      type="button"
      data-nex-vault-lock-now
      onClick={onLock}
      disabled={busy}
      aria-label={t("vault.home.lockBtn.unlocked")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        borderRadius: 999,
        background: "rgba(255, 138, 42, 0.12)",
        border: "1px solid rgba(255, 138, 42, 0.45)",
        color: "#FFC58A",
        fontSize: 12.5,
        letterSpacing: "0.01em",
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.6 : 1,
      }}
    >
      <Lock size={14} />
      <span>
        {session.unlocked
          ? t("vault.home.lockBtn.unlocked")
          : t("vault.home.lockBtn.locked")}
      </span>
    </button>
  );
}
