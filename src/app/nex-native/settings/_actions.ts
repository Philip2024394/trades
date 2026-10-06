"use server";

// src/app/nex-native/settings/_actions.ts
//
// NEX Phase 1.0 Settings · server actions.
// Sealed 2026-10-06. Owns the owner-controlled toggles:
//   · World Intro ON/OFF (writes nex_account.world_intro_enabled)
//   · Custom Intro ON/OFF (writes nex_account_custom_intro.enabled)
//   · Custom Intro video removal
//
// Every action resolves the authenticated session first via
// `resolveNexAppSessionFromContext` · untrusted account ids never
// reach the service layer. revalidatePath is called after each
// mutation so the user sees the fresh state immediately.

import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  setEnabledForOwner,
  clearUploadedVideoForOwner,
} from "@/lib/nex-native/custom-intro-service";

export interface SettingsActionResult {
  ok: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// World Intro ON/OFF
// ---------------------------------------------------------------------------

export async function setWorldIntroEnabledAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, error: "not_signed_in" };
  const raw = formData.get("enabled");
  const enabled = raw === "1" || raw === "true" || raw === "on";
  const { error } = await nexSupabaseAdmin
    .from("nex_account")
    .update({ world_intro_enabled: enabled })
    .eq("id", session.account.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/nex-native/settings/world-intro");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Custom Intro ON/OFF
// ---------------------------------------------------------------------------

export async function setCustomIntroEnabledAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, error: "not_signed_in" };
  const raw = formData.get("enabled");
  const enabled = raw === "1" || raw === "true" || raw === "on";
  try {
    const row = await setEnabledForOwner(session.account.id, enabled);
    if (!row) return { ok: false, error: "no_entitlement" };
    revalidatePath("/nex-native/settings/custom-intro");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Custom Intro · remove the uploaded video (keep the entitlement)
// ---------------------------------------------------------------------------

export async function clearCustomIntroVideoAction(): Promise<SettingsActionResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, error: "not_signed_in" };
  try {
    const row = await clearUploadedVideoForOwner(session.account.id);
    if (!row) return { ok: false, error: "no_entitlement" };
    revalidatePath("/nex-native/settings/custom-intro");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
