// src/lib/nex-driver/booking-card.test.ts
//
// Bright-line: the interpretation field must NEVER use "NEX has dispatched"
// language. All phrasing is user-agentive.

import { describe, it, expect } from "vitest";
import {
  composeBookingChoiceCard,
  composeActiveTripCard,
  type FinalFareSettlement,
} from "./booking-card";
import type { VehicleRepresentation } from "./vehicle-catalogue";
import type { TripProgress } from "./trip-progress";
import type { TripSnapshot } from "./trip-lifecycle";
import type { TripState } from "./driver-network-types";
import { deriveTripProgress } from "./trip-progress";

const PICKUP = { lat: -7.7828, lng: 110.3671 };  // Malioboro
const DEST   = { lat: -7.9020, lng: 110.0524 };  // YIA
const NOW    = new Date("2026-08-23T10:20:00Z");

const VERIFIED_PCX: VehicleRepresentation = {
  driverId: "budi",
  isVerified: true,
  catalogueId: "cat-pcx",
  brand: "Honda",
  model: "PCX 160",
  vehicleClass: "motorbike_premium",
  imageRef: "img://honda-pcx-160",
  isPremiumClass: true,
  isDeprecatedEntry: false,
  unverifiedNote: null,
  provenance: {
    verificationState: "verified",
    verifiedBy: "admin.1",
    verifiedAt: new Date("2026-08-01T00:00:00Z"),
    classConfirmed: true,
  },
};

const UNVERIFIED_STAND_IN: VehicleRepresentation = {
  driverId: "andi",
  isVerified: false,
  catalogueId: null,
  brand: null,
  model: null,
  vehicleClass: null,
  imageRef: null,
  isPremiumClass: false,
  isDeprecatedEntry: false,
  unverifiedNote: "Driver has not declared a vehicle.",
  provenance: {
    verificationState: "no_declaration",
    verifiedBy: null,
    verifiedAt: null,
    classConfirmed: false,
  },
};

function trip(state: TripState = "accepted", overrides: Partial<TripSnapshot> = {}): TripSnapshot {
  return {
    tripId: "t1",
    driverId: "budi",
    jobType: "passenger_motorbike",
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

function progress(trip: TripSnapshot, latestDriverLocation: { lat: number; lng: number } | null = null): TripProgress {
  return deriveTripProgress({
    trip, pickup: PICKUP, destination: DEST, latestDriverLocation, now: NOW,
  });
}

describe("Booking choice card · NEVER uses 'NEX has dispatched' language", () => {
  it("interpretation is user-agentive ('You asked')", () => {
    const c = composeBookingChoiceCard({
      requestId: "r1",
      jobType: "passenger_motorbike",
      pickup: PICKUP,
      pickupLabel: "Malioboro Mall",
      destination: DEST,
      destinationLabel: "Yogyakarta Airport",
      drivers: [{
        driver: { driverId: "budi", displayName: "Budi", rating: 4.9, ratingCount: 128 },
        vehicle: VERIFIED_PCX,
        currentLocation: { lat: PICKUP.lat + 0.002, lng: PICKUP.lng },
        freeTripsRemainingForDriver: 2,
      }],
      fareReference: {
        minIdr: 27750, maxIdr: 34500, currency: "IDR",
        sourceRegulation: "KP 564/2022 · Zone I",
        provenanceNote: "Regulated reference range · not the actual price the driver will charge",
      },
    });
    expect(c.interpretation.toLowerCase()).toMatch(/^you asked/);
    expect(c.interpretation.toLowerCase()).not.toMatch(/nex has dispatched/);
    expect(c.interpretation.toLowerCase()).not.toMatch(/nex dispatched/);
    expect(c.languageMode).toBe("user_agentive");
  });

  it("sorted by straight-line proximity · closest first", () => {
    const c = composeBookingChoiceCard({
      requestId: "r1",
      jobType: "passenger_motorbike",
      pickup: PICKUP,
      pickupLabel: "Malioboro",
      destination: DEST,
      destinationLabel: "YIA",
      drivers: [
        { driver: { driverId: "far",  displayName: "Far",  rating: 4.8, ratingCount: 40 },
          vehicle: VERIFIED_PCX,
          currentLocation: { lat: PICKUP.lat + 0.02, lng: PICKUP.lng }, freeTripsRemainingForDriver: 3 },
        { driver: { driverId: "close", displayName: "Close", rating: 4.9, ratingCount: 90 },
          vehicle: VERIFIED_PCX,
          currentLocation: { lat: PICKUP.lat + 0.0005, lng: PICKUP.lng }, freeTripsRemainingForDriver: 1 },
      ],
      fareReference: null,
    });
    expect(c.driverOptions.map((d) => d.driver.driverId)).toEqual(["close", "far"]);
  });

  it("unverified vehicle passes through as unverified representation · never invented", () => {
    const c = composeBookingChoiceCard({
      requestId: "r1",
      jobType: "passenger_motorbike",
      pickup: PICKUP,
      pickupLabel: "Malioboro",
      destination: DEST,
      destinationLabel: "YIA",
      drivers: [{
        driver: { driverId: "andi", displayName: "Andi", rating: 4.6, ratingCount: 12 },
        vehicle: UNVERIFIED_STAND_IN,
        currentLocation: { lat: PICKUP.lat + 0.001, lng: PICKUP.lng },
        freeTripsRemainingForDriver: 3,
      }],
      fareReference: null,
    });
    expect(c.driverOptions[0].vehicle.isVerified).toBe(false);
    expect(c.driverOptions[0].vehicle.brand).toBeNull();
    expect(c.driverOptions[0].vehicle.unverifiedNote).toMatch(/has not declared/);
  });

  it("zero drivers → interpretation says NEX cannot show any authorised drivers · never fabricates", () => {
    const c = composeBookingChoiceCard({
      requestId: "r1",
      jobType: "passenger_motorbike",
      pickup: PICKUP,
      pickupLabel: "Malioboro",
      destination: DEST,
      destinationLabel: "YIA",
      drivers: [],
      fareReference: null,
    });
    expect(c.driverOptions).toEqual([]);
    expect(c.interpretation.toLowerCase()).toMatch(/cannot show any authorised drivers/);
  });
});

describe("Active trip card · user-agentive phase interpretation", () => {
  it("accepted → 'Budi accepted your request'", () => {
    const t = trip("accepted");
    const p = progress(t, null);
    const c = composeActiveTripCard({
      tripId: t.tripId,
      requestId: "r1",
      driver: { driverId: "budi", displayName: "Budi", rating: 4.9, ratingCount: 128 },
      vehicle: VERIFIED_PCX,
      pickupLabel: "Malioboro",
      destinationLabel: "YIA",
      state: t.state,
      progress: p,
      fareReference: null,
      finalFare: null,
    });
    expect(c.interpretation).toBe("Budi accepted your request.");
    expect(c.interpretation.toLowerCase()).not.toMatch(/nex/);
  });

  it("driver_arrived → 'Budi has arrived at the pickup point'", () => {
    const t = trip("driver_arrived", { driverArrivedAt: new Date("2026-08-23T10:15:00Z") });
    const p = progress(t, PICKUP);
    const c = composeActiveTripCard({
      tripId: t.tripId,
      requestId: "r1",
      driver: { driverId: "budi", displayName: "Budi", rating: 4.9, ratingCount: 128 },
      vehicle: VERIFIED_PCX,
      pickupLabel: "Malioboro",
      destinationLabel: "YIA",
      state: t.state,
      progress: p,
      fareReference: null,
      finalFare: null,
    });
    expect(c.interpretation).toBe("Budi has arrived at the pickup point.");
  });

  it("in_progress · en_route → 'You are on your way'", () => {
    const t = trip("in_progress", { startedAt: new Date("2026-08-23T10:07:00Z") });
    const p = progress(t, { lat: -7.85, lng: 110.2 });
    const c = composeActiveTripCard({
      tripId: t.tripId,
      requestId: "r1",
      driver: { driverId: "budi", displayName: "Budi", rating: 4.9, ratingCount: 128 },
      vehicle: VERIFIED_PCX,
      pickupLabel: "Malioboro",
      destinationLabel: "YIA",
      state: t.state,
      progress: p,
      fareReference: null,
      finalFare: null,
    });
    expect(c.interpretation.toLowerCase()).toMatch(/you are on your way/);
  });

  it("completed with final fare → transparent settlement string", () => {
    const t = trip("completed", { completedAt: new Date("2026-08-23T10:19:00Z") });
    const p = progress(t, DEST);
    const finalFare: FinalFareSettlement = {
      fareTotalIdr: 70000,
      nexCommissionIdr: 5600,
      driverPayoutIdr: 64400,
      isCommissionFreeTrip: false,
      currency: "IDR",
    };
    const c = composeActiveTripCard({
      tripId: t.tripId,
      requestId: "r1",
      driver: { driverId: "budi", displayName: "Budi", rating: 4.9, ratingCount: 128 },
      vehicle: VERIFIED_PCX,
      pickupLabel: "Malioboro",
      destinationLabel: "YIA",
      state: t.state,
      progress: p,
      fareReference: null,
      finalFare,
    });
    expect(c.interpretation).toMatch(/Fare Rp 70\.000/);
    expect(c.interpretation).toMatch(/NEX fee Rp 5\.600/);
    expect(c.interpretation).toMatch(/driver receives Rp 64\.400/);
    expect(c.unknown.toLowerCase()).toMatch(/adjustment or refund/);
  });

  it("cancelled_by_traveller → 'You cancelled the trip'", () => {
    const t = trip("cancelled_by_traveller", {
      cancelledAt: new Date("2026-08-23T10:02:00Z"),
      cancelReason: "changed mind",
    });
    const p = progress(t, null);
    const c = composeActiveTripCard({
      tripId: t.tripId,
      requestId: "r1",
      driver: { driverId: "budi", displayName: "Budi", rating: 4.9, ratingCount: 128 },
      vehicle: VERIFIED_PCX,
      pickupLabel: "Malioboro",
      destinationLabel: "YIA",
      state: t.state,
      progress: p,
      fareReference: null,
      finalFare: null,
    });
    expect(c.interpretation).toBe("You cancelled the trip.");
  });

  it("cancelled_by_driver → '<Driver> cancelled the trip'", () => {
    const t = trip("cancelled_by_driver", {
      cancelledAt: new Date("2026-08-23T10:02:00Z"),
      cancelReason: "vehicle issue",
    });
    const p = progress(t, null);
    const c = composeActiveTripCard({
      tripId: t.tripId,
      requestId: "r1",
      driver: { driverId: "budi", displayName: "Budi", rating: 4.9, ratingCount: 128 },
      vehicle: VERIFIED_PCX,
      pickupLabel: "Malioboro",
      destinationLabel: "YIA",
      state: t.state,
      progress: p,
      fareReference: null,
      finalFare: null,
    });
    expect(c.interpretation).toBe("Budi cancelled the trip.");
  });
});
