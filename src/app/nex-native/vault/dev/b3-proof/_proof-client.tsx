"use client";

// src/app/nex-native/vault/dev/b3-proof/_proof-client.tsx
//
// Vault Phase B · Commit B.3 · browser harness · exposes the client
// conversation-key module + sealed Phase A vault-session on
// `window.__nexB3` so Playwright can orchestrate the proof flow
// without reinventing crypto in the test.

import { useEffect, useState } from "react";
import * as convKey from "@/lib/nex-native/vault/client/conversation-key";
import * as vaultSession from "@/lib/nex-native/vault/client/vault-session";
import { unlockVault } from "@/lib/nex-native/vault/client/unlock-orchestrator";
import { ensureDeviceKey } from "@/lib/nex-native/crypto/device-key";

export function B3ProofClient() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__nexB3 = {
      convKey,
      vaultSession,
      ensureDeviceKey,
      unlockVault,
    };
    setReady(true);
  }, []);
  return (
    <div
      data-nex-b3-ready={ready ? "true" : "false"}
      style={{ marginTop: 24, fontSize: 11, color: "#9b8b7a" }}
    >
      harness ready: {ready ? "yes" : "no"}
    </div>
  );
}
