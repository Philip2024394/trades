// src/lib/nex-provider/dispatch.ts
//
// DISPATCH · Stage-B activation-gated matching.
//
// Doctrine anchors:
//   - Driver Network authorised-only design (2026-08-23 CONSTITUTIONAL)
//   - NEX Driver commission model (2026-08-23 REVISED): 3 free trips/month · 8%
//     thereafter · wallet floor gates dispatch for post-allowance drivers.
//   - Truth Invariant (2026-08-22): every match cites the driver's live consent.
//   - Parallel-development principle (2026-08-23): Stage A infra ships now, Stage
//     B activation waits behind explicit env flag + jurisdiction allowlist.
//
// Stage-A / Stage-B gate:
//   Dispatch REFUSES to return matches unless BOTH hold:
//     1. process.env.NEX_DRIVER_DISPATCH_ENABLED === 'true'
//     2. process.env.NEX_DRIVER_DISPATCH_JURISDICTION_ALLOWLIST contains the jurisdiction
//
// Per-driver filters applied (in order):
//   - eligible: driver.status === 'documents_verified'
//   - available: availability === 'online'
//   - consented: hasLiveConsent
//   - located: currentLocation present
//   - fresh: lastHeartbeatAt within maxHeartbeatAgeSeconds (default 120s)
//   - job-type supported
//   - wallet dispatchable: (within free-trip allowance) OR (balance >= floor)
//   - within radius
//
// Default absence-of-env is REFUSE. The returned STAGE_A_ONLY response carries
// a specific reason so operators can see exactly why dispatch is held.

import type { TripJobType, DriverAvailabilityState, CommissionPolicy } from "./provider-network-types";
import type { DriverSnapshot } from "./provider-registration";
import type { WalletSnapshot } from "./wallet";
import { isDriverEligibleForDispatch } from "./provider-registration";
import { isWalletDispatchable } from "./wallet";
import { straightLineDistanceMeters, type LatLng } from "../nex-distance/distance-intelligence";
import { checkLegalGate, type TransportLegalModelRow } from "../nex-legal/transport-legal-model";

export interface AvailableDriver {
  driver: DriverSnapshot;
  availability: DriverAvailabilityState;
  hasLiveConsent: boolean;
  lastHeartbeatAt: Date | null;
  currentLocation: LatLng | null;
  supportedJobTypes: TripJobType[];
  wallet: WalletSnapshot;
  completedTripsThisMonth: number;
}

export interface DispatchRequest {
  jobType: TripJobType;
  jurisdiction: string;
  origin: LatLng;
  requestedAt: Date;
  policy: CommissionPolicy;
  legalModelRows: TransportLegalModelRow[];   // supplied by caller · fetched from nex.transport_legal_model
  maxRadiusMeters?: number;                   // default 3000m for city work
  maxHeartbeatAgeSeconds?: number;            // default 120s · driver must be fresh
}

export interface DispatchMatch {
  driverId: string;
  distanceMetersStraight: number;
  lastHeartbeatAgeSeconds: number;
  walletBalanceIdr: number;
  freeTripsRemainingThisMonth: number;
}

export type DispatchFilterReason =
  | "not_verified"
  | "not_online"
  | "no_live_consent"
  | "no_location"
  | "no_heartbeat"
  | "stale_heartbeat"
  | "job_type_unsupported"
  | "wallet_insufficient"
  | "outside_radius";

export interface DispatchOK {
  status: "OK";
  request: DispatchRequest;
  matches: DispatchMatch[];
  consideredCount: number;
  filteredByReason: Record<DispatchFilterReason, number>;
}

export interface DispatchStageAOnly {
  status: "STAGE_A_ONLY";
  reason:
    | "DISPATCH_FLAG_NOT_ENABLED"
    | "JURISDICTION_NOT_IN_ALLOWLIST"
    | "LEGAL_MODEL_NOT_APPROVED";
  detail: string;
  legalGateReason?: string;
}

export type DispatchResult = DispatchOK | DispatchStageAOnly;

// ── Gate check ─────────────────────────────────────────────────────────
export function dispatchIsEnabled(jurisdiction: string): { ok: boolean; reason?: DispatchStageAOnly["reason"] } {
  if (process.env.NEX_DRIVER_DISPATCH_ENABLED !== "true") {
    return { ok: false, reason: "DISPATCH_FLAG_NOT_ENABLED" };
  }
  const allow = (process.env.NEX_DRIVER_DISPATCH_JURISDICTION_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allow.length === 0 || !allow.includes(jurisdiction)) {
    return { ok: false, reason: "JURISDICTION_NOT_IN_ALLOWLIST" };
  }
  return { ok: true };
}

// ── Matcher (pure) ─────────────────────────────────────────────────────
export function findDispatchMatches(
  request: DispatchRequest,
  pool: AvailableDriver[],
): DispatchResult {
  // Gate 1: runtime env flag
  const gate = dispatchIsEnabled(request.jurisdiction);
  if (!gate.ok) {
    return {
      status: "STAGE_A_ONLY",
      reason: gate.reason!,
      detail:
        gate.reason === "DISPATCH_FLAG_NOT_ENABLED"
          ? "NEX Driver dispatch is Stage-A only. Live dispatch requires NEX_DRIVER_DISPATCH_ENABLED='true' AND explicit legal/operator/insurance/KYC/payment activation."
          : `Jurisdiction ${request.jurisdiction} is not in the dispatch allowlist. NEX will not dispatch here until legal activation.`,
    };
  }

  // Gate 2: legal-model registry must have an APPROVED row covering now
  const legal = checkLegalGate(request.jurisdiction, request.requestedAt, request.legalModelRows);
  if (legal.status !== "APPROVED") {
    return {
      status: "STAGE_A_ONLY",
      reason: "LEGAL_MODEL_NOT_APPROVED",
      detail: `Dispatch refused for ${request.jurisdiction}. Legal boundary gate did not pass: ${legal.detail} No T&C or terminology change substitutes for this. See nex.transport_legal_model.`,
      legalGateReason: legal.reason,
    };
  }

  const radius = request.maxRadiusMeters ?? 3000;
  const maxAgeSec = request.maxHeartbeatAgeSeconds ?? 120;
  const now = request.requestedAt.getTime();

  const filteredByReason: Record<DispatchFilterReason, number> = {
    not_verified: 0,
    not_online: 0,
    no_live_consent: 0,
    no_location: 0,
    no_heartbeat: 0,
    stale_heartbeat: 0,
    job_type_unsupported: 0,
    wallet_insufficient: 0,
    outside_radius: 0,
  };

  const matches: DispatchMatch[] = [];

  for (const entry of pool) {
    if (!isDriverEligibleForDispatch(entry.driver)) { filteredByReason.not_verified++; continue; }
    if (entry.availability !== "online")             { filteredByReason.not_online++; continue; }
    if (!entry.hasLiveConsent)                       { filteredByReason.no_live_consent++; continue; }
    if (!entry.currentLocation)                      { filteredByReason.no_location++; continue; }
    if (!entry.lastHeartbeatAt)                      { filteredByReason.no_heartbeat++; continue; }
    if ((now - entry.lastHeartbeatAt.getTime()) / 1000 > maxAgeSec) {
      filteredByReason.stale_heartbeat++;
      continue;
    }
    if (!entry.supportedJobTypes.includes(request.jobType)) {
      filteredByReason.job_type_unsupported++;
      continue;
    }
    const walletCheck = isWalletDispatchable(
      entry.wallet,
      entry.completedTripsThisMonth,
      request.policy,
    );
    if (!walletCheck.dispatchable) {
      filteredByReason.wallet_insufficient++;
      continue;
    }
    const dist = straightLineDistanceMeters(request.origin, entry.currentLocation);
    if (dist > radius) {
      filteredByReason.outside_radius++;
      continue;
    }
    matches.push({
      driverId: entry.driver.driverId,
      distanceMetersStraight: dist,
      lastHeartbeatAgeSeconds: (now - entry.lastHeartbeatAt.getTime()) / 1000,
      walletBalanceIdr: entry.wallet.balanceIdr,
      freeTripsRemainingThisMonth: Math.max(
        0,
        request.policy.freeCompletedTripsPerMonth - entry.completedTripsThisMonth,
      ),
    });
  }

  matches.sort((a, b) => a.distanceMetersStraight - b.distanceMetersStraight);

  return {
    status: "OK",
    request,
    matches,
    consideredCount: pool.length,
    filteredByReason,
  };
}
