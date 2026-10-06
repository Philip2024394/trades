// src/app/nex-native/vault/settings/recovery/page.tsx
//
// Vault Phase A · Commit A.5 · recovery passphrase setup surface.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { SKIN_NEX } from "../../_doorway-skin";
import { RecoveryClient } from "./_recovery-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultRecoveryPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/settings/recovery");
  }
  const { data: setup } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .select("account_id, recovery_configured_at")
    .eq("account_id", session.account.id)
    .maybeSingle();
  if (!setup) {
    redirect("/nex-native/vault/setup");
  }
  return (
    <RecoveryClient
      skin={SKIN_NEX}
      configuredAt={(setup as { recovery_configured_at: string | null }).recovery_configured_at}
    />
  );
}
