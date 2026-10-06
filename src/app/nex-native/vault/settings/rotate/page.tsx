// src/app/nex-native/vault/settings/rotate/page.tsx
//
// Vault Phase A · Commit A.5 · rotate Vault keys surface.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { SKIN_NEX } from "../../_doorway-skin";
import { RotateClient } from "./_rotate-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultRotatePage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/settings/rotate");
  }
  const { data: setup } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .select("vmk_generation, pin_mode, pin_salt, pin_argon_params, recovery_configured_at, recovery_salt, recovery_argon_params")
    .eq("account_id", session.account.id)
    .maybeSingle();
  if (!setup) {
    redirect("/nex-native/vault/setup");
  }
  const typedSetup = setup as unknown as {
    vmk_generation: number;
    pin_mode: "pin" | "passphrase";
    pin_salt: { toString(fmt: "hex"): string } | string | null;
    pin_argon_params: Record<string, unknown>;
    recovery_configured_at: string | null;
    recovery_salt: { toString(fmt: "hex"): string } | string | null;
    recovery_argon_params: Record<string, unknown> | null;
  };

  function byteaToHex(v: unknown): string {
    if (!v) return "";
    if (typeof v === "string") {
      return v.startsWith("\\x") ? v.slice(2) : v;
    }
    if (
      typeof v === "object" &&
      v !== null &&
      "toString" in v
    ) {
      try {
        return (v as { toString: (fmt: string) => string }).toString("hex");
      } catch {
        return String(v);
      }
    }
    return "";
  }

  return (
    <RotateClient
      skin={SKIN_NEX}
      currentGeneration={typedSetup.vmk_generation}
      pinMode={typedSetup.pin_mode}
      pinSaltHex={byteaToHex(typedSetup.pin_salt)}
      pinArgonParams={typedSetup.pin_argon_params}
      recoveryConfigured={typedSetup.recovery_configured_at !== null}
      recoverySaltHex={
        typedSetup.recovery_salt ? byteaToHex(typedSetup.recovery_salt) : null
      }
      recoveryArgonParams={typedSetup.recovery_argon_params}
    />
  );
}
