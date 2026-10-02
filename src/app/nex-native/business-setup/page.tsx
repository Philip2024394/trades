// src/app/nex-native/business-setup/page.tsx
//
// NEX Business NEX Activation · server orchestrator.
// Phase 2 · Rev 6 FROZEN · 2026-10-02.
//
// Resolves session + existing nex_business row (if any), then hands off
// to the client wizard. All classification UX, chip rendering, and draft
// persistence lives on the client side.
//
// Routing rules (Rev 2 §4):
//   · unauthenticated → /sign-in
//   · signed-in with no nex_business row → wizard mounts at step 0 (welcome)
//   · signed-in with a shell row (profile = null) → same (first-time activation)
//   · signed-in with activated profile → wizard mounts at step 5 (overview)
//
// All copy on this surface frames activation, never classification.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import type {
  BusinessProfile,
  CapabilityKey,
  ContentTypeKey,
  CtaIntent,
} from "@/lib/nex-native/business/types";
import { BusinessSetupWizard } from "./_wizard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExistingBusinessState {
  profile: BusinessProfile | null;
  capability_overrides: Partial<Record<CapabilityKey, boolean>>;
  content_overrides: Partial<Record<ContentTypeKey, boolean>>;
  cta_preference: CtaIntent | null;
}

async function loadExistingState(ownerAccountId: string): Promise<ExistingBusinessState> {
  const { data } = await nexSupabaseAdmin
    .from("nex_business")
    .select("profile, capability_overrides, content_overrides, cta_preference")
    .eq("owner_account_id", ownerAccountId)
    .maybeSingle();
  return {
    profile: (data?.profile as BusinessProfile | null) ?? null,
    capability_overrides: (data?.capability_overrides as Partial<Record<CapabilityKey, boolean>>) ?? {},
    content_overrides: (data?.content_overrides as Partial<Record<ContentTypeKey, boolean>>) ?? {},
    cta_preference: (data?.cta_preference as CtaIntent | null) ?? null,
  };
}

export default async function BusinessSetupPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/business-setup");
  }

  const existing = await loadExistingState(session.account.id);

  return (
    <BusinessSetupWizard
      accountId={session.account.id}
      existingProfile={existing.profile}
      existingCapabilityOverrides={existing.capability_overrides}
      existingContentOverrides={existing.content_overrides}
      existingCtaPreference={existing.cta_preference}
    />
  );
}
