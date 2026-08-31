// src/lib/nex-provider/trip-progress.test.ts

import { describe, it, expect } from "vitest";
import { deriveTripProgress } from "./trip-progress";
import type { TripSnapshot } from "./trip-lifecycle";
import type { TripState } from "./provider-network-types";

const PICKUP = { lat: -7.7828, lng: 110.3671 };  // Malioboro Mall
const DEST   = { lat: -7.9020, lng: 110.0524 };  // YIA airport
const NOW    = new Date("2026-08-23T10:20:00Z");

function trip(state: TripState = "accepted", overrides: Partial<TripSnapshot> = {}): TripSnapshot {
  return {
    tripId: "t1",
    driverId: "d1",
    jobType: "passenger_car",
    jurisdiction: "ID/DIY/Yogyakarta",
    state,
    acceptedAt: new Date("2026-08-23T10:00:00Z"),
    driverArrivedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelReason: null,
    ...overrides,
  };
}

describe("Trip progress · state=accepted derives from GPS", () => {
  it("no location yet → phase='accepted' with honest unknown note", () => {
    const p = deriveTripProgress({
      trip: trip("accepted"),
      pickup: PICKUP,
      destination: DEST,
      latestDriverLocation: null,
      now: NOW,
    });
    expect(p.phase).toBe("accepted");
    expect(p.etaSecondsToPickup).toBeNull();
    expect(p.interpretation.toLowerCase()).toMatch(/accepted the request/);
    expect(p.unknown.toLowerCase()).toMatch(/no fresh location/);
  });

  it("driver far from pickup → phase='approaching_pickup' with ETA", () => {
    const far = { lat: PICKUP.lat + 0.01, lng: PICKUP.lng + 0.01 }; // ~1500m
    const p = deriveTripProgress({
      trip: trip("accepted"),
      pickup: PICKUP,
      destination: DEST,
      latestDriverLocation: far,
      now: NOW,
    });
    expect(p.phase).toBe("approaching_pickup");
    expect(p.etaSecondsToPickup).toBeGreaterThan(0);
  });

  it("driver GPS near pickup while state=accepted → phase='arrived_pickup' with GPS-not-proof note", () => {
    const near = { lat: PICKUP.lat + 0.0002, lng: PICKUP.lng }; // ~22m
    const p = deriveTripProgress({
      trip: trip("accepted"),
      pickup: PICKUP,
      destination: DEST,
      latestDriverLocation: near,
      now: NOW,
    });
    expect(p.phase).toBe("arrived_pickup");
    expect(p.interpretation.toLowerCase()).toMatch(/observed near the pickup/);
    expect(p.unknown.toLowerCase()).toMatch(/does not by itself confirm/);
  });
});

describe("Trip progress · driver_arrived → phase='arrived_pickup'", () => {
  it("phase timer counts from driverArrivedAt", () => {
    const arrivedAt = new Date("2026-08-23T10:15:00Z");
    const p = deriveTripProgress({
      trip: trip("driver_arrived", { driverArrivedAt: arrivedAt }),
      pickup: PICKUP,
      destination: DEST,
      latestDriverLocation: PICKUP,
      now: NOW,
    });
    expect(p.phase).toBe("arrived_pickup");
    expect(p.phaseStartedAt.getTime()).toBe(arrivedAt.getTime());
    expect(p.elapsedSecondsInPhase).toBe(300);
  });
});

describe("Trip progress · in_progress → en_route or near_destination", () => {
  it("driver mid-route → phase='en_route' + ETA to destination", () => {
    const midRoute = { lat: -7.85, lng: 110.20 };
    const p = deriveTripProgress({
      trip: trip("in_progress", { startedAt: new Date("2026-08-23T10:07:00Z") }),
      pickup: PICKUP,
      destination: DEST,
      latestDriverLocation: midRoute,
      now: NOW,
    });
    expect(p.phase).toBe("en_route");
    expect(p.etaSecondsToDestination).toBeGreaterThan(0);
  });

  it("driver close to destination (<300m) → phase='near_destination'", () => {
    const closeToDest = { lat: DEST.lat + 0.0015, lng: DEST.lng };
    const p = deriveTripProgress({
      trip: trip("in_progress", { startedAt: new Date("2026-08-23T10:07:00Z") }),
      pickup: PICKUP,
      destination: DEST,
      latestDriverLocation: closeToDest,
      now: NOW,
    });
    expect(p.phase).toBe("near_destination");
    expect(p.interpretation.toLowerCase()).toMatch(/close to your destination/);
  });
});

describe("Trip progress · GPS NEVER promotes to completed", () => {
  it("driver GPS at destination while state=in_progress → phase stays near_destination (not completed)", () => {
    const atDest = { lat: DEST.lat, lng: DEST.lng };
    const p = deriveTripProgress({
      trip: trip("in_progress", { startedAt: new Date("2026-08-23T10:07:00Z") }),
      pickup: PICKUP,
      destination: DEST,
      latestDriverLocation: atDest,
      now: NOW,
    });
    expect(p.phase).toBe("near_destination");
    expect(p.phase).not.toBe("completed");
  });

  it("only trip.state=completed sets phase=completed", () => {
    const completedAt = new Date("2026-08-23T10:19:00Z");
    const p = deriveTripProgress({
      trip: trip("completed", { completedAt }),
      pickup: PICKUP,
      destination: DEST,
      latestDriverLocation: DEST,
      now: NOW,
    });
    expect(p.phase).toBe("completed");
    expect(p.unknown.toLowerCase()).toMatch(/gps proximity does not by itself prove completion/);
  });
});

describe("Trip progress · cancelled states → phase='cancelled'", () => {
  it("cancelled_by_traveller → phase='cancelled'", () => {
    const cancelledAt = new Date("2026-08-23T10:05:00Z");
    const p = deriveTripProgress({
      trip: trip("cancelled_by_traveller", { cancelledAt, cancelReason: "traveller changed mind" }),
      pickup: PICKUP,
      destination: DEST,
      latestDriverLocation: null,
      now: NOW,
    });
    expect(p.phase).toBe("cancelled");
    expect(p.etaSecondsToPickup).toBeNull();
  });
});

describe("Trip progress · ETA always carries an unknown-note", () => {
  it("in_progress with ETA → unknown mentions traffic / roads", () => {
    const p = deriveTripProgress({
      trip: trip("in_progress", { startedAt: new Date("2026-08-23T10:07:00Z") }),
      pickup: PICKUP,
      destination: DEST,
      latestDriverLocation: { lat: -7.85, lng: 110.20 },
      now: NOW,
    });
    expect(p.unknown.toLowerCase()).toMatch(/rough estimate|actual arrival/);
  });
});
