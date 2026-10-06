// src/app/nex-native/vault/pink-dream/page.tsx
//
// NEX Vault · Pink Dream theme doorway.
// Governed by vault-research.md §10.0 + §10.0.1.
// UI-only. No cryptography. No auth. No network. No persistence.

import { DoorwayShell } from "../_doorway-shell";
import { SKIN_PINK_DREAM } from "../_doorway-skin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Themed doorway routes are preview-only (per sealed memory).
export default async function PinkDreamVaultDoorwayPage() {
  return <DoorwayShell skin={SKIN_PINK_DREAM} deviceId="preview-device-00000000" />;
}
