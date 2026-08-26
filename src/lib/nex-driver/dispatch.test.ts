// src/lib/nex-driver/dispatch.test.ts
//
// Dispatch bright-line tests. Rules under test:
//
//   1. Default env → STAGE_A_ONLY / DISPATCH_FLAG_NOT_ENABLED
//   2. Flag on but jurisdiction not allowed → STAGE_A_ONLY / JURISDICTION_NOT_IN_ALLOWLIST
//   3. Verified · online · consented · fresh · job-type-ok · wallet-ok · in-radius = MATCH
//   4. Filters (per-reason counts exposed): not_verified · not_online · no_live_consent
//      · no_location · no_heartbeat · stale_heartbeat · job_type_unsupported ·
//      wallet_insufficient · outside_radius
//   5. Wallet-insufficient drivers WITH free-trip allowance remaining ARE dispatchable
//   6. Wallet-insufficient drivers WITHOUT free-trip allowance are NOT dispatchable
//   7. Stale heartbeat filtered
//   8. Un-consented driver never matched even when online

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { findDispatchMatches, type AvailableDriver, type DispatchRequest } from "./dispatch";
import type { DriverSnapshot } from "./driver-registration";
import type { CommissionPolicy, TripJobType } from "./driver-network-types";
import type { WalletSnapshot } from "./wallet";
import type { TransportLegalModelRow } from "../nex-legal/transport-legal-model";

const APPROVED_LEGAL_MODEL: TransportLegalModelRow = {
  legalModelId: "lm-1",
  jurisdiction: "ID/DIY/Yogyakarta",
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  effectiveTo: null,
  nexRole: "intermediary",
  driverRole: "independent driver operator",
  operatorLicenceRef: "op-1",
  insuranceRequirements: {},
  applicableRegulations: ["PM 118/2018", "PM 17/2019"],
  documentReference: "doc://legal/test",
  status: "approved",
  approvedBy: "legal.head",
  approvedAt: new Date("2026-08-01T00:00:00Z"),
  notes: null,
};

const ORIGIN = { lat: -7.7828, lng: 110.3671 };
const NEARBY = { lat: -7.7830, lng: 110.3675 };
const FAR    = { lat: -7.6800, lng: 110.4900 };

const POLICY: CommissionPolicy = {
  policyId: "policy-1",
  jurisdiction: "ID/DIY/Yogyakarta",
  jobType: null,
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  effectiveTo: null,
  freeCompletedTripsPerMonth: 3,
  rateAfterFree: 0.08,
  minWalletBalanceIdr: 0,
  walletTopupUnitIdr: 10000,
  currency: "IDR",
  notes: null,
};

function mkVerifiedDriver(id: string): DriverSnapshot {
  return {
    driverId: id,
    status: "documents_verified",
    vehicleKind: "motorbike",
    suspendedAt: null,
    suspendedReason: null,
    documents: [],
  };
}

function mkWallet(id: string, balance = 0): WalletSnapshot {
  return { driverId: id, balanceIdr: balance, currency: "IDR", updatedAt: new Date("2026-08-23T00:00:00Z") };
}

function mkAvailable(
  driver: DriverSnapshot,
  overrides: Partial<AvailableDriver> = {},
): AvailableDriver {
  return {
    driver,
    availability: "online",
    hasLiveConsent: true,
    lastHeartbeatAt: new Date("2026-08-23T10:00:00Z"),
    currentLocation: NEARBY,
    supportedJobTypes: ["passenger_motorbike"],
    wallet: mkWallet(driver.driverId, 0),
    completedTripsThisMonth: 0,   // within free-trip allowance
    ...overrides,
  };
}

function mkRequest(
  jobType: TripJobType = "passenger_motorbike",
  legalModelRows: TransportLegalModelRow[] = [APPROVED_LEGAL_MODEL],
): DispatchRequest {
  return {
    jobType,
    jurisdiction: "ID/DIY/Yogyakarta",
    origin: ORIGIN,
    requestedAt: new Date("2026-08-23T10:01:00Z"),
    policy: POLICY,
    legalModelRows,
  };
}

beforeEach(() => {
  delete process.env.NEX_DRIVER_DISPATCH_ENABLED;
  delete process.env.NEX_DRIVER_DISPATCH_JURISDICTION_ALLOWLIST;
});
afterEach(() => {
  delete process.env.NEX_DRIVER_DISPATCH_ENABLED;
  delete process.env.NEX_DRIVER_DISPATCH_JURISDICTION_ALLOWLIST;
});

describe("Dispatch · Stage-A gate", () => {
  it("refuses when NEX_DRIVER_DISPATCH_ENABLED is unset", () => {
    const r = findDispatchMatches(mkRequest(), [mkAvailable(mkVerifiedDriver("d1"))]);
    expect(r.status).toBe("STAGE_A_ONLY");
    if (r.status === "STAGE_A_ONLY") expect(r.reason).toBe("DISPATCH_FLAG_NOT_ENABLED");
  });

  it("refuses when jurisdiction not in allowlist even with flag=true", () => {
    process.env.NEX_DRIVER_DISPATCH_ENABLED = "true";
    process.env.NEX_DRIVER_DISPATCH_JURISDICTION_ALLOWLIST = "ID/Central-Java/Magelang";
    const r = findDispatchMatches(mkRequest(), [mkAvailable(mkVerifiedDriver("d1"))]);
    expect(r.status).toBe("STAGE_A_ONLY");
    if (r.status === "STAGE_A_ONLY") expect(r.reason).toBe("JURISDICTION_NOT_IN_ALLOWLIST");
  });

  it("refuses when allowlist is missing entirely", () => {
    process.env.NEX_DRIVER_DISPATCH_ENABLED = "true";
    const r = findDispatchMatches(mkRequest(), [mkAvailable(mkVerifiedDriver("d1"))]);
    expect(r.status).toBe("STAGE_A_ONLY");
  });
});

describe("Dispatch · legal-model gate (third Stage-B gate)", () => {
  beforeEach(() => {
    process.env.NEX_DRIVER_DISPATCH_ENABLED = "true";
    process.env.NEX_DRIVER_DISPATCH_JURISDICTION_ALLOWLIST = "ID/DIY/Yogyakarta";
  });

  it("refuses when legalModelRows is empty (no research done)", () => {
    const r = findDispatchMatches(mkRequest("passenger_motorbike", []), [
      mkAvailable(mkVerifiedDriver("d1")),
    ]);
    expect(r.status).toBe("STAGE_A_ONLY");
    if (r.status === "STAGE_A_ONLY") {
      expect(r.reason).toBe("LEGAL_MODEL_NOT_APPROVED");
      expect(r.legalGateReason).toBe("NO_ROW_FOR_JURISDICTION");
    }
  });

  it("refuses when legal model is in 'researching' status", () => {
    const researching: TransportLegalModelRow = { ...APPROVED_LEGAL_MODEL, status: "researching" };
    const r = findDispatchMatches(mkRequest("passenger_motorbike", [researching]), [
      mkAvailable(mkVerifiedDriver("d1")),
    ]);
    expect(r.status).toBe("STAGE_A_ONLY");
    if (r.status === "STAGE_A_ONLY") expect(r.legalGateReason).toBe("STATUS_NOT_APPROVED");
  });

  it("refuses when nex_role is 'undetermined' even if 'approved'", () => {
    const bad: TransportLegalModelRow = { ...APPROVED_LEGAL_MODEL, nexRole: "undetermined" };
    const r = findDispatchMatches(mkRequest("passenger_motorbike", [bad]), [
      mkAvailable(mkVerifiedDriver("d1")),
    ]);
    expect(r.status).toBe("STAGE_A_ONLY");
    if (r.status === "STAGE_A_ONLY") expect(r.legalGateReason).toBe("NEX_ROLE_UNDETERMINED");
  });

  it("refuses when approval metadata is missing (unattributable)", () => {
    const bad: TransportLegalModelRow = { ...APPROVED_LEGAL_MODEL, approvedBy: null };
    const r = findDispatchMatches(mkRequest("passenger_motorbike", [bad]), [
      mkAvailable(mkVerifiedDriver("d1")),
    ]);
    expect(r.status).toBe("STAGE_A_ONLY");
    if (r.status === "STAGE_A_ONLY") expect(r.legalGateReason).toBe("MISSING_APPROVAL_METADATA");
  });
});

describe("Dispatch · when all three gates open, filters correctly", () => {
  beforeEach(() => {
    process.env.NEX_DRIVER_DISPATCH_ENABLED = "true";
    process.env.NEX_DRIVER_DISPATCH_JURISDICTION_ALLOWLIST = "ID/DIY/Yogyakarta";
  });

  it("matches an eligible fresh consented in-radius driver", () => {
    const r = findDispatchMatches(mkRequest(), [
      mkAvailable(mkVerifiedDriver("d1")),
      mkAvailable(mkVerifiedDriver("d2"), { currentLocation: FAR }),
    ]);
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.matches.map((m) => m.driverId)).toEqual(["d1"]);
      expect(r.filteredByReason.outside_radius).toBe(1);
      expect(r.matches[0].freeTripsRemainingThisMonth).toBe(3);
    }
  });

  it("filters unverified drivers", () => {
    const unverified: DriverSnapshot = { ...mkVerifiedDriver("d1"), status: "documents_pending" };
    const r = findDispatchMatches(mkRequest(), [mkAvailable(unverified)]);
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.matches).toEqual([]);
      expect(r.filteredByReason.not_verified).toBe(1);
    }
  });

  it("filters offline drivers", () => {
    const r = findDispatchMatches(mkRequest(), [
      mkAvailable(mkVerifiedDriver("d1"), { availability: "offline" }),
    ]);
    if (r.status === "OK") {
      expect(r.matches).toEqual([]);
      expect(r.filteredByReason.not_online).toBe(1);
    }
  });

  it("filters drivers without live consent even when online", () => {
    const r = findDispatchMatches(mkRequest(), [
      mkAvailable(mkVerifiedDriver("d1"), { hasLiveConsent: false }),
    ]);
    if (r.status === "OK") {
      expect(r.matches).toEqual([]);
      expect(r.filteredByReason.no_live_consent).toBe(1);
    }
  });

  it("filters drivers whose heartbeat is stale (>120s by default)", () => {
    const stale = new Date("2026-08-23T09:58:00Z"); // 3 minutes before request
    const r = findDispatchMatches(mkRequest(), [
      mkAvailable(mkVerifiedDriver("d1"), { lastHeartbeatAt: stale }),
    ]);
    if (r.status === "OK") {
      expect(r.matches).toEqual([]);
      expect(r.filteredByReason.stale_heartbeat).toBe(1);
    }
  });

  it("filters drivers with no heartbeat at all", () => {
    const r = findDispatchMatches(mkRequest(), [
      mkAvailable(mkVerifiedDriver("d1"), { lastHeartbeatAt: null }),
    ]);
    if (r.status === "OK") {
      expect(r.matches).toEqual([]);
      expect(r.filteredByReason.no_heartbeat).toBe(1);
    }
  });

  it("filters drivers with no location", () => {
    const r = findDispatchMatches(mkRequest(), [
      mkAvailable(mkVerifiedDriver("d1"), { currentLocation: null }),
    ]);
    if (r.status === "OK") {
      expect(r.matches).toEqual([]);
      expect(r.filteredByReason.no_location).toBe(1);
    }
  });

  it("filters drivers who don't support the requested job type", () => {
    const r = findDispatchMatches(mkRequest("hotel_to_airport"), [
      mkAvailable(mkVerifiedDriver("d1")), // supports passenger_motorbike only
    ]);
    if (r.status === "OK") {
      expect(r.matches).toEqual([]);
      expect(r.filteredByReason.job_type_unsupported).toBe(1);
    }
  });

  it("wallet-insufficient driver PAST free-trip allowance is FILTERED", () => {
    const noWallet: AvailableDriver = mkAvailable(mkVerifiedDriver("d1"), {
      wallet: mkWallet("d1", -100),         // negative balance
      completedTripsThisMonth: 10,          // past allowance
    });
    const r = findDispatchMatches(mkRequest(), [noWallet]);
    if (r.status === "OK") {
      expect(r.matches).toEqual([]);
      expect(r.filteredByReason.wallet_insufficient).toBe(1);
    }
  });

  it("wallet-insufficient driver WITHIN free-trip allowance IS dispatchable", () => {
    const newDriver: AvailableDriver = mkAvailable(mkVerifiedDriver("d1"), {
      wallet: mkWallet("d1", 0),            // zero balance
      completedTripsThisMonth: 2,           // still has 1 free trip remaining
    });
    const r = findDispatchMatches(mkRequest(), [newDriver]);
    if (r.status === "OK") {
      expect(r.matches.map((m) => m.driverId)).toEqual(["d1"]);
      expect(r.matches[0].freeTripsRemainingThisMonth).toBe(1);
      expect(r.filteredByReason.wallet_insufficient).toBe(0);
    }
  });

  it("driver past allowance WITH sufficient wallet IS dispatchable", () => {
    const paidUp: AvailableDriver = mkAvailable(mkVerifiedDriver("d1"), {
      wallet: mkWallet("d1", 5000),
      completedTripsThisMonth: 10,
    });
    const r = findDispatchMatches(mkRequest(), [paidUp]);
    if (r.status === "OK") {
      expect(r.matches.map((m) => m.driverId)).toEqual(["d1"]);
      expect(r.matches[0].walletBalanceIdr).toBe(5000);
      expect(r.matches[0].freeTripsRemainingThisMonth).toBe(0);
    }
  });

  it("sorts matches by proximity ascending", () => {
    const CLOSE = { lat: -7.7828, lng: 110.3671 };
    const NEAR  = { lat: -7.7830, lng: 110.3675 };
    const MID   = { lat: -7.7900, lng: 110.3750 };
    const r = findDispatchMatches(mkRequest(), [
      mkAvailable(mkVerifiedDriver("mid"),  { currentLocation: MID }),
      mkAvailable(mkVerifiedDriver("close"),{ currentLocation: CLOSE }),
      mkAvailable(mkVerifiedDriver("near"), { currentLocation: NEAR }),
    ]);
    if (r.status === "OK") {
      expect(r.matches.map((m) => m.driverId)).toEqual(["close", "near", "mid"]);
    }
  });
});
