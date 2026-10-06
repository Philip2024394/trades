// src/app/nex-native/vault/setup/page.tsx
//
// Vault Phase A · Commit A.3b · setup wizard entry.
//
// Server component · authenticates the NEX session, confirms that
// Vault has NOT already been set up (409 territory), then renders the
// interactive wizard client. If already configured, redirects to the
// doorway (where unlock lives).

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { SKIN_NEX } from "../_doorway-skin";
import { SetupClient } from "./_setup-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultSetupPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/setup");
  }

  const { data: setup } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .select("account_id")
    .eq("account_id", session.account.id)
    .maybeSingle();
  if (setup) {
    redirect("/nex-native/vault");
  }

  return <SetupClient skin={SKIN_NEX} />;
}
