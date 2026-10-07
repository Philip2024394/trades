// src/app/nex-native/vault/settings/devices/page.tsx
//
// Vault Phase A · Commit A.4 · Vault devices surface.
//
// Server component · authenticates the NEX session + confirms Vault
// is configured, then renders the client devices manager wrapped in
// the shared NEX-styled shell header.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { resolveServerLocale, tFor } from "@/lib/nex/i18n/server";
import { SKIN_NEX } from "../../_doorway-skin";
import { VaultShellHeader } from "../../_vault-shell-header";
import { NEX } from "../../home/_palette";
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

  const headerBag = await headers();
  const locale = resolveServerLocale({
    accountLocale: (session.account.locale as string | null) ?? null,
    acceptLanguage: headerBag.get("accept-language"),
  });
  const t = tFor(locale);

  return (
    <div
      data-nex-vault-sub-shell
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
      }}
    >
      <VaultShellHeader t={t} />
      <DevicesClient skin={SKIN_NEX} />
    </div>
  );
}
