// src/app/nex-native/family-safety/custody/[custodyId]/reset-password/page.tsx

import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { isFamilySafetyProductionAuthorised } from "@/lib/nex-native/family-safety/feature-flag";
import { getCustodyById } from "@/lib/nex-native/family-safety/custody/service";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { PasswordResetPanel } from "@/components/nex-native/family-safety/PasswordResetPanel";
import { LegalClearancePendingBanner } from "@/components/nex-native/family-safety/LegalClearancePendingBanner";
import { FAMILY_SAFETY_PALETTE } from "@/components/nex-native/family-safety/_palette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ResetParams {
  readonly params: Promise<{ readonly custodyId: string }>;
}

export default async function ResetPasswordPage({ params }: ResetParams) {
  const { custodyId } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const liveModeAuthorised = isFamilySafetyProductionAuthorised();
  const custody = await getCustodyById(session.account.id, custodyId);
  if (!custody) notFound();
  if (!custody.isActive) {
    redirect(`/nex-native/family-safety/custody/${custodyId}`);
  }

  return (
    <FamilySafetyShell
      activeNav="dashboard"
      subtitle={`Reset the password for ${custody.childDisplayName}.`}
    >
      <LegalClearancePendingBanner liveModeAuthorised={liveModeAuthorised} />
      <PasswordResetPanel
        custodyId={custody.custodyId}
        childDisplayName={custody.childDisplayName}
      />
      <Link
        href={`/nex-native/family-safety/custody/${custody.custodyId}`}
        style={{
          marginTop: 14,
          display: "inline-block",
          fontSize: 12,
          color: FAMILY_SAFETY_PALETTE.textDim,
          textDecoration: "underline",
        }}
      >
        ← Back to custody detail
      </Link>
    </FamilySafetyShell>
  );
}
