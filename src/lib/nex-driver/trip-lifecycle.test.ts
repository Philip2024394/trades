// src/lib/nex-driver/trip-lifecycle.test.ts

import { describe, it, expect } from "vitest";
import {
  transitionTrip,
  isTripEligibleForFareCommission,
  isTerminal,
  TripStateError,
  type TripSnapshot,
} from "./trip-lifecycle";
import type { TripState } from "./driver-network-types";

function mkTrip(state: TripState = "accepted"): TripSnapshot {
  return {
    tripId: "trip-1",
    driverId: "d-1",
    jobType: "passenger_motorbike",
    jurisdiction: "ID/DIY/Yogyakarta",
    state,
    acceptedAt: new Date("2026-08-23T10:00:00Z"),
    driverArrivedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelReason: null,
  };
}

describe("Trip lifecycle · happy path accepted → driver_arrived → in_progress → completed", () => {
  it("walks through timestamps in order", () => {
    let t = mkTrip("accepted");
    t = transitionTrip(t, "driver_arrived", { now: new Date("2026-08-23T10:05:00Z") });
    expect(t.state).toBe("driver_arrived");
    expect(t.driverArrivedAt?.toISOString()).toBe("2026-08-23T10:05:00.000Z");

    t = transitionTrip(t, "in_progress", { now: new Date("2026-08-23T10:07:00Z") });
    expect(t.state).toBe("in_progress");
    expect(t.startedAt?.toISOString()).toBe("2026-08-23T10:07:00.000Z");

    t = transitionTrip(t, "completed", { now: new Date("2026-08-23T10:30:00Z") });
    expect(t.state).toBe("completed");
    expect(t.completedAt?.toISOString()).toBe("2026-08-23T10:30:00.000Z");
    expect(isTripEligibleForFareCommission(t)).toBe(true);
  });
});

describe("Trip lifecycle · illegal transitions throw", () => {
  it("cannot skip driver_arrived and go straight to in_progress", () => {
    expect(() =>
      transitionTrip(mkTrip("accepted"), "in_progress"),
    ).toThrow(TripStateError);
  });

  it("cannot skip in_progress and go straight to completed", () => {
    expect(() =>
      transitionTrip(mkTrip("accepted"), "completed"),
    ).toThrow(TripStateError);
  });

  it("cannot re-enter a terminal state", () => {
    expect(() =>
      transitionTrip(mkTrip("completed"), "in_progress"),
    ).toThrow(/terminal/i);
  });

  it("cannot leave a cancelled state", () => {
    expect(() =>
      transitionTrip(mkTrip("cancelled_by_traveller"), "in_progress"),
    ).toThrow(/terminal/i);
  });
});

describe("Trip lifecycle · cancellation requires a reason", () => {
  it("throws when cancelReason is missing", () => {
    expect(() =>
      transitionTrip(mkTrip("accepted"), "cancelled_by_traveller"),
    ).toThrow(/reason/i);
  });

  it("throws when cancelReason is whitespace", () => {
    expect(() =>
      transitionTrip(mkTrip("accepted"), "cancelled_by_traveller", { cancelReason: "   " }),
    ).toThrow(/reason/i);
  });

  it("records the cancellation reason", () => {
    const t = transitionTrip(mkTrip("driver_arrived"), "cancelled_by_driver", {
      cancelReason: "vehicle_issue",
      now: new Date("2026-08-23T10:10:00Z"),
    });
    expect(t.state).toBe("cancelled_by_driver");
    expect(t.cancelReason).toBe("vehicle_issue");
    expect(t.cancelledAt).toBeTruthy();
  });
});

describe("Trip lifecycle · commission eligibility gate", () => {
  it("non-completed trips are NEVER eligible", () => {
    const states: TripState[] = [
      "accepted",
      "driver_arrived",
      "in_progress",
      "cancelled_by_traveller",
      "cancelled_by_driver",
      "cancelled_by_system",
    ];
    for (const s of states) {
      expect(isTripEligibleForFareCommission(mkTrip(s))).toBe(false);
    }
  });

  it("completed without completedAt is NOT eligible (defensive check)", () => {
    const t: TripSnapshot = { ...mkTrip("completed"), completedAt: null };
    expect(isTripEligibleForFareCommission(t)).toBe(false);
  });
});

describe("Trip lifecycle · terminality helper", () => {
  it("reports terminal states correctly", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("cancelled_by_traveller")).toBe(true);
    expect(isTerminal("cancelled_by_driver")).toBe(true);
    expect(isTerminal("cancelled_by_system")).toBe(true);
    expect(isTerminal("accepted")).toBe(false);
    expect(isTerminal("driver_arrived")).toBe(false);
    expect(isTerminal("in_progress")).toBe(false);
  });
});
