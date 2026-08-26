// src/lib/nex-driver/gps-interpretation.ts
//
// GPS INTERPRETATION · never turns a location signal into certainty.
//
// Doctrine anchors:
//   - Legal Boundary First (2026-08-23 CONSTITUTIONAL): GPS data can be
//     incomplete or inaccurate. "Driver location was recorded near destination"
//     is acceptable if actually supported. "Driver definitely delivered
//     passenger" is NEVER acceptable from GPS alone.
//   - Truth Invariant (2026-08-22): every claim carries evidence + provenance.
//   - Reputation Non-Weapon (2026-08-23): a driver must never be branded on
//     the basis of an ambiguous GPS reading.
//
// Bright-line rules enforced here:
//   1. This module NEVER returns a boolean "delivered" or "arrived".
//   2. It returns a description of what the GPS observation permits NEX to say
//      + an explicit unknown-note.
//   3. Very high accuracy readings (small accuracy_meters) still do not imply
//      delivery · they only support proximity.
//   4. Missing GPS = observation absent · never "did not arrive".

import { straightLineDistanceMeters, type LatLng } from "../nex-distance/distance-intelligence";

export interface LocationObservation {
  lat: number;
  lng: number;
  observedAt: Date;
  accuracyMeters: number | null;
  consentId: string;   // provenance · GPS was authorised
}

export interface ProximityInterpretation {
  status: "OBSERVED_NEAR" | "OBSERVED_FAR" | "NO_OBSERVATIONS_IN_WINDOW";
  destination: LatLng;
  windowStart: Date;
  windowEnd: Date;
  closestObservation: {
    observedAt: Date;
    distanceMeters: number;
    accuracyMeters: number | null;
    consentId: string;
  } | null;
  interpretation: string;    // sentence NEX may honestly say
  unknown: string;           // sentence explicitly stating what this evidence does NOT prove
}

/**
 * Given an array of location observations and a destination, describe what the
 * observations permit NEX to say about proximity to the destination during a
 * time window. NEVER returns a delivered/arrived boolean.
 */
export function interpretProximityToDestination(
  observations: LocationObservation[],
  destination: LatLng,
  windowStart: Date,
  windowEnd: Date,
  proximityThresholdMeters: number = 100,
): ProximityInterpretation {
  const inWindow = observations.filter(
    (o) => o.observedAt.getTime() >= windowStart.getTime() && o.observedAt.getTime() <= windowEnd.getTime(),
  );

  if (inWindow.length === 0) {
    return {
      status: "NO_OBSERVATIONS_IN_WINDOW",
      destination,
      windowStart,
      windowEnd,
      closestObservation: null,
      interpretation:
        "NEX has no location observations for this driver in the requested window.",
      unknown:
        "Absence of GPS observations does NOT prove the driver was not there. The device may have been offline, unable to fix, or the driver may have moved without the app recording.",
    };
  }

  const scored = inWindow
    .map((o) => ({
      observation: o,
      distance: straightLineDistanceMeters(o, destination),
    }))
    .sort((a, b) => a.distance - b.distance);
  const closest = scored[0];

  const closestOut = {
    observedAt: closest.observation.observedAt,
    distanceMeters: Math.round(closest.distance),
    accuracyMeters: closest.observation.accuracyMeters,
    consentId: closest.observation.consentId,
  };

  if (closest.distance <= proximityThresholdMeters) {
    return {
      status: "OBSERVED_NEAR",
      destination,
      windowStart,
      windowEnd,
      closestObservation: closestOut,
      interpretation: `Driver's authorised GPS was observed within about ${Math.round(closest.distance)} m of the destination at ${closest.observation.observedAt.toISOString()}.`,
      unknown:
        "GPS proximity does NOT prove the passenger was delivered, that the driver stopped, that the passenger left the vehicle, or that the agreed service was completed. It only describes where the device was recorded.",
    };
  }

  return {
    status: "OBSERVED_FAR",
    destination,
    windowStart,
    windowEnd,
    closestObservation: closestOut,
    interpretation: `Closest GPS observation in the window is about ${Math.round(closest.distance)} m from the destination.`,
    unknown:
      "GPS distance does NOT by itself prove the driver failed to deliver. The passenger may have been dropped nearby by request, the destination coordinate may be imprecise, or the driver's device may have lost accuracy.",
  };
}
