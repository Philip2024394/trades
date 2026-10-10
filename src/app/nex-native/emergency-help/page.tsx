// src/app/nex-native/emergency-help/page.tsx
//
// NEX Emergency Help · "Do you need help?" confirmation surface.
// Sealed 2026-10-10.
//
// Thin server shell that mounts the client-side
// `EmergencyConfirmationScreen` and wires the shared server actions
// from `_actions.ts`. The 2-tap discipline, geolocation handling, and
// category selection all live inside the client component.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { EmergencyConfirmationScreen } from "@/components/nex-native/emergency/EmergencyConfirmationScreen";
import {
  createDraftServerAction,
  activateServerAction,
  createPendingServerAction,
  confirmPendingServerAction,
  revokePendingServerAction,
  updateLocationServerAction,
} from "./_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EmergencyHelpConfirmationPage(): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  return (
    <EmergencyConfirmationScreen
      services={{
        createDraft: createDraftServerAction,
        activate: activateServerAction,
        createPending: createPendingServerAction,
        confirmPending: confirmPendingServerAction,
        revokePending: revokePendingServerAction,
        updateLocation: updateLocationServerAction,
      }}
    />
  );
}
