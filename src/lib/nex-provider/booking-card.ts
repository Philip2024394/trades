// src/lib/nex-provider/booking-card.ts
//
// BOOKING CARD · data contracts for the chat window that transforms into a
// booking / trip interface.
//
// Doctrine anchors:
//   - Legal Boundary First (2026-08-23 CONSTITUTIONAL): the interface must not
//     be designed to hide what NEX actually does. Language is user-agentive:
//     "You requested a driver." / "Budi accepted your request." NOT: "NEX has
//     dispatched a driver."
//   - Business Suitability ≠ Business Quality: driver options present the
//     driver + vehicle + evidence · never a scarcity claim ("last available")
//     · never a hidden rank promotion.
//   - Truth Invariant: fare shown pre-acceptance is a reference range with
//     provenance · post-completion the actual fare comes from the trip_fare row.
//   - Reputation Non-Weapon: rating shown only when present · never "no rating
//     = bad driver" · never a shame indicator.
//
// This module is pure. It produces two card shapes the chat frontend renders.

import type { TripJobType, TripState } from "./provider-network-types";
import type { VehicleRepresentation } from "./vehicle-catalogue";
import type { TripProgress, TripProgressPhase } from "./trip-progress";
import type { LatLng } from "../nex-distance/distance-intelligence";
import { straightLineDistanceMeters } from "../nex-distance/distance-intelligence";

// ── SHARED SHAPES ─────────────────────────────────────────────────────

export interface DriverIdentity {
  driverId: string;
  displayName: string;
  rating: number | null;
  ratingCount: number;
}

export interface FareReferenceRange {
  minIdr: number;
  maxIdr: number;
  currency: "IDR";
  sourceRegulation: string;
  provenanceNote: string;
}

// ── PRE-ACCEPTANCE (user chooses from driver options) ──────────────────

export interface DriverOption {
  driver: DriverIdentity;
  vehicle: VehicleRepresentation;
  distanceMetersStraight: number;
  etaSecondsRough: number | null;
  freeTripsRemainingForDriver: number | null;
}

export interface BookingChoiceCard {
  requestId: string;
  jobType: TripJobType;
  pickup: LatLng;
  pickupLabel: string;
  destination: LatLng;
  destinationLabel: string;
  driverOptions: DriverOption[];
  fareReference: FareReferenceRange | null;
  interpretation: string;
  unknown: string;
  languageMode: "user_agentive";
}

export interface ComposeChoiceCardInput {
  requestId: string;
  jobType: TripJobType;
  pickup: LatLng;
  pickupLabel: string;
  destination: LatLng;
  destinationLabel: string;
  drivers: {
    driver: DriverIdentity;
    vehicle: VehicleRepresentation;
    currentLocation: LatLng;
    freeTripsRemainingForDriver: number | null;
  }[];
  fareReference: FareReferenceRange | null;
  averageMotorbikeSpeedKmh?: number;
}

export function composeBookingChoiceCard(input: ComposeChoiceCardInput): BookingChoiceCard {
  const speedMs = ((input.averageMotorbikeSpeedKmh ?? 25) * 1000) / 3600;

  const driverOptions: DriverOption[] = input.drivers.map((d) => {
    const dist = straightLineDistanceMeters(d.currentLocation, input.pickup);
    return {
      driver: d.driver,
      vehicle: d.vehicle,
      distanceMetersStraight: Math.round(dist),
      etaSecondsRough: Math.round(dist / speedMs),
      freeTripsRemainingForDriver: d.freeTripsRemainingForDriver,
    };
  }).sort((a, b) => a.distanceMetersStraight - b.distanceMetersStraight);

  const nDrivers = driverOptions.length;
  const interpretation = nDrivers === 0
    ? `You asked to arrange a ${humanJobType(input.jobType)}. NEX cannot show any authorised drivers matching this request right now.`
    : `You asked to arrange a ${humanJobType(input.jobType)}. NEX found ${nDrivers} authorised driver${nDrivers === 1 ? "" : "s"} nearby. Choose one to send a request.`;

  const unknown = "Distances shown are straight-line. Actual travel time depends on real roads, traffic and each driver's decisions. The fare below is a regulated reference range — not the actual price the driver will charge.";

  return {
    requestId: input.requestId,
    jobType: input.jobType,
    pickup: input.pickup,
    pickupLabel: input.pickupLabel,
    destination: input.destination,
    destinationLabel: input.destinationLabel,
    driverOptions,
    fareReference: input.fareReference,
    interpretation,
    unknown,
    languageMode: "user_agentive",
  };
}

// ── POST-ACCEPTANCE (live trip card) ───────────────────────────────────

export interface FinalFareSettlement {
  fareTotalIdr: number;
  nexCommissionIdr: number;
  driverPayoutIdr: number;
  isCommissionFreeTrip: boolean;
  currency: "IDR";
}

export interface ActiveTripCard {
  tripId: string;
  requestId: string;
  driver: DriverIdentity;
  vehicle: VehicleRepresentation;
  pickupLabel: string;
  destinationLabel: string;
  state: TripState;
  progress: TripProgress;
  fareReference: FareReferenceRange | null;
  finalFare: FinalFareSettlement | null;
  interpretation: string;
  unknown: string;
  languageMode: "user_agentive";
}

export interface ComposeActiveCardInput {
  tripId: string;
  requestId: string;
  driver: DriverIdentity;
  vehicle: VehicleRepresentation;
  pickupLabel: string;
  destinationLabel: string;
  state: TripState;
  progress: TripProgress;
  fareReference: FareReferenceRange | null;
  finalFare: FinalFareSettlement | null;
}

export function composeActiveTripCard(input: ComposeActiveCardInput): ActiveTripCard {
  const { driver, progress, finalFare, state } = input;
  const interpretation = renderInterpretation(driver.displayName, state, progress.phase, finalFare);
  const unknown = state === "completed"
    ? "Final fare shown reflects the completed-trip record. Any adjustment or refund will appear as a separate transaction."
    : progress.unknown;

  return {
    tripId: input.tripId,
    requestId: input.requestId,
    driver,
    vehicle: input.vehicle,
    pickupLabel: input.pickupLabel,
    destinationLabel: input.destinationLabel,
    state,
    progress,
    fareReference: input.fareReference,
    finalFare,
    interpretation,
    unknown,
    languageMode: "user_agentive",
  };
}

function renderInterpretation(
  displayName: string,
  state: TripState,
  phase: TripProgressPhase,
  finalFare: FinalFareSettlement | null,
): string {
  if (state === "cancelled_by_traveller") return `You cancelled the trip.`;
  if (state === "cancelled_by_driver")    return `${displayName} cancelled the trip.`;
  if (state === "cancelled_by_system")    return `The trip was cancelled.`;
  if (state === "completed" && finalFare) {
    return `Trip completed. Fare Rp ${finalFare.fareTotalIdr.toLocaleString("id-ID")} · NEX fee Rp ${finalFare.nexCommissionIdr.toLocaleString("id-ID")} · driver receives Rp ${finalFare.driverPayoutIdr.toLocaleString("id-ID")}.`;
  }
  if (state === "completed") return `Trip completed.`;
  switch (phase) {
    case "accepted":            return `${displayName} accepted your request.`;
    case "approaching_pickup":  return `${displayName} is on the way to your pickup.`;
    case "arrived_pickup":      return `${displayName} has arrived at the pickup point.`;
    case "en_route":            return `You are on your way to your destination.`;
    case "near_destination":    return `You are close to your destination.`;
    case "completed":           return `Trip completed.`;
    case "cancelled":           return `The trip was cancelled.`;
    case "requested":           return `You have requested ${displayName}.`;
  }
}

// ── HELPERS ────────────────────────────────────────────────────────────

function humanJobType(t: TripJobType): string {
  switch (t) {
    case "passenger_car":       return "car ride";
    case "passenger_motorbike": return "motorbike ride";
    case "hotel_to_airport":    return "hotel-to-airport transfer";
    case "airport_to_hotel":    return "airport-to-hotel transfer";
    case "shopping_pickup":     return "shopping pickup";
    case "local_delivery":      return "local delivery";
    case "luggage":             return "luggage transfer";
    case "family":              return "family transport";
    case "tourist_trip":        return "tourist trip";
  }
}
