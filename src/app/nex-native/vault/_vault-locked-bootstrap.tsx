"use client";

// src/app/nex-native/vault/_vault-locked-bootstrap.tsx
//
// Vault Phase A · Commit A.3b · locked-shell bootstrap.
//
// Resolves the browser's device_id (ensureDeviceKey · idempotent) and
// upserts the public key to nex_account_device_key, then renders the
// DoorwayShell with the real device_id.
//
// Why: the device_id lives in browser IndexedDB, so no server component
// can know it. We bootstrap client-side after mount, then render the
// interactive unlock surface.

import { useEffect, useState } from "react";
import { DoorwayShell } from "./_doorway-shell";
import type { VaultDoorwaySkin } from "./_doorway-skin";
import {
  ensureDeviceKey,
  publicKeyBase64,
} from "@/lib/nex-native/crypto/device-key";
import { upsertDeviceKeyAction } from "@/app/nex-native/_actions";

export function VaultLockedBootstrap({ skin }: { skin: VaultDoorwaySkin }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        if (!cancelled)
          setError(e instanceof Error ? e.message : "device_bootstrap_failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <main
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
        <div>
          <p data-nex-vault-bootstrap-error>
            Vault could not start on this device. Please refresh and try again.
          </p>
        </div>
      </main>
    );
  }

  if (!deviceId) {
    return (
      <main
        data-nex-vault-bootstrap-loading
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
        <p style={{ opacity: 0.7 }}>Preparing Vault…</p>
      </main>
    );
  }

  return <DoorwayShell skin={skin} deviceId={deviceId} />;
}
