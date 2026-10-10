// src/app/nex-native/family-safety/custody/[custodyId]/audit/page.tsx

import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { isFamilySafetyProductionAuthorised } from "@/lib/nex-native/family-safety/feature-flag";
import {
  getCustodyById,
  readRecentForCustody,
} from "@/lib/nex-native/family-safety/custody/service";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { CustodyActionLog } from "@/components/nex-native/family-safety/CustodyActionLog";
import { LegalClearancePendingBanner } from "@/components/nex-native/family-safety/LegalClearancePendingBanner";
import { FAMILY_SAFETY_PALETTE } from "@/components/nex-native/family-safety/_palette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AuditParams {
  readonly params: Promise<{ readonly custodyId: string }>;
}

export default async function CustodyAuditPage({ params }: AuditParams) {
  const { custodyId } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const liveModeAuthorised = isFamilySafetyProductionAuthorised();
  const custody = await getCustodyById(session.account.id, custodyId);
  if (!custody) notFound();
  const entries = await readRecentForCustody(session.account.id, custodyId);

  return (
    <FamilySafetyShell
      activeNav="dashboard"
      subtitle={`Audit log for ${custody.childDisplayName}.`}
    >
      <LegalClearancePendingBanner liveModeAuthorised={liveModeAuthorised} />
      <h2
        style={{
          margin: "4px 0 10px",
          fontSize: 16,
          fontWeight: 600,
          color: FAMILY_SAFETY_PALETTE.textPrimary,
        }}
      >
        Recent parent actions
      </h2>
      <p
        style={{
          margin: "0 0 10px",
          fontSize: 12,
          color: FAMILY_SAFETY_PALETTE.textSecondary,
          lineHeight: 1.5,
        }}
      >
        Each entry below is a record of a parent action on this custody.
        Audit entries never contain the child's password, reset tokens, or
        any other secret value.
      </p>
      <CustodyActionLog entries={entries} />
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
