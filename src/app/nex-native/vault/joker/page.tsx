// src/app/nex-native/vault/joker/page.tsx
//
// NEX Vault · Joker theme doorway.
// Governed by vault-research.md §10.0 + §10.0.1.
// UI-only. No cryptography. No auth. No network. No persistence.

import { DoorwayShell } from "../_doorway-shell";
import { SKIN_JOKER } from "../_doorway-skin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ mock?: string }>;
}

export default async function JokerVaultDoorwayPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const mockReason = params.mock === "unavailable" ? "unavailable" : "incorrect";
  return <DoorwayShell skin={SKIN_JOKER} mockReason={mockReason} />;
}
