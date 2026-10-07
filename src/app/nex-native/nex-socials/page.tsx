// src/app/nex-native/nex-socials/page.tsx
//
// NEX Socials landing · founder-sealed 2026-10-07.
//
// The entrance into NEX Socials. Four large tactile tiles - Business,
// New Friends, Dating, Night Life - each leading into its own floating-
// profile world at /nex-native/nex-socials/discover/[intent]. This is
// the sealed boundary between "choose your world" and the floating-
// profile canvas: the landing never contains profiles, and the canvas
// never contains the chooser.
//
// Server-side we read the user's declared `nex_account.social_intents`
// (migration 145) so the chooser can highlight the tiles that match
// the user's signup declaration. The chip is informational - the user
// still taps the lens they want right now; multi-intent members are
// not auto-skipped past the chooser.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import type { SocialIntent } from "./_actions";
import { NexSocialsChooser } from "./_chooser-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function NexSocialsLandingPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/nex-socials");
  }

  // Read the user's declared intents from nex_account (migration 145).
  // Empty array means they haven't declared yet; chooser renders cold
  // without preselects. Never fabricated.
  let declared: SocialIntent[] = [];
  try {
    const { data } = await nexSupabaseAdmin
      .from("nex_account")
      .select("social_intents")
      .eq("id", session.account.id)
      .maybeSingle();
    const raw = (data as { social_intents?: unknown } | null)?.social_intents;
    if (Array.isArray(raw)) {
      declared = raw.filter(
        (t): t is SocialIntent =>
          t === "business" ||
          t === "new_friends" ||
          t === "dating" ||
          t === "nightlife",
      );
    }
  } catch {
    // Non-fatal · chooser renders cold.
  }

  return <NexSocialsChooser declaredIntents={declared} />;
}
