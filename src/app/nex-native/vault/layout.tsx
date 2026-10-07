// src/app/nex-native/vault/layout.tsx
//
// Vault Phase B · Commit B.6A · Vault-wide layout that mounts the
// cross-tab lock-sweep receiver on every Vault route.
//
// This is deliberately the MINIMUM possible layout · it exists only
// to carry the client-side cross-tab lock receiver (B.6A §1). It
// does NOT:
//   · wrap the children in any new DOM (returns the child tree
//     verbatim so the sealed per-page chrome continues to control
//     the viewport)
//   · fetch any data
//   · gate rendering on vault state (per-page server components
//     continue to redirect to /vault/setup / /vault when needed)
//
// If we need Vault-wide chrome in the future it goes here · for now
// the receiver mount is all we add.

import type { ReactNode } from "react";
import { CrossTabLockSweepClient } from "./_cross-tab-lock-sweep-client";

export const dynamic = "force-dynamic";

export default function VaultLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CrossTabLockSweepClient />
      {children}
    </>
  );
}
