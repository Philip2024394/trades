// src/app/nex-native/family-safety/subscription/checkout/page.tsx
//
// NEX Family Safety · test-mode checkout · Phase 1.
//
// Load-bearing display doctrine:
//   · The page is unambiguously labelled "SIMULATED · NO REAL CHARGE".
//   · THREE action buttons let the operator exercise every outcome:
//     - Simulate SUCCESS → calls the server action with outcome=succeeded
//     - Simulate FAILURE → calls with outcome=failed
//     - Simulate CANCEL  → calls with outcome=cancelled
//   · The buttons post via a form submit · the server action runs under
//     the authenticated session cookie.
//   · The outcome routes to /success / /failure / /cancelled.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getPlanById } from "@/lib/nex-native/family-safety/subscription/plan-catalog";
import { initiateTestCheckoutAction } from "@/lib/nex-native/family-safety/subscription/_server-actions";
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
  readonly searchParams: Promise<{ plan?: string }>;
}

async function runCheckoutAction(formData: FormData): Promise<void> {
  "use server";
  const planId = String(formData.get("plan") ?? "");
  const outcomeRaw = String(formData.get("outcome") ?? "succeeded");
  const outcome: "succeeded" | "failed" | "cancelled" =
    outcomeRaw === "failed"
      ? "failed"
      : outcomeRaw === "cancelled"
        ? "cancelled"
        : "succeeded";

  const r = await initiateTestCheckoutAction({
    planId,
    simulatedOutcome: outcome,
  });

  if (!r.ok) {
    if (r.reason === "payment_failed") {
      redirect(
        `/nex-native/family-safety/subscription/failure?plan=${encodeURIComponent(planId)}`,
      );
    }
    if (r.reason === "payment_cancelled") {
      redirect(
        `/nex-native/family-safety/subscription/cancelled?plan=${encodeURIComponent(planId)}`,
      );
    }
    if (r.reason === "not_authenticated") {
      redirect("/nex-native/sign-in");
    }
    redirect(
      `/nex-native/family-safety/subscription/failure?plan=${encodeURIComponent(planId)}&reason=${encodeURIComponent(r.reason)}`,
    );
  }

  const dup = r.value?.outcome === "duplicate_ignored";
  redirect(
    `/nex-native/family-safety/subscription/success?plan=${encodeURIComponent(planId)}${dup ? "&duplicate=1" : ""}`,
  );
}

export default async function FamilySafetyCheckoutPage({ searchParams }: Props) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const sp = await searchParams;
  const planId = typeof sp.plan === "string" ? sp.plan : "";
  const plan = getPlanById(planId);

  return (
    <main
      data-nex-fs-checkout-root
      style={{
        minHeight: "100vh",
        background: NEX.bg,
        color: NEX.textPrimary,
        padding: "16px",
      }}
    >
      <NexPageHeader dataScope="family-safety-checkout" />

      <section style={{ maxWidth: 720, margin: "0 auto", paddingTop: 16 }}>
        <div
          data-nex-fs-test-mode-banner
          style={{
            background: NEX.warnBg,
            border: `1px solid ${NEX.warnBorder}`,
            color: NEX.textPrimary,
            borderRadius: 10,
            padding: "14px 16px",
            marginBottom: 20,
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          SIMULATED · TEST MODE · NO REAL CHARGE
          <br />
          <span
            style={{ fontWeight: 400, fontSize: 12, color: NEX.textSecondary }}
          >
            This page does not collect real payment details. No live payment
            network calls are made. The buttons below only exercise the
            Phase 1 state machine.
          </span>
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            margin: "0 0 8px 0",
          }}
        >
          Test checkout
        </h1>

        {plan ? (
          <>
            <p
              data-nex-fs-checkout-plan-title
              style={{ color: NEX.textPrimary, fontSize: 15, margin: "0 0 4px 0" }}
            >
              {plan.title}
            </p>
            <p
              data-nex-fs-checkout-plan-price
              style={{ color: NEX.textSecondary, fontSize: 13, margin: "0 0 24px 0" }}
            >
              {plan.displayPrice}
            </p>

            <form action={runCheckoutAction} data-nex-fs-checkout-form>
              <input type="hidden" name="plan" value={plan.id} />

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "1fr",
                }}
              >
                <button
                  type="submit"
                  name="outcome"
                  value="succeeded"
                  data-nex-fs-simulate-success
                  style={{
                    background: NEX.orange,
                    color: "#1A1300",
                    border: "none",
                    borderRadius: 10,
                    padding: "14px 18px",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Simulate SUCCESS · grant TEST entitlement
                </button>
                <button
                  type="submit"
                  name="outcome"
                  value="failed"
                  data-nex-fs-simulate-failure
                  style={{
                    background: "transparent",
                    color: NEX.red,
                    border: `1px solid ${NEX.red}`,
                    borderRadius: 10,
                    padding: "12px 18px",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Simulate FAILURE · no entitlement granted
                </button>
                <button
                  type="submit"
                  name="outcome"
                  value="cancelled"
                  data-nex-fs-simulate-cancel
                  style={{
                    background: "transparent",
                    color: NEX.textSecondary,
                    border: `1px solid ${NEX.cyanSoft}`,
                    borderRadius: 10,
                    padding: "12px 18px",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Simulate CANCEL · no entitlement granted
                </button>
              </div>
            </form>
          </>
        ) : (
          <p
            data-nex-fs-checkout-unknown-plan
            style={{ color: NEX.red, fontSize: 14 }}
          >
            Unknown or missing plan id in the <code>?plan=</code> query
            parameter. Return to the <a
              href="/nex-native/family-safety/subscription"
              style={{ color: NEX.cyan }}
            >
              plan list
            </a>
            .
          </p>
        )}

        <p
          style={{
            marginTop: 24,
            color: NEX.textMuted,
            fontSize: 11,
            textAlign: "center",
          }}
        >
          Idempotency keys are generated per attempt · a duplicate webhook
          replay cannot grant a second entitlement.
        </p>
      </section>
    </main>
  );
}
