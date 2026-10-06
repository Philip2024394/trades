"use client";

// src/app/nex-native/vault/setup/_setup-client.tsx
//
// Vault Phase A · Commit A.3b · setup wizard client.
//
// Three steps · consumer-friendly language · all crypto in the browser.
//
//   1. Welcome ("Protect your Vault").
//   2. Choose mode (PIN · passphrase).
//   3. Enter + confirm · "Create Vault" → generate VMK → derive KEK →
//      wrap → POST /setup → navigate to /vault/home.
//
// Zero exposure of VMK / KEK / Argon2 / PRF / HKDF / envelope to the UI
// copy. The orchestrator handles the cryptographic flow.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { VaultDoorwaySkin } from "../_doorway-skin";
import {
  ensureDeviceKey,
  publicKeyBase64,
} from "@/lib/nex-native/crypto/device-key";
import { upsertDeviceKeyAction } from "@/app/nex-native/_actions";
import { setupVault } from "@/lib/nex-native/vault/client/unlock-orchestrator";
import {
  PIN_MIN_LENGTH,
  PIN_MAX_LENGTH,
} from "../_pin-entry-reducer";
import { PASSPHRASE_MIN_LENGTH } from "@/lib/nex-native/vault/key-hierarchy";

type Step = "welcome" | "choose" | "pin" | "passphrase" | "working" | "error";
type Mode = "pin" | "passphrase";

export function SetupClient({ skin }: { skin: VaultDoorwaySkin }) {
  const router = useRouter();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("welcome");
  const [mode, setMode] = useState<Mode>("pin");
  const [secret, setSecret] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Device bootstrap (same primitive as the locked shell).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const key = await ensureDeviceKey();
        const fd = new FormData();
        fd.set("device_id", key.deviceId);
        fd.set("public_key", publicKeyBase64(key.publicKey));
        await upsertDeviceKeyAction(fd);
        if (!cancelled) setDeviceId(key.deviceId);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "device_bootstrap_failed");
          setStep("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = (() => {
    if (step !== "pin" && step !== "passphrase") return false;
    if (secret !== confirm) return false;
    if (step === "pin") {
      return (
        /^\d+$/.test(secret) &&
        secret.length >= PIN_MIN_LENGTH &&
        secret.length <= PIN_MAX_LENGTH
      );
    }
    return secret.length >= PASSPHRASE_MIN_LENGTH;
  })();

  async function onCreate() {
    if (!deviceId || !canSubmit) return;
    setStep("working");
    setError(null);
    const result = await setupVault({ mode, secret, deviceId });
    if (result.ok) {
      router.push("/nex-native/vault/home");
      router.refresh();
    } else {
      setError(humaniseError(result.error));
      setStep(mode);
    }
  }

  function humaniseError(code: string): string {
    switch (code) {
      case "already_configured":
        return "Vault is already set up on this account.";
      case "device_not_registered":
        return "This device could not register with Vault. Please refresh and try again.";
      case "device_revoked":
        return "This device has been revoked. Sign in on another device.";
      case "setup_insert_failed":
      case "envelope_insert_failed":
        return "Vault setup could not be saved. Please try again.";
      default:
        return "Something went wrong. Please try again.";
    }
  }

  const Container = ({ children }: { children: React.ReactNode }) => (
    <main
      data-nex-vault-setup
      style={{
        minHeight: "100dvh",
        background: skin.bg.base,
        color: skin.text.primary,
        fontFamily: skin.font,
        padding: "32px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>{children}</div>
    </main>
  );

  if (step === "welcome") {
    return (
      <Container>
        <p
          data-nex-vault-brand
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: skin.text.brandChip,
            textAlign: "center",
          }}
        >
          NEX VAULT
        </p>
        <h1
          data-nex-vault-headline
          style={{
            margin: "20px 0 12px",
            fontSize: 24,
            fontWeight: 600,
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          Protect your Vault
        </h1>
        <p
          style={{
            margin: "0 0 32px",
            fontSize: 14.5,
            lineHeight: 1.55,
            color: skin.text.secondary,
            textAlign: "center",
          }}
        >
          Your Vault key is created on your device. NEX cannot read your
          protected Vault content.
        </p>
        <button
          type="button"
          data-nex-vault-setup-start
          onClick={() => setStep("choose")}
          disabled={!deviceId}
          style={buttonStyle(skin, !!deviceId)}
        >
          {deviceId ? "Set up Vault" : "Preparing…"}
        </button>
      </Container>
    );
  }

  if (step === "choose") {
    return (
      <Container>
        <h1 style={{ margin: "0 0 16px", fontSize: 22, textAlign: "center" }}>
          How do you want to unlock Vault?
        </h1>
        <div style={{ display: "grid", gap: 12, margin: "24px 0" }}>
          <button
            type="button"
            data-nex-vault-choose-pin
            onClick={() => {
              setMode("pin");
              setSecret("");
              setConfirm("");
              setStep("pin");
            }}
            style={optionStyle(skin)}
          >
            <strong style={{ fontSize: 15 }}>Use a PIN</strong>
            <span
              style={{
                display: "block",
                fontSize: 12.5,
                marginTop: 4,
                color: skin.text.secondary,
              }}
            >
              8–12 digits · fast to type on mobile
            </span>
          </button>
          <button
            type="button"
            data-nex-vault-choose-passphrase
            onClick={() => {
              setMode("passphrase");
              setSecret("");
              setConfirm("");
              setStep("passphrase");
            }}
            style={optionStyle(skin)}
          >
            <strong style={{ fontSize: 15 }}>Use a passphrase</strong>
            <span
              style={{
                display: "block",
                fontSize: 12.5,
                marginTop: 4,
                color: skin.text.secondary,
              }}
            >
              20+ characters · strongest protection
            </span>
          </button>
        </div>
      </Container>
    );
  }

  if (step === "pin" || step === "passphrase") {
    const isPin = step === "pin";
    return (
      <Container>
        <h1 style={{ margin: "0 0 12px", fontSize: 22, textAlign: "center" }}>
          {isPin ? "Choose your PIN" : "Choose your passphrase"}
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 13,
            textAlign: "center",
            color: skin.text.secondary,
          }}
        >
          {isPin
            ? `${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits. Keep it memorable.`
            : `${PASSPHRASE_MIN_LENGTH} or more characters.`}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onCreate();
          }}
          style={{ display: "grid", gap: 12 }}
        >
          <input
            type={isPin ? "tel" : "password"}
            inputMode={isPin ? "numeric" : "text"}
            autoComplete="new-password"
            data-nex-vault-secret-input
            value={secret}
            onChange={(e) =>
              setSecret(
                isPin
                  ? e.currentTarget.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH)
                  : e.currentTarget.value,
              )
            }
            placeholder={isPin ? "PIN" : "Passphrase"}
            style={inputStyle(skin)}
          />
          <input
            type={isPin ? "tel" : "password"}
            inputMode={isPin ? "numeric" : "text"}
            autoComplete="new-password"
            data-nex-vault-confirm-input
            value={confirm}
            onChange={(e) =>
              setConfirm(
                isPin
                  ? e.currentTarget.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH)
                  : e.currentTarget.value,
              )
            }
            placeholder={isPin ? "Confirm PIN" : "Confirm passphrase"}
            style={inputStyle(skin)}
          />
          {error && (
            <p
              data-nex-vault-setup-error
              style={{
                margin: 0,
                color: skin.feedback.orange,
                fontSize: 13,
                textAlign: "center",
              }}
            >
              {error}
            </p>
          )}
          {secret && confirm && secret !== confirm && (
            <p
              data-nex-vault-setup-mismatch
              style={{
                margin: 0,
                color: skin.feedback.orange,
                fontSize: 13,
                textAlign: "center",
              }}
            >
              {isPin ? "PINs don't match." : "Passphrases don't match."}
            </p>
          )}
          <button
            type="submit"
            data-nex-vault-create
            disabled={!canSubmit}
            style={buttonStyle(skin, canSubmit)}
          >
            Create Vault
          </button>
          <button
            type="button"
            onClick={() => {
              setSecret("");
              setConfirm("");
              setError(null);
              setStep("choose");
            }}
            style={{
              background: "none",
              color: skin.text.secondary,
              border: "none",
              fontSize: 13,
              padding: "8px 0",
              cursor: "pointer",
            }}
          >
            Back
          </button>
        </form>
      </Container>
    );
  }

  if (step === "working") {
    return (
      <Container>
        <p
          data-nex-vault-setup-working
          style={{ textAlign: "center", color: skin.text.secondary }}
        >
          Creating your Vault on this device…
        </p>
      </Container>
    );
  }

  return (
    <Container>
      <p data-nex-vault-setup-error style={{ color: skin.feedback.orange }}>
        {error ?? "Vault setup failed."}
      </p>
    </Container>
  );
}

function buttonStyle(skin: VaultDoorwaySkin, enabled: boolean): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
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

function optionStyle(skin: VaultDoorwaySkin): React.CSSProperties {
  return {
    width: "100%",
    textAlign: "left",
    padding: "16px 18px",
    background: skin.cells.bg,
    color: skin.text.primary,
    border: `1px solid ${skin.cells.border}`,
    borderRadius: 12,
    cursor: "pointer",
  };
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
