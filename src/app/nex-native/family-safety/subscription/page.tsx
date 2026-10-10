// src/app/nex-native/family-safety/subscription/page.tsx
//
// NEX Family Safety · subscription plan info page · Phase 1.
//
// Load-bearing display doctrine:
//   · Every plan card carries a "PLACEHOLDER pricing" chip EXCEPT the
//     free pilot plan (which carries a "FREE · pilot" chip).
//   · The page carries a prominent "SIMULATED · TEST MODE" banner.
//   · Clicking a plan navigates to the test-checkout page with the
//     `plan` query parameter. The free pilot plan is wired directly;
//     the TBD plans show "Not available in Phase 1".

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { listAllPlans } from "@/lib/nex-native/family-safety/subscription/plan-catalog";
import { readMyEntitlementAction } from "@/lib/nex-native/family-safety/subscription/_server-actions";
import { NexPageHeader } from "../../_page-header";

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
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
  warnBg: "rgba(255, 114, 0, 0.14)",
  warnBorder: "rgba(255, 114, 0, 0.60)",
};

export default async function FamilySafetySubscriptionIndex() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const plans = listAllPlans();
  const freePilotCurrent = await readMyEntitlementAction({
    planId: "family_safety_pilot_free",
  });
  const isActive = freePilotCurrent.ok && freePilotCurrent.value?.isActive === true;

  return (
    <main
      data-nex-fs-subscription-root
      style={{
        minHeight: "100vh",
        background: NEX.bg,
        color: NEX.textPrimary,
        padding: "16px",
      }}
    >
      <NexPageHeader dataScope="family-safety-subscription" />

      <section style={{ maxWidth: 920, margin: "0 auto", paddingTop: 16 }}>
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
          SIMULATED · TEST MODE · NO REAL CHARGE · This surface does not
          collect real payment details and no live payment network calls
          are made.
        </div>

        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            margin: "0 0 8px 0",
            color: NEX.textPrimary,
          }}
        >
          NEX Family Safety · subscription
        </h1>
        <p
          style={{
            color: NEX.textSecondary,
            fontSize: 14,
            margin: "0 0 20px 0",
          }}
        >
          Pricing is a <strong>PLACEHOLDER</strong> · founder has not approved
          a commercial model. One free pilot plan is available so you can
          exercise the full journey without any payment commitment.
        </p>

        <ul
          data-nex-fs-plan-list
          style={{
            display: "grid",
            gap: 14,
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {plans.map((plan) => {
            const chipColor = plan.isFreePilot ? NEX.cyan : NEX.orange;
            const chipLabel = plan.isFreePilot
              ? "FREE · pilot"
              : "PLACEHOLDER pricing";
            const activatable = plan.isFreePilot;
            const activeBadge = plan.isFreePilot && isActive;
            return (
              <li
                key={plan.id}
                data-nex-fs-plan-card
                data-nex-fs-plan-id={plan.id}
                style={{
                  background: NEX.panel,
                  border: `1px solid ${NEX.cyanSoft}`,
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 6,
                  }}
                >
                  <h2
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      margin: 0,
                      color: NEX.textPrimary,
                    }}
                  >
                    {plan.title}
                  </h2>
                  <span
                    data-nex-fs-plan-chip
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      color: chipColor,
                      border: `1px solid ${chipColor}`,
                      background: "rgba(0, 0, 0, 0.20)",
                    }}
                  >
                    {chipLabel}
                  </span>
                </div>
                <p
                  style={{
                    margin: "0 0 10px 0",
                    color: NEX.textSecondary,
                    fontSize: 13,
                  }}
                >
                  {plan.summary}
                </p>
                <p
                  data-nex-fs-plan-price
                  style={{
                    margin: "0 0 10px 0",
                    color: NEX.textPrimary,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {plan.displayPrice}
                </p>
                <ul
                  style={{
                    margin: "0 0 12px 0",
                    paddingLeft: 20,
                    color: NEX.textMuted,
                    fontSize: 12,
                  }}
                >
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {activatable ? (
                  activeBadge ? (
                    <div
                      data-nex-fs-plan-active-badge
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          color: NEX.cyan,
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        ACTIVE (TEST entitlement)
                      </span>
                      <Link
                        href="/nex-native/family-safety/subscription/manage"
                        data-nex-fs-plan-manage-link
                        style={{
                          color: NEX.textPrimary,
                          background: NEX.panel,
                          border: `1px solid ${NEX.cyanSoft}`,
                          borderRadius: 8,
                          padding: "6px 12px",
                          textDecoration: "none",
                          fontSize: 13,
                        }}
                      >
                        Manage
                      </Link>
                    </div>
                  ) : (
                    <Link
                      href={`/nex-native/family-safety/subscription/checkout?plan=${encodeURIComponent(plan.id)}`}
                      data-nex-fs-plan-start-link
                      style={{
                        display: "inline-block",
                        color: "#1A1300",
                        background: NEX.orange,
                        borderRadius: 8,
                        padding: "8px 14px",
                        textDecoration: "none",
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      Start test checkout
                    </Link>
                  )
                ) : (
                  <span
                    data-nex-fs-plan-not-available
                    style={{
                      display: "inline-block",
                      color: NEX.textMuted,
                      fontSize: 12,
                      fontStyle: "italic",
                    }}
                  >
                    Not available in Phase 1 · pricing pending founder approval
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <p
          style={{
            marginTop: 20,
            color: NEX.textMuted,
            fontSize: 11,
            textAlign: "center",
          }}
        >
          Payment adapter: <code>test_mode</code> · zero live network calls
        </p>
      </section>
    </main>
  );
}
