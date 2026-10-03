// src/app/nex-native/vault/home/_resolve-theme.ts
//
// Resolve the viewer's Vault doorway slug from their chat_theme.
//
// Vault interior rendering is palette-locked (§10.0.2 · one-interior
// rule). This helper exists so interior surfaces can emit a *metadata*
// attribute recording which doorway skin the viewer last entered
// through — useful for observability, analytics, and future hooks
// (e.g. a "You entered through the Joker door" affordance on return
// visits). It does NOT re-skin the interior.
//
// Mapping must stay in sync with /nex-native/vault/page.tsx's
// resolveDoorwaySkin · same inputs, same outputs.

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";

export type VaultDoorwaySlug = "nex" | "joker" | "haunted-hotel" | "pink-dream";

const DOORWAY_SLUGS: ReadonlySet<VaultDoorwaySlug> = new Set([
  "nex",
  "joker",
  "haunted-hotel",
  "pink-dream",
]);

/**
 * Server-only · reads the viewer's session via next/headers cookies
 * and returns the Vault doorway slug their chat_theme maps to.
 *
 * Returns null if there is no session (interior surfaces should
 * handle that by redirecting; this helper does NOT redirect so
 * callers can decide their own 401 behaviour).
 */
export async function resolveVaultDoorwaySlug(): Promise<VaultDoorwaySlug | null> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return null;
  const chatTheme = (session.account.chat_theme as string | null) ?? null;
  return mapChatThemeToDoorwaySlug(chatTheme);
}

export function mapChatThemeToDoorwaySlug(
  chatTheme: string | null,
): VaultDoorwaySlug {
  if (!chatTheme) return "nex";
  const normalized = chatTheme.trim().toLowerCase();

  // Direct doorway-slug match (lets themed-doorway URLs stay consistent
  // if a future migration promotes a doorway slug to a real theme row).
  if (DOORWAY_SLUGS.has(normalized as VaultDoorwaySlug)) {
    return normalized as VaultDoorwaySlug;
  }

  // Live-catalog mappings per nex_chat_theme (verified against the
  // sealed production project ijvqdvsvwtwxzcqmoqit 2026-10-03):
  //   · "theme-0" is the DB row whose display name is "Joker" (the
  //     sealed launch default Joker theme per account-service.ts
  //     createAccount) → open the Joker doorway.
  //   · "pink-dream" is a real catalog id → handled by DOORWAY_SLUGS above.
  //   · No row named "haunted-hotel" exists in the live catalog yet.
  //     The haunted-hotel doorway is reachable only via its direct URL
  //     until a corresponding chat_theme row is seeded (founder call).
  //   · Every other theme id ("default", "titanium", "aurora", ... 32
  //     rows at time of writing) falls back to SKIN_NEX — the quiet
  //     dark-navy doorway that works for any account.
  if (normalized === "theme-0") return "joker";

  return "nex";
}
