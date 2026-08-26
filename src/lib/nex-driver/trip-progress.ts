// src/lib/nex-driver/trip-progress.ts
//
// TRIP PROGRESS · derives UI-facing phase + ETA + phase timer from the
// authoritative trip state + latest driver location + pickup/destination.
//
// Doctrine anchors:
//   - Legal Boundary First (2026-08-23): GPS never promotes a trip to
//     `completed`. Only `trip.state='completed'` sets phase='completed'.
//   - Truth Invariant (2026-08-22): ETA is approximate and always carries an
//     unknown-note.
//   - Traveller Protection Principle: the phase language is honest ·
//     "approaching pickup" is not "your driver has arrived" until state
//     reflects that.
//
// Pure. No live location provider. Takes the latest observation from caller.

import type { TripState } from "./driver-network-types";
import type { TripSnapshot } from "./trip-lifecycle";
import { straightLineDistanceMeters, type LatLng } from "../nex-distance/distance-intelligence";

export type TripProgressPhase =
  | "requested"           // request offered · no acceptance yet
  | "accepted"            // driver accepted · no movement observed yet
  | "approaching_pickup"
  | "arrived_pickup"
  | "en_route"
  | "near_destination"
  | "completed"
  | "cancelled";

export interface DeriveProgressInput {
  trip: TripSnapshot;
  pickup: LatLng;
  destination: LatLng;
  latestDriverLocation: LatLng | null;
  now: Date;
  arrivalThresholdMeters?: number;      // default 50m
  nearDestinationThresholdMeters?: number; // default 300m
  averageMotorbikeSpeedKmh?: number;    // default 25 km/h city speed for rough ETA
}

export interface TripProgress {
  phase: TripProgressPhase;
  phaseStartedAt: Date;
  elapsedSecondsInPhase: number;
  etaSecondsToPickup: number | null;
  etaSecondsToDestination: number | null;
  interpretation: string;
  unknown: string;
}

function isCancelledState(s: TripState): boolean {
  return s === "cancelled_by_traveller" || s === "cancelled_by_driver" || s === "cancelled_by_system";
}

export function deriveTripProgress(input: DeriveProgressInput): TripProgress {
  const {
    trip,
    pickup,
    destination,
    latestDriverLocation,
    now,
    arrivalThresholdMeters = 50,
    nearDestinationThresholdMeters = 300,
    averageMotorbikeSpeedKmh = 25,
  } = input;

  const secBetween = (a: Date, b: Date) => Math.max(0, Math.floor((b.getTime() - a.getTime()) / 1000));
  const speedMs = (averageMotorbikeSpeedKmh * 1000) / 3600;
  const etaFromDistance = (m: number | null) =>
    m == null ? null : Math.round(m / speedMs);

  const commonUnknown =
    "ETA is a rough estimate based on straight-line distance and an assumed city speed. Actual arrival depends on real roads, traffic, weather and the driver's decisions.";

  if (isCancelledState(trip.state)) {
    const at = trip.cancelledAt ?? trip.acceptedAt;
    return {
      phase: "cancelled",
      phaseStartedAt: at,
      elapsedSecondsInPhase: secBetween(at, now),
      etaSecondsToPickup: null,
      etaSecondsToDestination: null,
      interpretation: "The trip was cancelled.",
      unknown: "NEX does not have further evidence beyond the cancellation event.",
    };
  }

  if (trip.state === "completed") {
    const at = trip.completedAt ?? trip.acceptedAt;
    return {
      phase: "completed",
      phaseStartedAt: at,
      elapsedSecondsInPhase: secBetween(at, now),
      etaSecondsToPickup: null,
      etaSecondsToDestination: null,
      interpretation: "The trip is completed.",
      unknown: "GPS proximity does not by itself prove completion — completion here reflects the driver marking the trip as completed.",
    };
  }

  if (trip.state === "in_progress") {
    const distToDest = latestDriverLocation
      ? straightLineDistanceMeters(latestDriverLocation, destination)
      : null;
    const near = distToDest != null && distToDest <= nearDestinationThresholdMeters;
    const at = trip.startedAt ?? trip.acceptedAt;
    return {
      phase: near ? "near_destination" : "en_route",
      phaseStartedAt: at,
      elapsedSecondsInPhase: secBetween(at, now),
      etaSecondsToPickup: null,
      etaSecondsToDestination: etaFromDistance(distToDest),
      interpretation: near
        ? "You are close to your destination."
        : "You are on your way to your destination.",
      unknown: commonUnknown,
    };
  }

  if (trip.state === "driver_arrived") {
    const at = trip.driverArrivedAt ?? trip.acceptedAt;
    return {
      phase: "arrived_pickup",
      phaseStartedAt: at,
      elapsedSecondsInPhase: secBetween(at, now),
      etaSecondsToPickup: 0,
      etaSecondsToDestination: latestDriverLocation
        ? etaFromDistance(straightLineDistanceMeters(latestDriverLocation, destination))
        : etaFromDistance(straightLineDistanceMeters(pickup, destination)),
      interpretation: "Your driver has arrived at the pickup point.",
      unknown: commonUnknown,
    };
  }

  // trip.state === 'accepted'
  const distToPickup = latestDriverLocation
    ? straightLineDistanceMeters(latestDriverLocation, pickup)
    : null;
  if (distToPickup != null && distToPickup <= arrivalThresholdMeters) {
    return {
      phase: "arrived_pickup",
      phaseStartedAt: trip.acceptedAt,
      elapsedSecondsInPhase: secBetween(trip.acceptedAt, now),
      etaSecondsToPickup: 0,
      etaSecondsToDestination: etaFromDistance(
        latestDriverLocation ? straightLineDistanceMeters(latestDriverLocation, destination) : null,
      ),
      interpretation:
        "Driver's GPS is currently observed near the pickup point. Waiting for the driver to confirm arrival.",
      unknown:
        "GPS proximity does not by itself confirm the driver is at the pickup point ready to depart. The driver must mark arrival.",
    };
  }
  if (latestDriverLocation) {
    return {
      phase: "approaching_pickup",
      phaseStartedAt: trip.acceptedAt,
      elapsedSecondsInPhase: secBetween(trip.acceptedAt, now),
      etaSecondsToPickup: etaFromDistance(distToPickup),
      etaSecondsToDestination: etaFromDistance(distToPickup) != null
        ? etaFromDistance(distToPickup)! + etaFromDistance(straightLineDistanceMeters(pickup, destination))!
        : null,
      interpretation: "Your driver is approaching the pickup point.",
      unknown: commonUnknown,
    };
  }
  return {
    phase: "accepted",
    phaseStartedAt: trip.acceptedAt,
    elapsedSecondsInPhase: secBetween(trip.acceptedAt, now),
    etaSecondsToPickup: null,
    etaSecondsToDestination: null,
    interpretation: "Your driver accepted the request. Waiting for the driver's location.",
    unknown:
      "NEX has no fresh location for the driver yet. The driver may still be starting the app or preparing to travel.",
  };
}
