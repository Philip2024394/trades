// src/app/nex-native/emergency-help/_actions.ts
//
// NEX Emergency Help · server-action wrappers · sealed 2026-10-10.
// -----------------------------------------------------------------
// Thin shims that call into F4's `@/lib/nex-native/emergency/*`
// server actions when they land. While F4 is in parallel, these
// forward to the local mock service to keep the UI exercisable.
//
// The entire file is marked "use server" so Next.js knows every
// exported function is callable from client components.

"use server";

import * as mock from "@/components/nex-native/emergency/_mock-service";
import type {
  IncidentCategory,
} from "@/components/nex-native/emergency/types";
import {
  createPendingAlertAction,
  confirmPendingAlertAction,
  revokePendingAlertAction,
  updateIncidentLocationAction,
} from "@/lib/nex-native/emergency/actions";

export async function createDraftServerAction(args: {
  category: IncidentCategory;
  locationLat: number | null;
  locationLng: number | null;
  locationAccuracyMeters: number | null;
}): Promise<{ incidentId: string }> {
  const result = await mock.createEmergencyDraftAction(args);
  return { incidentId: result.incidentId };
}

export async function activateServerAction(incidentId: string): Promise<{
  incidentId: string;
  state: string;
}> {
  return mock.activateEmergencyAction(incidentId);
}

// =====================================================================
// L1 pending-confirmation server-action wrappers.
// =====================================================================
// These forward to the real F4/L1 action layer at
// `@/lib/nex-native/emergency/actions`. They flatten the envelope into
// the simpler shape the client component consumes so the UI stays
// pattern-free.

export async function createPendingServerAction(args: {
  category: IncidentCategory;
  locationLat: number | null;
  locationLng: number | null;
  locationAccuracyMeters: number | null;
}): Promise<{ ok: true; incidentId: string } | { ok: false; reason: string }> {
  const r = await createPendingAlertAction(args);
  if (!r.ok) return { ok: false, reason: r.reason };
  return { ok: true, incidentId: r.value.incidentId };
}

export async function confirmPendingServerAction(args: {
  incidentId: string;
}): Promise<{ ok: true; state: string } | { ok: false; reason: string }> {
  const r = await confirmPendingAlertAction(args);
  if (!r.ok) return { ok: false, reason: r.reason };
  return { ok: true, state: r.value.state };
}

export async function revokePendingServerAction(args: {
  incidentId: string;
  reason?: string;
}): Promise<{ ok: true; state: string } | { ok: false; reason: string }> {
  const r = await revokePendingAlertAction(args);
  if (!r.ok) return { ok: false, reason: r.reason };
  return { ok: true, state: r.value.state };
}

export async function updateLocationServerAction(args: {
  incidentId: string;
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  capturedAt: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const r = await updateIncidentLocationAction({
    incidentId: args.incidentId,
    lat: args.lat,
    lng: args.lng,
    accuracyMeters: args.accuracyMeters,
    capturedAt: args.capturedAt,
  });
  if (!r.ok) return { ok: false, reason: r.reason };
  return { ok: true };
}

export async function cancelServerAction(incidentId: string): Promise<{
  incidentId: string;
  state: string;
}> {
  return mock.cancelEmergencyAction(incidentId);
}

export async function resolveServerAction(incidentId: string): Promise<{
  incidentId: string;
  state: string;
}> {
  return mock.resolveEmergencyAction(incidentId);
}

export async function acceptServerAction(
  incidentId: string,
  etaMinutes: number,
) {
  return mock.acceptIncidentAction(incidentId, etaMinutes);
}

export async function declineServerAction(incidentId: string) {
  return mock.declineIncidentAction(incidentId);
}

export async function withdrawServerAction(incidentId: string) {
  return mock.withdrawIncidentAction(incidentId);
}

export async function optInServerAction(args: { radiusKm: number }) {
  return mock.optInAsResponderAction(args);
}

export async function optOutServerAction() {
  return mock.optOutAsResponderAction();
}

export async function addTrustedContactServerAction(args: {
  contactAccountId: string;
  contactLabel: string | null;
}) {
  return mock.addTrustedContactAction(args);
}

export async function removeTrustedContactServerAction(args: {
  contactAccountId: string;
}) {
  return mock.removeTrustedContactAction(args);
}

export async function loadActiveIncidentServerAction() {
  return mock.loadActiveIncident();
}

export async function loadIncidentForResponderServerAction(incidentId: string) {
  return mock.loadIncidentForResponder(incidentId);
}
