// src/app/nex-native/vault/settings/devices/page.tsx
//
// Vault Phase A · Commit A.4 · Vault devices surface.
//
// Server component · authenticates the NEX session + confirms Vault
// is configured, then renders the client devices manager.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { SKIN_NEX } from "../../_doorway-skin";
import { DevicesClient } from "./_devices-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultDevicesPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/settings/devices");
  }
  const { data: setup } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .select("account_id")
    .eq("account_id", session.account.id)
    .maybeSingle();
  if (!setup) {
    redirect("/nex-native/vault/setup");
  }
  return <DevicesClient skin={SKIN_NEX} />;
}
