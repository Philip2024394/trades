"use client";

// src/app/nex-native/vault/_cross-tab-lock-sweep-client.tsx
//
// Vault Phase B · Commit B.6A · the tiny client component that
// installs the cross-tab lock receiver when any Vault surface mounts.
// Renders nothing · pure side-effect.
//
// Mounted from src/app/nex-native/vault/layout.tsx so every page under
// /nex-native/vault/* carries the receiver. A single install per tab
// is enforced inside installCrossTabLockReceiver() · multiple mounts
// are no-ops.

import { useEffect } from "react";
import { installCrossTabLockReceiver } from "@/lib/nex-native/vault/client/lock-sweep";

export function CrossTabLockSweepClient() {
  useEffect(() => {
    const teardown = installCrossTabLockReceiver();
    return () => teardown();
  }, []);
  return null;
}
