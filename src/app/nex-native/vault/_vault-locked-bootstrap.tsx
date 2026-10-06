"use client";

// src/app/nex-native/vault/_vault-locked-bootstrap.tsx
//
// Vault Phase A · Commits A.3b (sealed) + A.4 (device portability).
//
// Resolves the browser's device_id, upserts the public key, then
// decides which locked surface to render:
//
//   PIN envelope exists for this device → PIN entry (A.3b doorway)
//   Pending device envelope targets us  → "Set a PIN for this device"
//     (A.4 Device B consume flow)
//   Neither                              → "Waiting for authorisation"
//                                          (A.4 Device B before Device A
//                                          authorises)
//
// All three paths originate from the same base: the user is signed in,
// Vault IS configured (page.tsx redirects to /setup if not), and the
// server never sees anything beyond opaque envelope material.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DoorwayShell } from "./_doorway-shell";
import type { VaultDoorwaySkin } from "./_doorway-skin";
import {
  ensureDeviceKey,
  publicKeyBase64,
} from "@/lib/nex-native/crypto/device-key";
import { upsertDeviceKeyAction } from "@/app/nex-native/_actions";
import {
  consumePendingDeviceEnvelope,
  fetchPendingDeviceEnvelope,
} from "@/lib/nex-native/vault/client/device-portability";
import {
  PIN_MIN_LENGTH,
  PIN_MAX_LENGTH,
} from "./_pin-entry-reducer";

type BootstrapState =
  | { kind: "preparing" }
  | { kind: "error"; message: string }
  | { kind: "pin"; deviceId: string }
  | {
      kind: "pending";
      deviceId: string;
      envelopeId: string;
      wrappedVmkHex: string;
      nonceHex: string;
      algorithm: string;
    }
  | { kind: "waiting"; deviceId: string };

export function VaultLockedBootstrap({ skin }: { skin: VaultDoorwaySkin }) {
  const [state, setState] = useState<BootstrapState>({ kind: "preparing" });
  const router = useRouter();

  // Device bootstrap + state probe.
  const probe = useCallback(async () => {
    try {
      const key = await ensureDeviceKey();
      const fd = new FormData();
      fd.set("device_id", key.deviceId);
      fd.set("public_key", publicKeyBase64(key.publicKey));
      await upsertDeviceKeyAction(fd);

      // Check for pending device envelope (A.4) first.
      const pending = await fetchPendingDeviceEnvelope({
        deviceId: key.deviceId,
      });
      if (pending.ok && pending.pending) {
        setState({
          kind: "pending",
          deviceId: key.deviceId,
          envelopeId: pending.envelopeId,
          wrappedVmkHex: pending.wrappedVmkHex,
          nonceHex: pending.nonceHex,
          algorithm: pending.algorithm,
        });
        return;
      }

      // Check unlock-materials to see if a PIN envelope exists for us.
      // We call POST but we only care about the shape: 200 → authorised,
      // 403 'device_not_authorised_for_vault' → waiting.
      const probe = await fetch("/api/nex-native/vault/unlock-materials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ device_id: key.deviceId }),
      });
      if (probe.ok) {
        setState({ kind: "pin", deviceId: key.deviceId });
        return;
      }
      const body = (await probe.json().catch(() => ({}))) as {
        error?: string;
      };
      if (
        probe.status === 403 &&
        body.error === "device_not_authorised_for_vault"
      ) {
        setState({ kind: "waiting", deviceId: key.deviceId });
        return;
      }
      if (probe.status === 429) {
        // Rate-limited but this device IS authorised · still render PIN
        // entry; the PinEntryClient will surface the 429 on submit.
        setState({ kind: "pin", deviceId: key.deviceId });
        return;
      }
      setState({
        kind: "error",
        message: body.error ?? `unlock_materials_status_${probe.status}`,
      });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "bootstrap_failed",
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await probe();
    })();
    return () => {
      cancelled = true;
    };
  }, [probe]);

  // ---- render by state ----

  if (state.kind === "preparing") {
    return (
      <PlaceholderMain skin={skin} message="Preparing Vault…" />
    );
  }

  if (state.kind === "error") {
    return (
      <PlaceholderMain skin={skin} tone="error" message={state.message} />
    );
  }

  if (state.kind === "pin") {
    return <DoorwayShell skin={skin} deviceId={state.deviceId} />;
  }

  if (state.kind === "waiting") {
    return (
      <WaitingShell
        skin={skin}
        deviceId={state.deviceId}
        onRefresh={probe}
      />
    );
  }

  // Pending device envelope · prompt for a PIN local to this device.
  return (
    <PendingAuthoriseShell
      skin={skin}
      pending={state}
      onComplete={() => {
        router.push("/nex-native/vault/home");
        router.refresh();
      }}
    />
  );
}

function PlaceholderMain({
  skin,
  message,
  tone,
}: {
  skin: VaultDoorwaySkin;
  message: string;
  tone?: "error";
}) {
  return (
    <main
      data-nex-vault-bootstrap-placeholder
      data-nex-vault-bootstrap-tone={tone ?? ""}
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: skin.bg.base,
        color: skin.text.primary,
        fontFamily: skin.font,
        textAlign: "center",
      }}
    >
      <p
        style={{
          margin: 0,
          color: tone === "error" ? skin.feedback.orange : skin.text.secondary,
        }}
      >
        {tone === "error" ? "Vault could not start on this device." : message}
      </p>
    </main>
  );
}

function WaitingShell({
  skin,
  deviceId,
  onRefresh,
}: {
  skin: VaultDoorwaySkin;
  deviceId: string;
  onRefresh: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <main
      data-nex-vault-waiting
      style={{
        minHeight: "100dvh",
        background: skin.bg.base,
        color: skin.text.primary,
        fontFamily: skin.font,
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 420, width: "100%" }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: skin.text.brandChip,
          }}
        >
          NEX VAULT
        </p>
        <h1
          data-nex-vault-waiting-headline
          style={{ margin: "20px 0 12px", fontSize: 22 }}
        >
          Waiting for authorisation
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 14.5,
            lineHeight: 1.55,
            color: skin.text.secondary,
          }}
        >
          Your Vault was set up on another device. Open Vault on your
          original device, go to Settings → Vault devices, and choose
          <br />
          <strong>Authorise this device</strong>.
        </p>
        <button
          type="button"
          data-nex-vault-waiting-check
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onRefresh();
            } finally {
              setBusy(false);
            }
          }}
          style={{
            display: "block",
            width: "100%",
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            background: skin.text.brandChip,
            color: skin.text.primary,
            fontSize: 15,
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Checking…" : "Check for authorisation"}
        </button>
        <p
          style={{
            marginTop: 20,
            fontSize: 11.5,
            color: skin.text.secondary,
            opacity: 0.7,
          }}
          data-nex-vault-waiting-device-id={deviceId}
        >
          This device's identity is prepared and waiting.
        </p>
      </div>
    </main>
  );
}

function PendingAuthoriseShell({
  skin,
  pending,
  onComplete,
}: {
  skin: VaultDoorwaySkin;
  pending: {
    deviceId: string;
    envelopeId: string;
    wrappedVmkHex: string;
    nonceHex: string;
    algorithm: string;
  };
  onComplete: () => void;
}) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit =
    pin === confirm &&
    /^\d+$/.test(pin) &&
    pin.length >= PIN_MIN_LENGTH &&
    pin.length <= PIN_MAX_LENGTH;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const result = await consumePendingDeviceEnvelope({
      envelopeId: pending.envelopeId,
      wrappedVmkHex: pending.wrappedVmkHex,
      nonceHex: pending.nonceHex,
      algorithm: pending.algorithm,
      pinMode: "pin",
      pinSecret: pin,
    });
    if (result.ok) {
      onComplete();
    } else {
      setError(humaniseError(result.error));
      setBusy(false);
    }
  }

  function humaniseError(code: string): string {
    switch (code) {
      case "envelope_decrypt_failed":
        return "That authorisation could not be used by this device. Please ask the other device to authorise again.";
      case "envelope_expired":
      case "envelope_already_consumed":
        return "That authorisation has expired or already been used. Please ask the other device to authorise again.";
      case "device_revoked":
        return "This device has been revoked. Please sign in again.";
      default:
        return "Something went wrong. Please try again.";
    }
  }

  return (
    <main
      data-nex-vault-pending
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
      <form
        onSubmit={onSubmit}
        style={{ width: "100%", maxWidth: 420, textAlign: "center" }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: skin.text.brandChip,
          }}
        >
          NEX VAULT
        </p>
        <h1
          data-nex-vault-pending-headline
          style={{ margin: "20px 0 12px", fontSize: 22 }}
        >
          Set a PIN for this device
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 14.5,
            lineHeight: 1.55,
            color: skin.text.secondary,
          }}
        >
          Your Vault is being added to this device. Choose a PIN so you
          can unlock Vault here next time.
        </p>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="new-password"
          data-nex-vault-pending-pin
          placeholder="PIN"
          value={pin}
          onChange={(e) =>
            setPin(e.currentTarget.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH))
          }
          style={inputStyle(skin)}
        />
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="new-password"
          data-nex-vault-pending-confirm
          placeholder="Confirm PIN"
          value={confirm}
          onChange={(e) =>
            setConfirm(
              e.currentTarget.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH),
            )
          }
          style={{ ...inputStyle(skin), marginTop: 10 }}
        />
        {error && (
          <p
            data-nex-vault-pending-error
            style={{
              margin: "16px 0 0",
              color: skin.feedback.orange,
              fontSize: 13,
            }}
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          data-nex-vault-pending-submit
          disabled={!canSubmit || busy}
          style={{
            display: "block",
            width: "100%",
            marginTop: 20,
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            background:
              canSubmit && !busy ? skin.text.brandChip : skin.cells.borderMuted,
            color: skin.text.primary,
            fontSize: 15,
            fontWeight: 600,
            cursor: canSubmit && !busy ? "pointer" : "default",
            opacity: canSubmit && !busy ? 1 : 0.6,
          }}
        >
          {busy ? "Securing this device…" : "Add this device to Vault"}
        </button>
      </form>
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
    textAlign: "center",
  };
}
