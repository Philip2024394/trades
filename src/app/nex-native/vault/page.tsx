// src/app/nex-native/vault/page.tsx
//
// NEX Vault · entry doorway (chat_theme-aware).
//
// Stage 2 · theme inheritance (founder-sealed 2026-10-03 D1-D4 build plan).
// Resolves the viewer's session + chat_theme and renders the matching
// DoorwayShell skin. Any chat_theme that doesn't map to a sealed Vault
// doorway skin falls back to SKIN_NEX. Unauthenticated visitors are
// bounced to sign-in — the mock PIN screen must not be reachable
// without a NEX session.
//
// There is NO Vault cryptography wired up here, no server action, no
// HSM, no key derivation, no auth boundary beyond the user's existing
// NEX session. Phase A has not started.
//
// Governed by:
//   · vault-research.md §10.0 — user-facing simplicity principle
//   · vault-research.md §10.0.1 — each theme has its own doorway page
//   · vault-security-architecture-research.md §14 — Phase A not authorised
//   · build-plan 2026-10-03 Stage 2 — theme inheritance from chat_theme
//
// Themed doorway routes stay reachable directly (useful for previews
// and screenshots per §10.0.1):
//   · /nex-native/vault/joker
//   · /nex-native/vault/haunted-hotel
//   · /nex-native/vault/pink-dream

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { DoorwayShell } from "./_doorway-shell";
import { SKIN_BY_SLUG, SKIN_NEX, type VaultDoorwaySkin } from "./_doorway-skin";
import { mapChatThemeToDoorwaySlug } from "./home/_resolve-theme";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ mock?: string }>;
}

export default async function VaultPinEntryPage({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault");
  }

  const params = await searchParams;
  const mockReason = params.mock === "unavailable" ? "unavailable" : "incorrect";
  const chatTheme = (session.account.chat_theme as string | null) ?? null;
  const doorwaySlug = mapChatThemeToDoorwaySlug(chatTheme);
  const skin: VaultDoorwaySkin = SKIN_BY_SLUG[doorwaySlug] ?? SKIN_NEX;

  return <DoorwayShell skin={skin} mockReason={mockReason} />;
}
