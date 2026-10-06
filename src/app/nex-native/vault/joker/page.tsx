// src/app/nex-native/vault/joker/page.tsx
//
// NEX Vault · Joker theme doorway.
// Governed by vault-research.md §10.0 + §10.0.1.
// UI-only. No cryptography. No auth. No network. No persistence.

import { DoorwayShell } from "../_doorway-shell";
import { SKIN_JOKER } from "../_doorway-skin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Themed doorway routes are preview-only (per sealed memory).
// They render the shell for screenshot purposes; the PIN flow does
// not perform real unlock here. Visitors land on the real
// /nex-native/vault route for actual Vault operations.
export default async function JokerVaultDoorwayPage() {
  return <DoorwayShell skin={SKIN_JOKER} deviceId="preview-device-00000000" />;
}
