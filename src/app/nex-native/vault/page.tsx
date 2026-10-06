// src/app/nex-native/vault/page.tsx
//
// NEX Vault · entry doorway (Vault Phase A · Commit A.3b).
//
// This page is the authoritative state resolver for the Vault surface.
// After authenticating the NEX session it inspects the per-session
// Vault state and routes:
//
//   NOT CONFIGURED → /nex-native/vault/setup  (setup wizard)
//   UNLOCKED       → /nex-native/vault/home   (actual Vault surface)
//   LOCKED         → the real locked PIN entry shell
//
// Themed doorway routes (joker, pink-dream, haunted-hotel) remain
// reachable for preview + screenshot use only (per sealed memory).
//
// This file is Server Component · resolves state once per request from
// the sealed resolveVaultStateForSession. The client component takes
// over for interactive crypto.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { SKIN_NEX } from "./_doorway-skin";
import { VaultLockedBootstrap } from "./_vault-locked-bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultEntryPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault");
  }

  // Server-side state resolution. The client component will refresh
  // via GET /api/nex-native/vault/status after the browser's device-
  // bootstrap completes, but we route this initial render based on
  // the configured flag only (we cannot know client-memory unlock
  // state from the server).
  const { data: setup } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .select("account_id")
    .eq("account_id", session.account.id)
    .maybeSingle();

  if (!setup) {
    redirect("/nex-native/vault/setup");
  }

  // Render the locked shell (bootstrap wraps PinEntryClient with the
  // device_id resolved from the browser's IndexedDB key).
  return <VaultLockedBootstrap skin={SKIN_NEX} />;
}
