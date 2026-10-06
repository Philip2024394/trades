// src/app/nex-native/vault/haunted-hotel/page.tsx
//
// NEX Vault · Haunted Hotel theme doorway.
// Governed by vault-research.md §10.0 + §10.0.1.
// UI-only. No cryptography. No auth. No network. No persistence.

import { DoorwayShell } from "../_doorway-shell";
import { SKIN_HAUNTED_HOTEL } from "../_doorway-skin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Themed doorway routes are preview-only (per sealed memory).
export default async function HauntedHotelVaultDoorwayPage() {
  return <DoorwayShell skin={SKIN_HAUNTED_HOTEL} deviceId="preview-device-00000000" />;
}
