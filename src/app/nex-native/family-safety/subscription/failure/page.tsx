// src/app/nex-native/family-safety/subscription/failure/page.tsx
//
// NEX Family Safety · test-mode checkout FAILURE landing. No entitlement
// has been granted. The attempt log carries outcome='failed'.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getPlanById } from "@/lib/nex-native/family-safety/subscription/plan-catalog";
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
  red: "#ff5252",
  warnBg: "rgba(255, 114, 0, 0.14)",
  warnBorder: "rgba(255, 114, 0, 0.60)",
};

interface Props {
  readonly searchParams: Promise<{ plan?: string; reason?: string }>;
}

export default async function FamilySafetyFailurePage({ searchParams }: Props) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const sp = await searchParams;
  const planId = typeof sp.plan === "string" ? sp.plan : "";
  const reason = typeof sp.reason === "string" ? sp.reason : "simulated_failure";
  const plan = getPlanById(planId);

  return (
    <main
      data-nex-fs-failure-root
      style={{
        minHeight: "100vh",
        background: NEX.bg,
        color: NEX.textPrimary,
        padding: "16px",
      }}
    >
      <NexPageHeader dataScope="family-safety-failure" />

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
          SIMULATED · TEST MODE · no real charge was attempted.
        </div>

        <h1
          data-nex-fs-failure-heading
          style={{ fontSize: 24, fontWeight: 700, margin: "0 0 10px 0", color: NEX.red }}
        >
          Test checkout failed
        </h1>
        <p
          data-nex-fs-failure-state
          style={{ color: NEX.textSecondary, fontSize: 14, margin: "0 0 10px 0" }}
        >
          The simulated payment did not succeed. <strong>No entitlement
          was granted.</strong>
        </p>
        <p
          data-nex-fs-failure-reason
          style={{ color: NEX.textMuted, fontSize: 12, margin: "0 0 20px 0" }}
        >
          reason: <code>{reason}</code>
        </p>

        {plan ? (
          <p style={{ margin: "0 0 20px 0", color: NEX.textPrimary }}>
            Plan: <strong>{plan.title}</strong> · {plan.displayPrice}
          </p>
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href={`/nex-native/family-safety/subscription/checkout?plan=${encodeURIComponent(plan?.id ?? "family_safety_pilot_free")}`}
            data-nex-fs-failure-cta-retry
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
            Retry test checkout
          </Link>
          <Link
            href="/nex-native/family-safety/subscription"
            data-nex-fs-failure-cta-back
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
            Back to plans
          </Link>
        </div>
      </section>
    </main>
  );
}
