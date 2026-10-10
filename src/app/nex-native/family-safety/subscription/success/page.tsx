// src/app/nex-native/family-safety/subscription/success/page.tsx
//
// NEX Family Safety · test-mode checkout SUCCESS landing. The entitlement
// row has already been written in state='active' by the server action.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getPlanById } from "@/lib/nex-native/family-safety/subscription/plan-catalog";
import { readMyEntitlementAction } from "@/lib/nex-native/family-safety/subscription/_server-actions";
import { NexPageHeader } from "../../../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  textMuted: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  warnBg: "rgba(255, 114, 0, 0.14)",
  warnBorder: "rgba(255, 114, 0, 0.60)",
};

interface Props {
  readonly searchParams: Promise<{ plan?: string; duplicate?: string }>;
}

export default async function FamilySafetySuccessPage({ searchParams }: Props) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const sp = await searchParams;
  const planId = typeof sp.plan === "string" ? sp.plan : "";
  const duplicate = sp.duplicate === "1";
  const plan = getPlanById(planId);
  const entitlement = await readMyEntitlementAction({
    planId: planId || "family_safety_pilot_free",
  });
  const isActive =
    entitlement.ok && entitlement.value?.isActive === true;

  return (
    <main
      data-nex-fs-success-root
      style={{
        minHeight: "100vh",
        background: NEX.bg,
        color: NEX.textPrimary,
        padding: "16px",
      }}
    >
      <NexPageHeader dataScope="family-safety-success" />

      <section style={{ maxWidth: 720, margin: "0 auto", paddingTop: 16 }}>
        <div
          data-nex-fs-test-mode-banner
          style={{
            background: NEX.warnBg,
            border: `1px solid ${NEX.warnBorder}`,
            color: NEX.textPrimary,
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 20,
            fontWeight: 600,
          }}
        >
          SIMULATED · TEST MODE · entitlement is marked
          <code> test_mode=TRUE</code> · no real charge.
        </div>

        <h1
          data-nex-fs-success-heading
          style={{ fontSize: 24, fontWeight: 700, margin: "0 0 10px 0" }}
        >
          {duplicate ? "Duplicate ignored" : "Test entitlement activated"}
        </h1>

        <p
          data-nex-fs-success-state
          data-nex-fs-active={isActive ? "true" : "false"}
          style={{ color: NEX.textSecondary, fontSize: 14, margin: "0 0 20px 0" }}
        >
          {duplicate
            ? "This payment reference was already processed. The existing entitlement is unchanged."
            : "Your Family Safety access is now active in TEST mode. You can cancel at any time from the Manage page."}
        </p>

        {plan ? (
          <p style={{ margin: "0 0 20px 0", color: NEX.textPrimary }}>
            Plan: <strong>{plan.title}</strong> · {plan.displayPrice}
          </p>
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href="/nex-native/family-safety"
            data-nex-fs-success-cta-dashboard
            style={{
              background: NEX.orange,
              color: "#1A1300",
              borderRadius: 10,
              padding: "12px 16px",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Open Family Safety home
          </Link>
          <Link
            href="/nex-native/family-safety/subscription/manage"
            data-nex-fs-success-cta-manage
            style={{
              background: NEX.panel,
              color: NEX.textPrimary,
              border: `1px solid ${NEX.cyanSoft}`,
              borderRadius: 10,
              padding: "12px 16px",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Manage subscription
          </Link>
        </div>
      </section>
    </main>
  );
}
