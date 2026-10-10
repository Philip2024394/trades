// src/components/nex-native/emergency/_mock-service.ts
//
// NEX Emergency Help · temporary mock service · sealed 2026-10-10.
// -----------------------------------------------------------------
// This file exists ONLY while F4's `@/lib/nex-native/emergency/*`
// data layer is landing in parallel. UI should ALWAYS prefer the
// real imports once F4's module tree is on disk. See
// `docs/doctrine/nex-emergency-help-ui-2026-10-10.md` for the
// deletion checklist.
//
// Load-bearing anti-patterns:
//   · Do NOT consume this file from any production path once F4
//     ships. The server actions in `@/lib/nex-native/emergency`
//     take priority.
//   · Do NOT seed fake responders here · v1 must honestly report
//     "0 responding" when no fixture exists.
//   · Do NOT fabricate acceptance states · all actions here return
//     deterministic no-op results that leave the UI in its honest
//     empty state.

import type {
  EmergencyIncident,
  EmergencyResponderOptIn,
  IncidentCategory,
  IncidentRecipient,
  IncidentState,
  ResponseStatus,
  TrustedContactRow,
} from "./types";

const now = () => new Date().toISOString();

export function isEmergencyLiveMode(): boolean {
  // Pilot v1 · always false · the SIMULATED badge is always visible.
  return false;
}

interface MockDraftResult {
  incidentId: string;
  draft: EmergencyIncident;
}

export async function createEmergencyDraftAction(args: {
  category: IncidentCategory;
  locationLat: number | null;
  locationLng: number | null;
  locationAccuracyMeters: number | null;
}): Promise<MockDraftResult> {
  const incidentId = `sim-${Math.random().toString(36).slice(2, 10)}`;
  return {
    incidentId,
    draft: {
      incidentId,
      requesterAccountId: "mock-requester",
      state: "draft" as IncidentState,
      category: args.category,
      locationLat: args.locationLat,
      locationLng: args.locationLng,
      locationAccuracyMeters: args.locationAccuracyMeters,
      locationCapturedAt: now(),
      simulated: true,
      createdAt: now(),
      activatedAt: null,
      resolvedAt: null,
      cancelledAt: null,
      expiresAt: null,
    },
  };
}

export async function activateEmergencyAction(
  incidentId: string,
): Promise<{ incidentId: string; state: IncidentState }> {
  return { incidentId, state: "active" };
}

export async function cancelEmergencyAction(
  incidentId: string,
): Promise<{ incidentId: string; state: IncidentState }> {
  return { incidentId, state: "cancelled" };
}

export async function resolveEmergencyAction(
  incidentId: string,
): Promise<{ incidentId: string; state: IncidentState }> {
  return { incidentId, state: "resolved" };
}

export async function acceptIncidentAction(
  incidentId: string,
  etaMinutes: number,
): Promise<{ incidentId: string; status: ResponseStatus; etaMinutes: number }> {
  return { incidentId, status: "accepted", etaMinutes };
}

export async function declineIncidentAction(
  incidentId: string,
): Promise<{ incidentId: string; status: ResponseStatus }> {
  return { incidentId, status: "declined" };
}

export async function withdrawIncidentAction(
  incidentId: string,
): Promise<{ incidentId: string; status: ResponseStatus }> {
  return { incidentId, status: "withdrawn" };
}

export async function optInAsResponderAction(args: {
  radiusKm: number;
}): Promise<EmergencyResponderOptIn> {
  return {
    accountId: "mock-requester",
    optedInAt: now(),
    acknowledgedSafetyGuidanceAt: now(),
    radiusKm: args.radiusKm,
    simulated: true,
  };
}

export async function optOutAsResponderAction(): Promise<{ ok: true }> {
  return { ok: true };
}

export async function addTrustedContactAction(args: {
  contactAccountId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactLabel: string | null;
}): Promise<TrustedContactRow> {
  return {
    trustedContactId: `mock-tc-${Date.now()}`,
    ownerAccountId: "mock-requester",
    contactAccountId: args.contactAccountId ?? null,
    contactEmail: args.contactEmail ?? null,
    contactPhone: args.contactPhone ?? null,
    addedAt: now(),
    contactLabel: args.contactLabel,
  };
}

export async function removeTrustedContactAction(args: {
  trustedContactId?: string | null;
  contactAccountId?: string | null;
}): Promise<{ ok: true; trustedContactId: string | null; contactAccountId: string | null }> {
  return {
    ok: true,
    trustedContactId: args.trustedContactId ?? null,
    contactAccountId: args.contactAccountId ?? null,
  };
}

export async function loadActiveIncident(): Promise<{
  incident: EmergencyIncident | null;
  recipients: IncidentRecipient[];
}> {
  return { incident: null, recipients: [] };
}

export async function loadIncidentForResponder(_incidentId: string): Promise<{
  incident: EmergencyIncident | null;
  myRecipient: IncidentRecipient | null;
}> {
  return { incident: null, myRecipient: null };
}

export async function loadResponderOptIn(): Promise<EmergencyResponderOptIn | null> {
  return null;
}

export async function loadTrustedContacts(): Promise<TrustedContactRow[]> {
  return [];
}

export async function loadIncidentHistory(): Promise<EmergencyIncident[]> {
  return [];
}
