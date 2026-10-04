// src/app/nex-native/vault/page.tsx
//
// NEX Vault · entry doorway (NEX-only).
//
// Theme scope boundary doctrine · 2026-10-04
// (doctrine_theme_scope_boundary_2026_10_04). The Vault is a SYSTEM
// surface — never a conversation surface — so the entry doorway
// renders in NEX regardless of the viewer's picked chat_theme. The
// previously-themed doorways (Joker, Haunted Hotel, Pink Dream)
// stay reachable at their explicit `/vault/{slug}` routes for
// preview + screenshot use per vault-research.md §10.0.1, but the
// default entry (`/nex-native/vault`) now ALWAYS resolves SKIN_NEX.
//
// Unauthenticated visitors still bounce to sign-in · the mock PIN
// screen must not be reachable without a NEX session.
//
// There is NO Vault cryptography wired up here, no server action,
// no HSM, no key derivation, no auth boundary beyond the user's
// existing NEX session. Phase A has not started.
//
// Governed by:
//   · doctrine_theme_scope_boundary_2026_10_04 · THIS SURFACE
//   · vault-research.md §10.0 — user-facing simplicity principle
//   · vault-research.md §10.0.1 — themed routes remain reachable
//     directly for preview use (not as default entry)
//   · vault-security-architecture-research.md §14 — Phase A not
//     authorised

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { DoorwayShell } from "./_doorway-shell";
import { SKIN_NEX } from "./_doorway-skin";

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

  // Doctrine 2026-10-04 · default Vault entry is ALWAYS NEX, never
  // repainted from chat_theme. Themed previews remain at their own
  // explicit `/vault/{slug}` routes.
  return <DoorwayShell skin={SKIN_NEX} mockReason={mockReason} />;
}
