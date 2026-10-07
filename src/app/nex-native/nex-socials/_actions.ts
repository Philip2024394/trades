"use server";

// src/app/nex-native/nex-socials/_actions.ts
//
// NEX Socials · signup intent persistence · founder-sealed 2026-10-07.
//
// Wire-up for the "Join NEX Socials" welcome-page chooser. Takes the
// four allowed intents from a FormData checkbox group, filters to the
// sealed set, and persists them to nex_account.social_intents via the
// admin client (migration 145). Honest guards: unauthenticated →
// redirect to sign-in; empty selection is NOT an error (an empty set
// means "I don't want to declare intent" and we persist '{}'); unknown
// tokens are silently filtered.
//
// The server action redirects to the welcome page's `continue` branch
// (/nex-native/chat) on success so the user resumes their flow.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

export type SocialIntent = "business" | "new_friends" | "dating" | "nightlife";

export const SOCIAL_INTENTS: readonly SocialIntent[] = [
  "business",
  "new_friends",
  "dating",
  "nightlife",
] as const;

const SOCIAL_INTENT_SET = new Set<string>(SOCIAL_INTENTS);

export async function setSocialIntentsAction(
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const nextParam = String(formData.get("next") ?? "").trim();
  const next = nextParam.startsWith("/") ? nextParam : "/nex-native/chat";

  const raw = formData.getAll("social_intent").map(String);
  const seen = new Set<SocialIntent>();
  for (const token of raw) {
    if (SOCIAL_INTENT_SET.has(token)) {
      seen.add(token as SocialIntent);
    }
  }
  const intents = Array.from(seen);

  await nexSupabaseAdmin
    .from("nex_account")
    .update({ social_intents: intents })
    .eq("id", session.account.id);

  revalidatePath("/nex-native/create-account/welcome");
  revalidatePath(next);
  redirect(next);
}
