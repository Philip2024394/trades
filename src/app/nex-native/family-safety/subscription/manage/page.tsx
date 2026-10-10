// src/app/nex-native/family-safety/subscription/manage/page.tsx
//
// NEX Family Safety · manage subscription · view entitlement state +
// cancel path. All operations are TEST mode.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getPlanById, listAllPlans } from "@/lib/nex-native/family-safety/subscription/plan-catalog";
import {
  cancelTestEntitlementAction,
  readMyEntitlementAction,
} from "@/lib/nex-native/family-safety/subscription/_server-actions";
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

async function runCancelAction(formData: FormData): Promise<void> {
  "use server";
  const planId = String(formData.get("plan") ?? "");
  const r = await cancelTestEntitlementAction({ planId });
  if (!r.ok && r.reason === "not_authenticated") {
    redirect("/nex-native/sign-in");
  }
  redirect("/nex-native/family-safety/subscription/manage?event=cancel");
}

interface Props {
  readonly searchParams: Promise<{ event?: string }>;
}

export default async function FamilySafetyManagePage({ searchParams }: Props) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const sp = await searchParams;
  const freePilot = getPlanById("family_safety_pilot_free");
  const pilotEnt = await readMyEntitlementAction({
    planId: "family_safety_pilot_free",
  });
  const isActive = pilotEnt.ok && pilotEnt.value?.isActive === true;

  return (
    <main
      data-nex-fs-manage-root
      style={{
        minHeight: "100vh",
        background: NEX.bg,
        color: NEX.textPrimary,
        padding: "16px",
      }}
    >
      <NexPageHeader dataScope="family-safety-manage" />

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
          SIMULATED · TEST MODE · entitlements are test-mode only.
        </div>

        {sp.event === "cancel" ? (
          <div
            data-nex-fs-manage-event-banner
            style={{
              background: "rgba(0, 175, 255, 0.08)",
              border: `1px solid ${NEX.cyanSoft}`,
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 16,
              color: NEX.cyan,
              fontSize: 13,
            }}
          >
            Cancellation processed · if an active entitlement existed it is
            now cancelled.
          </div>
        ) : null}

        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 16px 0" }}>
          Manage subscription
        </h1>

        <div
          data-nex-fs-manage-pilot-card
          style={{
            background: NEX.panel,
            border: `1px solid ${NEX.cyanSoft}`,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 6px 0" }}>
            {freePilot?.title ?? "Family Safety Pilot"}
          </h2>
          <p
            data-nex-fs-manage-state
            data-nex-fs-active={isActive ? "true" : "false"}
            style={{
              margin: "0 0 10px 0",
              fontSize: 13,
              color: isActive ? NEX.cyan : NEX.textMuted,
              fontWeight: 600,
            }}
          >
            {isActive ? "ACTIVE (TEST entitlement)" : "No active entitlement"}
          </p>
          {pilotEnt.value?.activatedAt ? (
            <p
              data-nex-fs-manage-activated-at
              style={{ margin: "0 0 10px 0", fontSize: 12, color: NEX.textMuted }}
            >
              activated_at: <code>{pilotEnt.value.activatedAt}</code>
            </p>
          ) : null}

          {isActive ? (
            <form action={runCancelAction} data-nex-fs-manage-cancel-form>
              <input type="hidden" name="plan" value="family_safety_pilot_free" />
              <button
                type="submit"
                data-nex-fs-manage-cancel-btn
                style={{
                  background: "transparent",
                  color: NEX.red,
                  border: `1px solid ${NEX.red}`,
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel TEST entitlement
              </button>
            </form>
          ) : (
            <Link
              href="/nex-native/family-safety/subscription/checkout?plan=family_safety_pilot_free"
              data-nex-fs-manage-start-link
              style={{
                display: "inline-block",
                background: NEX.orange,
                color: "#1A1300",
                borderRadius: 10,
                padding: "10px 14px",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              Start test checkout
            </Link>
          )}
        </div>

        <h2 style={{ fontSize: 14, fontWeight: 600, color: NEX.textSecondary, margin: "20px 0 8px 0" }}>
          Reserved plan slots
        </h2>
        <ul
          data-nex-fs-manage-reserved-list
          style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}
        >
          {listAllPlans()
            .filter((p) => !p.isFreePilot)
            .map((p) => (
              <li
                key={p.id}
                style={{
                  background: NEX.panel,
                  border: `1px solid ${NEX.cyanSoft}`,
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 12,
                  color: NEX.textMuted,
                }}
              >
                <strong style={{ color: NEX.textPrimary, fontSize: 13 }}>
                  {p.title}
                </strong>{" "}
                — {p.displayPrice}
              </li>
            ))}
        </ul>

        <p
          style={{
            marginTop: 24,
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
