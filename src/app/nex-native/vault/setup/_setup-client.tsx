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

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { VaultDoorwaySkin } from "../_doorway-skin";
import { useT } from "@/lib/nex/i18n/I18nProvider";
import type { I18nKey } from "@/lib/nex/i18n/keys";
import { NEX as NEX_PALETTE } from "../home/_palette";
import {
  ensureDeviceKey,
  publicKeyBase64,
} from "@/lib/nex-native/crypto/device-key";
import { upsertDeviceKeyAction } from "@/app/nex-native/_actions";
import { setupVault, lockVault } from "@/lib/nex-native/vault/client/unlock-orchestrator";
import { lockVaultEverywhere } from "@/lib/nex-native/vault/client/lock-sweep";
import {
  PIN_MIN_LENGTH,
  PIN_MAX_LENGTH,
} from "../_pin-entry-reducer";
import { PASSPHRASE_MIN_LENGTH } from "@/lib/nex-native/vault/key-hierarchy";

const SETUP_BG_WELCOME = "/nex-vault/setup-background.png";
const SETUP_BG_CHOOSE = "/nex-vault/setup-choose-background.png";

function backgroundForStep(step: Step): string {
  // Welcome keeps the first vault art · every post-welcome step
  // (choose + PIN/passphrase + working + error) uses the second.
  return step === "welcome" ? SETUP_BG_WELCOME : SETUP_BG_CHOOSE;
}

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
  // Home-icon flow · clicking the vault-setup home icon locks the
  // Vault locally, shows a 3-second "Locking Vault" overlay, then
  // navigates to the main NEX home. The actual lock calls are safe
  // during setup · lockVault / lockVaultEverywhere are idempotent
  // no-ops when the Vault VMK isn't held in memory yet.
  const [isLocking, setIsLocking] = useState(false);
  const handleHomeLockAndLeave = useCallback(() => {
    if (isLocking) return;
    setIsLocking(true);
    try {
      lockVaultEverywhere();
    } catch { /* idempotent · no-op if nothing to lock */ }
    void lockVault().catch(() => undefined);
    window.setTimeout(() => {
      router.push("/nex-native/home");
    }, 3000);
  }, [isLocking, router]);

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
      data-nex-vault-setup-step={step}
      style={{
        position: "relative",
        minHeight: "100dvh",
        color: NEX_PALETTE.textPrimary,
        fontFamily: NEX_PALETTE.sans,
        // Fullscreen hero · Vault art fills the viewport · deep NEX
        // navy base behind the gradient so the first-paint is on
        // brand even before the PNG decodes.
        backgroundColor: NEX_PALETTE.bg,
        backgroundImage: [
          "linear-gradient(180deg, rgba(2,9,20,0.52) 0%, rgba(2,9,20,0.82) 55%, rgba(2,9,20,0.96) 100%)",
          `url("${backgroundForStep(step)}")`,
        ].join(", "),
        backgroundSize: "cover, cover",
        backgroundPosition: "center top, center top",
        backgroundRepeat: "no-repeat, no-repeat",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <VaultSetupHeader
        onHome={handleHomeLockAndLeave}
        onSettings={() => router.push("/nex-native/vault/settings")}
        t={t}
      />
      {isLocking ? <LockingVaultOverlay t={t} /> : null}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 24px 48px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 420 }}>{children}</div>
      </div>
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

// ─── Vault setup header ────────────────────────────────────────────
// Mounted on every setup step · sticky top with a subtle dark fade
// so the Vault art reads through the header on first paint. Left ·
// NEX VAULT wordmark (brand continuity · NEX orange "X" style).
// Right · three circular NEX-styled icons · Home (triggers the
// lock-and-leave flow) · Lock indicator (purely decorative on
// setup) · Settings (routes to /vault/settings).

function VaultSetupHeader({
  onHome,
  onSettings,
  t,
}: {
  onHome: () => void;
  onSettings: () => void;
  t: (k: I18nKey) => string;
}): React.JSX.Element {
  return (
    <header
      data-nex-vault-setup-header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 20px",
        background:
          "linear-gradient(180deg, rgba(2,9,20,0.72) 0%, rgba(2,9,20,0) 100%)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <span
        data-nex-vault-setup-brand
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 6,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: NEX_PALETTE.textPrimary,
        }}
      >
        <span style={{ color: NEX_PALETTE.accent }}>NEX</span>
        <span>VAULT</span>
      </span>
      <nav
        aria-label={t("vault.setup.header.settingsLabel")}
        style={{ display: "flex", alignItems: "center", gap: 10 }}
      >
        <VaultHeaderIcon
          onClick={onHome}
          label={t("vault.setup.header.homeLabel")}
          data-nex-vault-setup-home
        >
          <HomeGlyph />
        </VaultHeaderIcon>
        <VaultHeaderIcon
          as="div"
          aria-hidden
          label={t("vault.setup.header.lockIndicator")}
          data-nex-vault-setup-lock-indicator
        >
          <LockGlyph />
        </VaultHeaderIcon>
        <VaultHeaderIcon
          onClick={onSettings}
          label={t("vault.setup.header.settingsLabel")}
          data-nex-vault-setup-settings
        >
          <GearGlyph />
        </VaultHeaderIcon>
      </nav>
    </header>
  );
}

function VaultHeaderIcon({
  as,
  onClick,
  label,
  children,
  ...rest
}: {
  as?: "button" | "div";
  onClick?: () => void;
  label: string;
  children: React.ReactNode;
} & Record<`data-${string}`, string | boolean | undefined>): React.JSX.Element {
  const Tag = (as ?? "button") as "button" | "div";
  const sharedStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 999,
    border: `1px solid ${NEX_PALETTE.secureStrong}`,
    background: "transparent",
    color: NEX_PALETTE.secure,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: Tag === "button" ? "pointer" : "default",
    padding: 0,
    fontFamily: "inherit",
  };
  if (Tag === "div") {
    return (
      <div aria-label={label} title={label} style={sharedStyle} {...rest}>
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={sharedStyle}
      {...rest}
    >
      {children}
    </button>
  );
}

function HomeGlyph(): React.JSX.Element {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function GearGlyph(): React.JSX.Element {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function LockGlyph(): React.JSX.Element {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

// ─── Center-screen "Locking Vault" overlay ─────────────────────────
// Fullscreen dim overlay · large pulsing LOCKING VAULT text + cyan
// lock icon snapping closed with a cyan protection ring. Displays
// for 3 seconds · the caller handles the subsequent router.push.
// The overlay itself is purely visual · the actual lock side-effects
// fire before the overlay appears.

function LockingVaultOverlay({ t }: { t: (k: I18nKey) => string }): React.JSX.Element {
  return (
    <div
      data-nex-vault-locking-overlay
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        background: "rgba(2, 9, 20, 0.92)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <style>{`
        @keyframes nex-vault-lock-pulse {
          0%, 100% { opacity: 0.65; transform: scale(1); letter-spacing: 0.22em; }
          50%      { opacity: 1;    transform: scale(1.045); letter-spacing: 0.28em; }
        }
        @keyframes nex-vault-lock-spin-close {
          0%   { transform: rotate(-25deg) scale(0.85); filter: drop-shadow(0 0 0 rgba(0,175,255,0)); }
          60%  { transform: rotate(10deg)  scale(1.15); filter: drop-shadow(0 0 18px rgba(0,175,255,0.75)); }
          100% { transform: rotate(0deg)   scale(1);    filter: drop-shadow(0 4px 14px rgba(0,175,255,0.85)); }
        }
        @keyframes nex-vault-lock-ring {
          0%   { opacity: 0; transform: scale(0.4); }
          80%  { opacity: 0.4; }
          100% { opacity: 0;  transform: scale(2.4); }
        }
      `}</style>
      <div
        data-nex-vault-locking-icon
        style={{
          width: 128,
          height: 128,
          borderRadius: 999,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 999,
            border: `2px solid ${NEX_PALETTE.secure}`,
            animation: "nex-vault-lock-ring 1.6s ease-out infinite",
          }}
        />
        <span
          aria-hidden
          style={{
            display: "flex",
            width: 92,
            height: 92,
            borderRadius: 22,
            background:
              "linear-gradient(145deg, rgba(0,175,255,0.9) 0%, rgba(0,120,200,0.95) 55%, rgba(0,32,64,1) 100%)",
            border: "2px solid rgba(173, 231, 255, 0.95)",
            boxShadow:
              "inset 0 2px 6px rgba(255,255,255,0.4), 0 12px 36px rgba(0,175,255,0.55)",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            animation: "nex-vault-lock-spin-close 1.6s ease-out both",
          }}
        >
          <svg width={44} height={44} viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2.2}
               strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
      </div>
      <div
        data-nex-vault-locking-text
        style={{
          fontSize: 32,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.22em",
          color: NEX_PALETTE.textPrimary,
          animation: "nex-vault-lock-pulse 1.2s ease-in-out infinite",
          textAlign: "center",
          lineHeight: 1.1,
        }}
      >
        {t("vault.setup.lockOverlay.title")}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 12.5,
          color: NEX_PALETTE.textSecondary,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        {t("vault.setup.lockOverlay.subtitle")}
      </p>
    </div>
  );
}
