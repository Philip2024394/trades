// src/app/nex-native/emergency-help/active/page.tsx
//
// NEX Emergency Help · active-incident view · sealed 2026-10-10.
// ---------------------------------------------------------------
// Server shell that mounts the client-side `ActiveIncidentView`.
// The view polls the server every 15s for responder status · a
// realtime subscription is intentionally deferred to the shared
// NEX-wide realtime phase (see MEMORY note "NEX-wide inbound-message
// realtime + message push notifications PARKED").

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { ActiveIncidentView } from "@/components/nex-native/emergency/ActiveIncidentView";
import {
  loadActiveIncidentServerAction,
  cancelServerAction,
} from "../_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ActiveIncidentPage(): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  return (
    <ActiveIncidentView
      services={{
        load: loadActiveIncidentServerAction,
        cancel: cancelServerAction,
      }}
    />
  );
}
