// src/app/nex-native/family-safety/create-child/[requestId]/step-2-document/page.tsx
//
// NEX Family Safety · wizard step 2 · government ID upload.
// Authored by CC-2 2026-10-10.

import * as React from "react";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { isFamilySafetyProductionAuthorised } from "@/lib/nex-native/family-safety/feature-flag";
import { getRequestById } from "@/lib/nex-native/family-safety/child-account-creation/service";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { ChildCreateWizardShell } from "@/components/nex-native/family-safety/ChildCreateWizardShell";
import { Step2DocumentClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Step2PageProps {
  readonly params: Promise<{ readonly requestId: string }>;
}

export default async function Step2DocumentPage({ params }: Step2PageProps) {
  const { requestId } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const liveModeAuthorised = isFamilySafetyProductionAuthorised();
  const request = await getRequestById(session.account.id, requestId);
  if (!request) notFound();
  if (request.state !== "draft") {
    // If the request has already moved on, send to the status page.
    redirect(`/nex-native/family-safety/create-child/${requestId}/status`);
  }
  return (
    <FamilySafetyShell
      activeNav="setup"
      subtitle="Upload the government ID that confirms your child's age."
    >
      <ChildCreateWizardShell
        step={2}
        liveModeAuthorised={liveModeAuthorised}
        title="Step 2 · Upload a government ID"
        subtitle="A document that shows your child's date of birth. We accept KK, birth certificate, Akta, passport, or other government ID. We never share this with anyone outside NEX's verification team."
        cancelHref="/nex-native/family-safety"
      >
        <Step2DocumentClient requestId={request.requestId} />
      </ChildCreateWizardShell>
    </FamilySafetyShell>
  );
}
