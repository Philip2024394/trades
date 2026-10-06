"use client";

// src/app/nex-native/vault/settings/recovery/_recovery-client.tsx
//
// Vault Phase A · Commit A.5 · recovery setup UI (Device A, unlocked).

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VaultDoorwaySkin } from "../../_doorway-skin";
import { useVaultSession } from "@/lib/nex-native/vault/client/vault-session";
import { setupRecovery } from "@/lib/nex-native/vault/client/recovery-rotation";
import { PASSPHRASE_MIN_LENGTH } from "@/lib/nex-native/vault/key-hierarchy";

export function RecoveryClient({
  skin,
  configuredAt,
}: {
  skin: VaultDoorwaySkin;
  configuredAt: string | null;
}) {
  const router = useRouter();
  const vault = useVaultSession();
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpPassword, setStepUpPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<"step_up" | "setup" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canSubmit =
    passphrase === confirm &&
    passphrase.length >= PASSPHRASE_MIN_LENGTH;

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

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (!vault.unlocked) {
      setError("Unlock Vault first on this device.");
      return;
    }
    setStepUpOpen(true);
  }

  async function completeSave() {
    setBusy("setup");
    setError(null);
    try {
      const result = await setupRecovery({ passphrase });
      if (!result.ok) {
        setError(
          result.error === "step_up_required"
            ? "Please verify your password first."
            : "Could not save your recovery passphrase.",
        );
      } else {
        setNotice(
          configuredAt
            ? "Your recovery passphrase was updated."
            : "Your recovery passphrase is ready.",
        );
        setPassphrase("");
        setConfirm("");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <main
      data-nex-vault-recovery
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
          Recovery passphrase
        </h1>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 13.5,
            color: skin.text.secondary,
            lineHeight: 1.55,
          }}
        >
          If you lose access to every device, you can unlock Vault with
          this passphrase. Write it down somewhere safe. NEX cannot
          recover it for you.
        </p>

        {configuredAt && (
          <p
            data-nex-vault-recovery-current
            style={{
              padding: "10px 14px",
              marginBottom: 16,
              borderRadius: 10,
              background: "rgba(255,138,42,0.08)",
              border: `1px solid ${skin.cells.border}`,
              color: skin.text.secondary,
              fontSize: 12.5,
            }}
          >
            Recovery is set up for this Vault. Saving a new passphrase
            replaces the previous one.
          </p>
        )}

        {!vault.unlocked && (
          <p
            data-nex-vault-recovery-locked
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
            Vault is locked. Unlock Vault on this device first.
          </p>
        )}

        {error && (
          <p
            data-nex-vault-recovery-error
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
        {notice && (
          <p
            data-nex-vault-recovery-notice
            style={{
              padding: "12px 14px",
              marginBottom: 16,
              borderRadius: 10,
              background: "rgba(100,200,120,0.08)",
              border: "1px solid rgba(100,200,120,0.4)",
              color: skin.text.primary,
              fontSize: 13.5,
            }}
          >
            {notice}
          </p>
        )}

        <form onSubmit={onSave} style={{ display: "grid", gap: 10 }}>
          <input
            type="password"
            data-nex-vault-recovery-pass
            autoComplete="new-password"
            placeholder="Recovery passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.currentTarget.value)}
            style={inputStyle(skin)}
          />
          <input
            type="password"
            data-nex-vault-recovery-confirm
            autoComplete="new-password"
            placeholder="Confirm passphrase"
            value={confirm}
            onChange={(e) => setConfirm(e.currentTarget.value)}
            style={inputStyle(skin)}
          />
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 11.5,
              color: skin.text.secondary,
            }}
          >
            Minimum {PASSPHRASE_MIN_LENGTH} characters.
          </p>
          <button
            type="submit"
            data-nex-vault-recovery-save
            disabled={!canSubmit || !vault.unlocked || busy !== null}
            style={{
              display: "block",
              marginTop: 12,
              padding: "14px 20px",
              borderRadius: 12,
              border: "none",
              background:
                canSubmit && vault.unlocked && busy === null
                  ? skin.text.brandChip
                  : skin.cells.borderMuted,
              color: skin.text.primary,
              fontSize: 15,
              fontWeight: 600,
              cursor:
                canSubmit && vault.unlocked && busy === null
                  ? "pointer"
                  : "default",
              opacity: canSubmit && vault.unlocked && busy === null ? 1 : 0.6,
            }}
          >
            {busy === "setup"
              ? "Saving…"
              : configuredAt
                ? "Replace recovery passphrase"
                : "Save recovery passphrase"}
          </button>
        </form>

        {stepUpOpen && (
          <div
            data-nex-vault-recovery-stepup
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
                Enter your NEX password before saving a recovery passphrase.
              </p>
              <input
                type="password"
                data-nex-vault-recovery-stepup-password
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
                  data-nex-vault-recovery-stepup-confirm
                  disabled={!stepUpPassword || busy === "step_up"}
                  onClick={async () => {
                    const ok = await doStepUp();
                    if (ok) {
                      setStepUpOpen(false);
                      await completeSave();
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
