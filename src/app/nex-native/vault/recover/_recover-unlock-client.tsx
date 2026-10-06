"use client";

// src/app/nex-native/vault/recover/_recover-unlock-client.tsx
//
// Vault Phase A · Commit A.5 · recovery-unlock client (locked Vault,
// signed-in user, used instead of PIN).

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VaultDoorwaySkin } from "../_doorway-skin";
import { unlockWithRecovery } from "@/lib/nex-native/vault/client/recovery-rotation";
import { PASSPHRASE_MIN_LENGTH } from "@/lib/nex-native/vault/key-hierarchy";

export function RecoverUnlockClient({
  skin,
  recoveryConfigured,
}: {
  skin: VaultDoorwaySkin;
  recoveryConfigured: boolean;
}) {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState<{
    retryAfterSeconds: number;
  } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (passphrase.length < PASSPHRASE_MIN_LENGTH) return;
    setBusy(true);
    setError(null);
    const result = await unlockWithRecovery({ passphrase });
    if (result.ok) {
      router.push("/nex-native/vault/home");
      router.refresh();
      return;
    }
    if (result.rateLimited) {
      setRateLimited({ retryAfterSeconds: result.retryAfterSeconds ?? 86400 });
      setError(null);
    } else {
      setError(
        result.error === "wrong_passphrase"
          ? "That passphrase didn't work."
          : result.error === "recovery_not_configured"
            ? "Recovery isn't set up for this Vault."
            : "Vault could not be recovered right now.",
      );
    }
    setBusy(false);
  }

  if (!recoveryConfigured) {
    return (
      <main
        data-nex-vault-recover-missing
        style={containerStyle(skin)}
      >
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
          <p data-nex-vault-brand style={brandStyle(skin)}>NEX VAULT</p>
          <h1 style={{ margin: "20px 0 12px", fontSize: 22 }}>
            Recovery isn&apos;t set up yet
          </h1>
          <p
            style={{
              margin: "0 0 20px",
              fontSize: 14,
              lineHeight: 1.55,
              color: skin.text.secondary,
            }}
          >
            NEX cannot recover your Vault for you. You can set up a
            recovery passphrase from Vault Settings while Vault is
            unlocked on another device.
          </p>
          <button
            type="button"
            onClick={() => router.push("/nex-native/vault")}
            style={buttonStyle(skin, true)}
          >
            Back to Vault
          </button>
        </div>
      </main>
    );
  }

  return (
    <main data-nex-vault-recover style={containerStyle(skin)}>
      <form onSubmit={onSubmit} style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <p data-nex-vault-brand style={brandStyle(skin)}>NEX VAULT</p>
        <h1 style={{ margin: "20px 0 12px", fontSize: 22 }}>
          Recover your Vault
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 14.5,
            lineHeight: 1.55,
            color: skin.text.secondary,
          }}
        >
          Enter your recovery passphrase to unlock Vault on this device.
        </p>
        <input
          type="password"
          data-nex-vault-recover-pass
          autoComplete="current-password"
          placeholder="Recovery passphrase"
          value={passphrase}
          onChange={(e) => setPassphrase(e.currentTarget.value)}
          disabled={busy || rateLimited !== null}
          style={{
            width: "100%",
            padding: "14px 16px",
            background: skin.cells.bg,
            border: `1px solid ${skin.cells.border}`,
            borderRadius: 12,
            color: skin.text.primary,
            fontSize: 16,
            fontFamily: skin.font,
            textAlign: "center",
          }}
        />
        {rateLimited && (
          <p
            data-nex-vault-recover-rate
            style={{
              margin: "16px 0 0",
              fontSize: 13,
              color: skin.feedback.muted,
            }}
          >
            Too many attempts. Try again later.
          </p>
        )}
        {error && (
          <p
            data-nex-vault-recover-error
            style={{
              margin: "16px 0 0",
              fontSize: 13,
              color: skin.feedback.orange,
            }}
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          data-nex-vault-recover-submit
          disabled={
            passphrase.length < PASSPHRASE_MIN_LENGTH ||
            busy ||
            rateLimited !== null
          }
          style={buttonStyle(
            skin,
            passphrase.length >= PASSPHRASE_MIN_LENGTH && !busy && rateLimited === null,
          )}
        >
          {busy ? "Recovering…" : "Unlock Vault"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/nex-native/vault")}
          style={{
            marginTop: 12,
            background: "none",
            color: skin.text.secondary,
            border: "none",
            fontSize: 13,
            padding: "8px 0",
            cursor: "pointer",
          }}
        >
          Back to PIN unlock
        </button>
      </form>
    </main>
  );
}

function containerStyle(skin: VaultDoorwaySkin): React.CSSProperties {
  return {
    minHeight: "100dvh",
    background: skin.bg.base,
    color: skin.text.primary,
    fontFamily: skin.font,
    padding: "32px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function brandStyle(skin: VaultDoorwaySkin): React.CSSProperties {
  return {
    margin: 0,
    fontSize: 11,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: skin.text.brandChip,
  };
}

function buttonStyle(skin: VaultDoorwaySkin, enabled: boolean): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    marginTop: 20,
    padding: "14px 20px",
    borderRadius: 12,
    border: "none",
    background: enabled ? skin.text.brandChip : skin.cells.borderMuted,
    color: skin.text.primary,
    fontSize: 15,
    fontWeight: 600,
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.6,
  };
}
