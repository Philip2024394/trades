"use client";

// src/app/nex-native/vault/settings/devices/_devices-client.tsx
//
// Vault Phase A · Commit A.4 · Device A client.
//
// Shows the account's device-keys, their Vault status, and lets the
// user authorise another device (requires step-up + unlocked Vault)
// or revoke a device.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { VaultDoorwaySkin } from "../../_doorway-skin";
import { useLang } from "@/lib/nex/i18n/I18nProvider";
import { formatDate } from "@/lib/nex/i18n/format";
import { ensureDeviceKey } from "@/lib/nex-native/crypto/device-key";
import {
  authoriseDevice,
  listVaultDevices,
  revokeDevice,
  type VaultDeviceSummary,
} from "@/lib/nex-native/vault/client/device-portability";
import { useVaultSession } from "@/lib/nex-native/vault/client/vault-session";

type ActionBusyKind = "authorise" | "revoke" | "step_up" | null;

export function DevicesClient({ skin }: { skin: VaultDoorwaySkin }) {
  const router = useRouter();
  const { lang } = useLang();
  const vault = useVaultSession();
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [devices, setDevices] = useState<VaultDeviceSummary[] | null>(null);
  const [busy, setBusy] = useState<ActionBusyKind>(null);
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stepUpPassword, setStepUpPassword] = useState("");
  const [stepUpOpen, setStepUpOpen] = useState<{
    purpose: "authorise" | "revoke";
    targetDeviceId: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    const result = await listVaultDevices();
    if (!result.ok) {
      setError(result.error ?? "list_failed");
      return;
    }
    setDevices(result.devices);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const key = await ensureDeviceKey();
        if (cancelled) return;
        setCurrentDeviceId(key.deviceId);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "device_bootstrap_failed");
      }
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

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
        setError(body.error === "wrong_password" ? "Wrong password." : "Step-up failed.");
        return false;
      }
      setStepUpPassword("");
      return true;
    } finally {
      setBusy(null);
    }
  }

  async function onAuthorise(target: VaultDeviceSummary) {
    if (!vault.unlocked) {
      setError("Vault must be unlocked to authorise another device.");
      return;
    }
    setStepUpOpen({ purpose: "authorise", targetDeviceId: target.device_id });
  }

  async function completeAuthorise(targetDeviceId: string) {
    const target = devices?.find((d) => d.device_id === targetDeviceId);
    if (!target) return;
    setBusy("authorise");
    setBusyDeviceId(targetDeviceId);
    setError(null);
    try {
      const result = await authoriseDevice({
        targetDeviceId,
        targetPublicKeyBase64: target.public_key,
      });
      if (!result.ok) {
        setError(
          result.error === "step_up_required"
            ? "Please verify your password first."
            : result.error === "vault_locked"
              ? "Unlock Vault first on this device."
              : "Could not authorise that device.",
        );
      } else {
        setNotice("Device authorisation sent. The other device can now add Vault.");
        await refresh();
      }
    } finally {
      setBusy(null);
      setBusyDeviceId(null);
    }
  }

  async function onRevoke(target: VaultDeviceSummary) {
    setStepUpOpen({ purpose: "revoke", targetDeviceId: target.device_id });
  }

  async function completeRevoke(targetDeviceId: string) {
    setBusy("revoke");
    setBusyDeviceId(targetDeviceId);
    setError(null);
    try {
      const result = await revokeDevice(targetDeviceId);
      if (!result.ok) {
        setError(
          result.error === "step_up_required"
            ? "Please verify your password first."
            : "Could not revoke that device.",
        );
      } else {
        setNotice("Device access revoked.");
        await refresh();
      }
    } finally {
      setBusy(null);
      setBusyDeviceId(null);
    }
  }

  const notRevoked = devices?.filter((d) => d.vault_status !== "revoked") ?? [];
  const revoked = devices?.filter((d) => d.vault_status === "revoked") ?? [];

  return (
    <main
      data-nex-vault-devices
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

        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Vault devices</h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 13.5,
            color: skin.text.secondary,
            lineHeight: 1.55,
          }}
        >
          Each device signs in to NEX separately and uses its own key.
          Only authorised devices can unlock your Vault. NEX cannot
          read your Vault key.
        </p>

        {error && (
          <p
            data-nex-vault-devices-error
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
            data-nex-vault-devices-notice
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

        {devices === null && (
          <p style={{ color: skin.text.secondary }}>Loading devices…</p>
        )}

        <ul
          data-nex-vault-devices-list
          style={{ listStyle: "none", padding: 0, margin: 0 }}
        >
          {notRevoked.map((d) => {
            const isCurrent = d.device_id === currentDeviceId;
            return (
              <li
                key={d.device_id}
                data-nex-vault-device={d.device_id}
                data-nex-vault-device-status={d.vault_status}
                data-nex-vault-device-is-current={isCurrent ? "true" : "false"}
                style={{
                  padding: "14px 16px",
                  border: `1px solid ${skin.cells.border}`,
                  borderRadius: 12,
                  marginBottom: 10,
                  background: skin.cells.bg,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "baseline",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14.5 }}>
                      {isCurrent ? "This device" : "Other device"}
                    </p>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 11.5,
                        color: skin.text.secondary,
                      }}
                    >
                      {statusLabel(d.vault_status)} · last active{" "}
                      {formatDate(d.last_seen_at, lang)}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {!isCurrent && d.vault_status === "not_authorised" && (
                      <button
                        type="button"
                        data-nex-vault-authorise={d.device_id}
                        onClick={() => onAuthorise(d)}
                        disabled={busy !== null}
                        style={actionBtnStyle(skin, "primary", busy !== null)}
                      >
                        Authorise
                      </button>
                    )}
                    {!isCurrent && d.vault_status === "pending" && (
                      <span
                        style={{
                          fontSize: 12,
                          color: skin.text.secondary,
                        }}
                      >
                        Awaiting consume
                      </span>
                    )}
                    {!isCurrent && d.vault_status === "authorised" && (
                      <button
                        type="button"
                        data-nex-vault-revoke={d.device_id}
                        onClick={() => onRevoke(d)}
                        disabled={busy !== null}
                        style={actionBtnStyle(skin, "danger", busy !== null)}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {revoked.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 14, color: skin.text.secondary, margin: "0 0 10px" }}>
              Revoked
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {revoked.map((d) => (
                <li
                  key={d.device_id}
                  data-nex-vault-device={d.device_id}
                  data-nex-vault-device-status="revoked"
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    marginBottom: 8,
                    background: "transparent",
                    border: `1px dashed ${skin.cells.borderMuted}`,
                    color: skin.text.secondary,
                    fontSize: 13,
                  }}
                >
                  Revoked device · can no longer unlock Vault.
                </li>
              ))}
            </ul>
          </section>
        )}

        {stepUpOpen && (
          <div
            data-nex-vault-stepup-modal
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
                Please verify it's really you
              </h2>
              <p
                style={{
                  margin: "0 0 16px",
                  fontSize: 13.5,
                  color: skin.text.secondary,
                }}
              >
                Enter your NEX password before{" "}
                {stepUpOpen.purpose === "authorise"
                  ? "adding another device"
                  : "revoking a device"}
                .
              </p>
              <input
                type="password"
                data-nex-vault-stepup-password
                autoComplete="current-password"
                value={stepUpPassword}
                onChange={(e) => setStepUpPassword(e.currentTarget.value)}
                placeholder="Password"
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  background: skin.cells.bg,
                  border: `1px solid ${skin.cells.border}`,
                  borderRadius: 12,
                  color: skin.text.primary,
                  fontSize: 16,
                  fontFamily: skin.font,
                }}
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
                    setStepUpOpen(null);
                    setStepUpPassword("");
                  }}
                  style={actionBtnStyle(skin, "ghost", false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-nex-vault-stepup-confirm
                  disabled={!stepUpPassword || busy === "step_up"}
                  onClick={async () => {
                    const ok = await doStepUp();
                    if (ok) {
                      const target = stepUpOpen;
                      setStepUpOpen(null);
                      if (target.purpose === "authorise") {
                        await completeAuthorise(target.targetDeviceId);
                      } else {
                        await completeRevoke(target.targetDeviceId);
                      }
                    }
                  }}
                  style={actionBtnStyle(
                    skin,
                    "primary",
                    !stepUpPassword || busy === "step_up",
                  )}
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

function statusLabel(status: VaultDeviceSummary["vault_status"]): string {
  switch (status) {
    case "authorised":
      return "In Vault";
    case "pending":
      return "Pending authorisation";
    case "revoked":
      return "Revoked";
    default:
      return "Not in Vault";
  }
}

function actionBtnStyle(
  skin: VaultDoorwaySkin,
  variant: "primary" | "danger" | "ghost",
  disabled: boolean,
): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
    border: "none",
  };
  if (variant === "primary") {
    return {
      ...base,
      background: skin.text.brandChip,
      color: skin.text.primary,
    };
  }
  if (variant === "danger") {
    return {
      ...base,
      background: "rgba(255, 90, 60, 0.15)",
      border: "1px solid rgba(255, 90, 60, 0.5)",
      color: "#FF8A6E",
    };
  }
  return {
    ...base,
    background: "transparent",
    border: `1px solid ${skin.cells.border}`,
    color: skin.text.primary,
  };
}
