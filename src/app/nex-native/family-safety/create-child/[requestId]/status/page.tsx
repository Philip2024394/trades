// src/app/nex-native/family-safety/create-child/[requestId]/status/page.tsx
//
// NEX Family Safety · submission status page.
// Authored by CC-2 2026-10-10.
// -------------------------------------------
// Shows the current state of a submitted request with a
// VerificationStatusChip + contextual explanation. The client sub-
// component polls `readRequestForParentAction` every 15 seconds to
// pick up state transitions.

import * as React from "react";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { isFamilySafetyProductionAuthorised } from "@/lib/nex-native/family-safety/feature-flag";
import { getRequestById } from "@/lib/nex-native/family-safety/child-account-creation/service";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { StatusPollClient } from "./_poll-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StatusPageProps {
  readonly params: Promise<{ readonly requestId: string }>;
}

export default async function RequestStatusPage({ params }: StatusPageProps) {
  const { requestId } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const liveModeAuthorised = isFamilySafetyProductionAuthorised();
  const request = await getRequestById(session.account.id, requestId);
  if (!request) notFound();

  return (
    <FamilySafetyShell
      activeNav="setup"
      subtitle="Status of your child-account-creation request."
    >
      <StatusPollClient
        initialRequest={request}
        liveModeAuthorised={liveModeAuthorised}
      />
    </FamilySafetyShell>
  );
}
