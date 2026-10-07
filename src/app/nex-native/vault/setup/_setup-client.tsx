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
import { useT } from "@/lib/nex/i18n/I18nProvider";
import type { I18nKey } from "@/lib/nex/i18n/keys";
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
  const t = useT();
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
    const key: I18nKey = (() => {
      switch (code) {
        case "already_configured":
          return "vault.setup.error.alreadyConfigured";
        case "device_not_registered":
          return "vault.setup.error.deviceNotRegistered";
        case "device_revoked":
          return "vault.setup.error.deviceRevoked";
        case "setup_insert_failed":
        case "envelope_insert_failed":
          return "vault.setup.error.saveFailed";
        default:
          return "vault.setup.error.generic";
      }
    })();
    return t(key);
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
          {t("vault.setup.brandChip")}
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
          {t("vault.setup.welcome.title")}
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
          {t("vault.setup.welcome.body")}
        </p>
        <button
          type="button"
          data-nex-vault-setup-start
          onClick={() => setStep("choose")}
          disabled={!deviceId}
          style={buttonStyle(skin, !!deviceId)}
        >
          {deviceId
            ? t("vault.setup.welcome.ctaReady")
            : t("vault.setup.welcome.ctaPreparing")}
        </button>
      </Container>
    );
  }

  if (step === "choose") {
    return (
      <Container>
        <h1 style={{ margin: "0 0 16px", fontSize: 22, textAlign: "center" }}>
          {t("vault.setup.choose.title")}
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
            <strong style={{ fontSize: 15 }}>
              {t("vault.setup.choose.pin.title")}
            </strong>
            <span
              style={{
                display: "block",
                fontSize: 12.5,
                marginTop: 4,
                color: skin.text.secondary,
              }}
            >
              {t("vault.setup.choose.pin.blurb")}
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
            <strong style={{ fontSize: 15 }}>
              {t("vault.setup.choose.passphrase.title")}
            </strong>
            <span
              style={{
                display: "block",
                fontSize: 12.5,
                marginTop: 4,
                color: skin.text.secondary,
              }}
            >
              {t("vault.setup.choose.passphrase.blurb")}
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
          {isPin ? t("vault.setup.pin.title") : t("vault.setup.passphrase.title")}
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
            ? t("vault.setup.pin.rangeHintTemplate")
                .replace("{min}", String(PIN_MIN_LENGTH))
                .replace("{max}", String(PIN_MAX_LENGTH))
            : t("vault.setup.passphrase.rangeHintTemplate").replace(
                "{min}",
                String(PASSPHRASE_MIN_LENGTH),
              )}
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
            placeholder={
              isPin
                ? t("vault.setup.pin.placeholder")
                : t("vault.setup.passphrase.placeholder")
            }
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
            placeholder={
              isPin
                ? t("vault.setup.pin.confirmPlaceholder")
                : t("vault.setup.passphrase.confirmPlaceholder")
            }
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
              {isPin
                ? t("vault.setup.pin.mismatch")
                : t("vault.setup.passphrase.mismatch")}
            </p>
          )}
          <button
            type="submit"
            data-nex-vault-create
            disabled={!canSubmit}
            style={buttonStyle(skin, canSubmit)}
          >
            {t("vault.setup.createCta")}
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
            {t("vault.setup.backBtn")}
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
          {t("vault.setup.workingMessage")}
        </p>
      </Container>
    );
  }

  return (
    <Container>
      <p data-nex-vault-setup-error style={{ color: skin.feedback.orange }}>
        {error ?? t("vault.setup.errorBannerDefault")}
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
