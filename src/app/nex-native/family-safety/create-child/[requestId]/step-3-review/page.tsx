// src/app/nex-native/family-safety/create-child/[requestId]/step-3-review/page.tsx
//
// NEX Family Safety · wizard step 3 · review + submit.
// Authored by CC-2 2026-10-10.

import * as React from "react";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { isFamilySafetyProductionAuthorised } from "@/lib/nex-native/family-safety/feature-flag";
import {
  computeAgeYears,
  getRequestById,
} from "@/lib/nex-native/family-safety/child-account-creation/service";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { ChildCreateWizardShell } from "@/components/nex-native/family-safety/ChildCreateWizardShell";
import { CreationReviewPanel } from "@/components/nex-native/family-safety/CreationReviewPanel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Step3PageProps {
  readonly params: Promise<{ readonly requestId: string }>;
}

export default async function Step3ReviewPage({ params }: Step3PageProps) {
  const { requestId } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const liveModeAuthorised = isFamilySafetyProductionAuthorised();

  const request = await getRequestById(session.account.id, requestId);
  if (!request) notFound();
  if (request.state !== "draft") {
    redirect(`/nex-native/family-safety/create-child/${requestId}/status`);
  }
  if (!request.submissionId) {
    redirect(
      `/nex-native/family-safety/create-child/${requestId}/step-2-document`,
    );
  }
  const ageYears = computeAgeYears(request.childDeclaredDateOfBirth);

  return (
    <FamilySafetyShell
      activeNav="setup"
      subtitle="Review the details, then submit for verification."
    >
      <ChildCreateWizardShell
        step={3}
        liveModeAuthorised={liveModeAuthorised}
        title="Step 3 · Review and submit"
        subtitle="Submitting sends your request to NEX for ID verification. You can cancel until the review completes."
        cancelHref="/nex-native/family-safety"
      >
        <CreationReviewPanel request={request} ageYears={ageYears} />
      </ChildCreateWizardShell>
    </FamilySafetyShell>
  );
}
