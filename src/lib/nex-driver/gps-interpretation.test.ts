// src/lib/nex-driver/gps-interpretation.test.ts
//
// Bright-line: GPS observation NEVER becomes a delivery verdict.

import { describe, it, expect } from "vitest";
import { interpretProximityToDestination, type LocationObservation } from "./gps-interpretation";

const DEST = { lat: -7.7828, lng: 110.3671 }; // Malioboro pin
const CLOSE = { lat: -7.7828, lng: 110.3672 }; // ~11m east
const FAR = { lat: -7.7500, lng: 110.4200 };   // several km away

const WINDOW_START = new Date("2026-08-23T10:00:00Z");
const WINDOW_END = new Date("2026-08-23T10:30:00Z");

function obs(overrides: Partial<LocationObservation>): LocationObservation {
  return {
    lat: DEST.lat,
    lng: DEST.lng,
    observedAt: new Date("2026-08-23T10:15:00Z"),
    accuracyMeters: 8,
    consentId: "consent-1",
    ...overrides,
  };
}

describe("GPS interpretation · never returns a delivered/arrived boolean", () => {
  it("close observation returns OBSERVED_NEAR with a proximity-only sentence + explicit unknown-note", () => {
    const r = interpretProximityToDestination([obs({ lat: CLOSE.lat, lng: CLOSE.lng })], DEST, WINDOW_START, WINDOW_END);
    expect(r.status).toBe("OBSERVED_NEAR");
    expect(r.interpretation.toLowerCase()).not.toMatch(/delivered/);
    expect(r.interpretation.toLowerCase()).not.toMatch(/arrived/);
    expect(r.interpretation.toLowerCase()).toMatch(/observed within/i);
    expect(r.unknown.toLowerCase()).toMatch(/does not prove/);
  });

  it("far observation returns OBSERVED_FAR without accusing driver of failure", () => {
    const r = interpretProximityToDestination([obs({ lat: FAR.lat, lng: FAR.lng })], DEST, WINDOW_START, WINDOW_END);
    expect(r.status).toBe("OBSERVED_FAR");
    expect(r.interpretation.toLowerCase()).not.toMatch(/failed to deliver/);
    expect(r.interpretation.toLowerCase()).not.toMatch(/did not arrive/);
    expect(r.unknown.toLowerCase()).toMatch(/does not by itself prove/);
  });

  it("no observations in window returns NO_OBSERVATIONS_IN_WINDOW · absence is not evidence of absence", () => {
    const outside = obs({ observedAt: new Date("2026-08-23T09:00:00Z") });
    const r = interpretProximityToDestination([outside], DEST, WINDOW_START, WINDOW_END);
    expect(r.status).toBe("NO_OBSERVATIONS_IN_WINDOW");
    expect(r.unknown.toLowerCase()).toMatch(/does not prove the driver was not there/);
    expect(r.closestObservation).toBeNull();
  });
});

describe("GPS interpretation · consent provenance flows through", () => {
  it("closestObservation carries the consentId · every reading traces to authorisation", () => {
    const r = interpretProximityToDestination(
      [obs({ lat: CLOSE.lat, lng: CLOSE.lng, consentId: "consent-abc" })],
      DEST,
      WINDOW_START,
      WINDOW_END,
    );
    expect(r.closestObservation?.consentId).toBe("consent-abc");
  });
});

describe("GPS interpretation · high-accuracy reading still limited to proximity claim", () => {
  it("accuracy=1m + close observation · still only says 'observed within' · never 'delivered'", () => {
    const r = interpretProximityToDestination(
      [obs({ lat: CLOSE.lat, lng: CLOSE.lng, accuracyMeters: 1 })],
      DEST,
      WINDOW_START,
      WINDOW_END,
    );
    expect(r.status).toBe("OBSERVED_NEAR");
    expect(r.interpretation.toLowerCase()).not.toMatch(/delivered|completed the service|passenger left/);
  });
});
