// src/app/nex-native/emergency-help/incident/[id]/page.tsx
//
// NEX Emergency Help · responder-facing incident view · sealed
// 2026-10-10.
//
// Opened by a responder from the chat alert. In v1 this is a
// standalone page · the chat primitive integration is deferred to
// the NEX-wide realtime phase. All actions are routed through
// `_actions.ts`.

import * as React from "react";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { EMERGENCY_PALETTE } from "@/components/nex-native/emergency/_palette";
import { SimulatedBadge } from "@/components/nex-native/emergency/SimulatedBadge";
import { IncidentAlertCard } from "@/components/nex-native/emergency/IncidentAlertCard";
import { loadIncidentForResponder } from "@/components/nex-native/emergency/_mock-service";
import {
  acceptServerAction,
  declineServerAction,
  withdrawServerAction,
} from "../../_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ResponderIncidentPage(props: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const { id } = await props.params;
  if (!id) notFound();

  const { incident, myRecipient } = await loadIncidentForResponder(id);

  return (
    <main
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
        {incident && myRecipient ? (
          <IncidentAlertCard
            incident={incident}
            myRecipient={myRecipient}
            services={{
              accept: acceptServerAction,
              decline: declineServerAction,
              withdraw: withdrawServerAction,
            }}
          />
        ) : (
          <>
            <SimulatedBadge />
            <h1
              style={{
                margin: "18px 0 8px",
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              Incident not available
            </h1>
            <p
              style={{
                color: EMERGENCY_PALETTE.textSecondary,
                lineHeight: 1.55,
                fontSize: 14,
              }}
            >
              This incident is not visible to you · it may have been
              cancelled, resolved, expired, or you were not notified as a
              recipient. Incident id: <code>{id}</code>.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
