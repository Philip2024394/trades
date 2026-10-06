// src/app/nex-native/vault/recover/page.tsx
//
// Vault Phase A · Commit A.5 · recovery unlock surface.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { SKIN_NEX } from "../_doorway-skin";
import { RecoverUnlockClient } from "./_recover-unlock-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultRecoverPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/recover");
  }
  const { data: setup } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .select("recovery_configured_at")
    .eq("account_id", session.account.id)
    .maybeSingle();
  const recoveryConfigured =
    !!setup && !!(setup as { recovery_configured_at: string | null }).recovery_configured_at;
  return (
    <RecoverUnlockClient
      skin={SKIN_NEX}
      recoveryConfigured={recoveryConfigured}
    />
  );
}
