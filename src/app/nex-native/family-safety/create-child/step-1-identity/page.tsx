// src/app/nex-native/family-safety/create-child/step-1-identity/page.tsx
//
// NEX Family Safety · wizard step 1 · identity collection.
// Authored by CC-2 2026-10-10.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { isFamilySafetyProductionAuthorised } from "@/lib/nex-native/family-safety/feature-flag";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { ChildCreateWizardShell } from "@/components/nex-native/family-safety/ChildCreateWizardShell";
import { Step1IdentityClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Step1IdentityPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const liveModeAuthorised = isFamilySafetyProductionAuthorised();
  return (
    <FamilySafetyShell
      activeNav="setup"
      subtitle="Create a safe NEX account for your family member under 16."
    >
      <ChildCreateWizardShell
        step={1}
        liveModeAuthorised={liveModeAuthorised}
        title="Step 1 · Who are we creating an account for?"
        subtitle="Enter your child's display name and date of birth. You can review and change these answers before submitting."
        cancelHref="/nex-native/family-safety"
      >
        <Step1IdentityClient />
      </ChildCreateWizardShell>
    </FamilySafetyShell>
  );
}
