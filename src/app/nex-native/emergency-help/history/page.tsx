// src/app/nex-native/emergency-help/history/page.tsx
//
// NEX Emergency Help · incident history (prior incidents) · sealed
// 2026-10-10.
//
// Honest empty state in v1 · F4's data layer will provide fixtures
// in a later phase. The page lists past incidents with state +
// timestamps · no interactive controls.

import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { EMERGENCY_PALETTE } from "@/components/nex-native/emergency/_palette";
import { SimulatedBadge } from "@/components/nex-native/emergency/SimulatedBadge";
import { loadIncidentHistory } from "@/components/nex-native/emergency/_mock-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function IncidentHistoryPage(): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const history = await loadIncidentHistory();

  return (
    <main
      data-testid="nex-emergency-history"
      style={{
        minHeight: "100dvh",
        background: EMERGENCY_PALETTE.bg,
        color: EMERGENCY_PALETTE.textPrimary,
        padding: "20px 20px 40px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <SimulatedBadge />
        <h1 style={{ margin: "18px 0 8px", fontSize: 22, fontWeight: 700 }}>
          Prior emergencies
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: EMERGENCY_PALETTE.textSecondary,
            lineHeight: 1.5,
          }}
        >
          A log of every emergency you have raised. Nothing is auto-shared.
        </p>

        <section
          data-testid="nex-emergency-history-list"
          style={{
            marginTop: 18,
            display: "grid",
            gap: 10,
          }}
        >
          {history.length === 0 ? (
            <div
              style={{
                padding: 14,
                background: EMERGENCY_PALETTE.surfaceMuted,
                border: `1px dashed ${EMERGENCY_PALETTE.divider}`,
                borderRadius: 12,
                color: EMERGENCY_PALETTE.textSecondary,
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              You have never raised an emergency. We hope you never need to.
            </div>
          ) : (
            history.map((inc) => (
              <article
                key={inc.incidentId}
                style={{
                  padding: 14,
                  background: EMERGENCY_PALETTE.surface,
                  border: `1px solid ${EMERGENCY_PALETTE.divider}`,
                  borderRadius: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: EMERGENCY_PALETTE.textDim,
                  }}
                >
                  {inc.state} · {inc.category}
                </div>
                <div style={{ marginTop: 4, fontSize: 13 }}>
                  Raised {inc.createdAt}
                </div>
              </article>
            ))
          )}
        </section>

        <Link
          href="/nex-native/settings"
          style={{
            display: "inline-block",
            marginTop: 24,
            color: EMERGENCY_PALETTE.cyan,
            textDecoration: "underline",
            fontSize: 13,
          }}
        >
          Return to settings
        </Link>
      </div>
    </main>
  );
}
