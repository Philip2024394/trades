"use client";

// src/app/nex-native/vault/settings/rotate/_rotate-client.tsx
//
// Vault Phase A · Commit A.5 · rotate Vault keys UI.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VaultDoorwaySkin } from "../../_doorway-skin";
import { useVaultSession } from "@/lib/nex-native/vault/client/vault-session";
import { rotateVault } from "@/lib/nex-native/vault/client/recovery-rotation";

interface Props {
  skin: VaultDoorwaySkin;
  currentGeneration: number;
  pinMode: "pin" | "passphrase";
  pinSaltHex: string;
  pinArgonParams: Record<string, unknown>;
  recoveryConfigured: boolean;
  recoverySaltHex: string | null;
  recoveryArgonParams: Record<string, unknown> | null;
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return new Uint8Array(0);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function RotateClient({
  skin,
  currentGeneration,
  pinMode,
  pinSaltHex,
  pinArgonParams,
  recoveryConfigured,
  recoverySaltHex,
  recoveryArgonParams,
}: Props) {
  const router = useRouter();
  const vault = useVaultSession();
  const [currentSecret, setCurrentSecret] = useState("");
  const [recoveryPassphrase, setRecoveryPassphrase] = useState("");
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpPassword, setStepUpPassword] = useState("");
  const [busy, setBusy] = useState<"step_up" | "rotate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ newGeneration: number } | null>(null);

  const canSubmit =
    currentSecret.length > 0 &&
    (!recoveryConfigured || recoveryPassphrase.length >= 20);

  async function doStepUp(): Promise<boolean> {
    if (!stepUpPassword) return false;
    setBusy("step_up");
    setError(null);
    try {
      const res = await fetch("/api/nex-native/vault/step-up/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: stepUpPassword }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setError(body.error === "wrong_password" ? "Wrong password." : "Verification failed.");
        return false;
      }
      setStepUpPassword("");
      return true;
    } finally {
      setBusy(null);
    }
  }

  async function completeRotate() {
    setBusy("rotate");
    setError(null);
    try {
      const result = await rotateVault({
        oldGeneration: currentGeneration,
        currentPin: currentSecret,
        pinMode,
        pinSalt: hexToBytes(pinSaltHex),
        pinArgonParams,
        recoveryPassphrase: recoveryConfigured ? recoveryPassphrase : undefined,
        recoverySalt: recoverySaltHex ? hexToBytes(recoverySaltHex) : undefined,
        recoveryArgonParams: recoveryArgonParams ?? undefined,
      });
      if (!result.ok) {
        setError(
          result.error === "generation_mismatch"
            ? "Vault was rotated elsewhere. Reload and try again."
            : result.error === "step_up_required"
              ? "Please verify your password first."
              : result.error === "vault_locked"
                ? "Unlock Vault first on this device."
                : "Vault could not be rotated right now.",
        );
      } else {
        setDone({ newGeneration: result.newGeneration });
      }
    } finally {
      setBusy(null);
    }
  }

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (!vault.unlocked) {
      setError("Unlock Vault first on this device.");
      return;
    }
    setStepUpOpen(true);
  }

  return (
    <main
      data-nex-vault-rotate
      style={{
        minHeight: "100dvh",
        background: skin.bg.base,
        color: skin.text.primary,
        fontFamily: skin.font,
        padding: "32px 20px",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <button
          type="button"
          onClick={() => router.push("/nex-native/vault/settings")}
          style={{
            background: "none",
            color: skin.text.secondary,
            border: "none",
            fontSize: 13,
            padding: "4px 0 16px",
            cursor: "pointer",
          }}
        >
          ← Back to Vault settings
        </button>

        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>
          Rotate Vault keys
        </h1>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 13.5,
            color: skin.text.secondary,
            lineHeight: 1.55,
          }}
        >
          This creates a brand-new Vault key on this device. Any other
          devices (including revoked ones) lose access to Vault&apos;s
          current contents. You will stay signed in and this device will
          stay unlocked.
        </p>

        {done ? (
          <div
            data-nex-vault-rotate-done
            style={{
              padding: "16px",
              borderRadius: 12,
              background: "rgba(100,200,120,0.08)",
              border: "1px solid rgba(100,200,120,0.4)",
              color: skin.text.primary,
              marginBottom: 20,
            }}
          >
            <p style={{ margin: 0, fontWeight: 600 }}>Vault keys rotated.</p>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 13,
                color: skin.text.secondary,
              }}
              data-nex-vault-rotate-generation={done.newGeneration}
            >
              Your other devices now need to be authorised again from
              this one before they can unlock Vault.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <p
                data-nex-vault-rotate-error
                style={{
                  padding: "12px 14px",
                  marginBottom: 16,
                  borderRadius: 10,
                  background: "rgba(255,138,42,0.08)",
                  border: "1px solid rgba(255,138,42,0.4)",
                  color: skin.feedback.orange,
                  fontSize: 13.5,
                }}
              >
                {error}
              </p>
            )}

            <form onSubmit={onConfirm} style={{ display: "grid", gap: 10 }}>
              <label style={labelStyle(skin)}>
                Current {pinMode === "pin" ? "PIN" : "passphrase"}
              </label>
              <input
                type={pinMode === "pin" ? "tel" : "password"}
                inputMode={pinMode === "pin" ? "numeric" : "text"}
                data-nex-vault-rotate-current
                autoComplete="current-password"
                value={currentSecret}
                onChange={(e) =>
                  setCurrentSecret(
                    pinMode === "pin"
                      ? e.currentTarget.value.replace(/\D/g, "").slice(0, 12)
                      : e.currentTarget.value,
                  )
                }
                style={inputStyle(skin)}
              />
              {recoveryConfigured && (
                <>
                  <label style={labelStyle(skin)}>
                    Recovery passphrase
                  </label>
                  <input
                    type="password"
                    data-nex-vault-rotate-recovery
                    autoComplete="current-password"
                    value={recoveryPassphrase}
                    onChange={(e) => setRecoveryPassphrase(e.currentTarget.value)}
                    placeholder="Your current recovery passphrase"
                    style={inputStyle(skin)}
                  />
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 11.5,
                      color: skin.text.secondary,
                    }}
                  >
                    Required so your recovery option still works after
                    rotation.
                  </p>
                </>
              )}
              <button
                type="submit"
                data-nex-vault-rotate-confirm
                disabled={!canSubmit || !vault.unlocked || busy !== null}
                style={buttonStyle(
                  skin,
                  canSubmit && vault.unlocked && busy === null,
                )}
              >
                {busy === "rotate" ? "Rotating keys…" : "Rotate Vault keys"}
              </button>
            </form>
          </>
        )}

        {stepUpOpen && (
          <div
            data-nex-vault-rotate-stepup
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              zIndex: 100,
            }}
          >
            <div
              style={{
                background: skin.bg.base,
                border: `1px solid ${skin.cells.border}`,
                borderRadius: 16,
                padding: 24,
                maxWidth: 420,
                width: "100%",
              }}
            >
              <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>
                Please verify it&apos;s really you
              </h2>
              <p
                style={{
                  margin: "0 0 16px",
                  fontSize: 13.5,
                  color: skin.text.secondary,
                }}
              >
                Enter your NEX password before rotating Vault keys.
              </p>
              <input
                type="password"
                data-nex-vault-rotate-stepup-password
                autoComplete="current-password"
                value={stepUpPassword}
                onChange={(e) => setStepUpPassword(e.currentTarget.value)}
                placeholder="Password"
                style={inputStyle(skin)}
              />
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 16,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setStepUpOpen(false);
                    setStepUpPassword("");
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    background: "transparent",
                    border: `1px solid ${skin.cells.border}`,
                    color: skin.text.primary,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-nex-vault-rotate-stepup-confirm
                  disabled={!stepUpPassword || busy === "step_up"}
                  onClick={async () => {
                    const ok = await doStepUp();
                    if (ok) {
                      setStepUpOpen(false);
                      await completeRotate();
                    }
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    background: skin.text.brandChip,
                    color: skin.text.primary,
                    fontSize: 13,
                    fontWeight: 600,
                    border: "none",
                    cursor: stepUpPassword ? "pointer" : "default",
                    opacity: stepUpPassword ? 1 : 0.5,
                  }}
                >
                  {busy === "step_up" ? "Verifying…" : "Verify"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function inputStyle(skin: VaultDoorwaySkin): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    background: skin.cells.bg,
    border: `1px solid ${skin.cells.border}`,
    borderRadius: 12,
    color: skin.text.primary,
    fontSize: 16,
    fontFamily: skin.font,
  };
}

function labelStyle(skin: VaultDoorwaySkin): React.CSSProperties {
  return {
    fontSize: 12,
    letterSpacing: "0.02em",
    color: skin.text.secondary,
  };
}

function buttonStyle(skin: VaultDoorwaySkin, enabled: boolean): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    marginTop: 10,
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
