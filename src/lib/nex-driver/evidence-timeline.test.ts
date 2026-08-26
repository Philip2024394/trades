// src/lib/nex-driver/evidence-timeline.test.ts

import { describe, it, expect } from "vitest";
import { buildEvidenceTimeline, type TripEventRecord } from "./evidence-timeline";
import type { TripEventKind } from "./driver-network-types";

function mkEvent(
  kind: TripEventKind,
  occurredAt: string,
  actor: TripEventRecord["actor"] = "driver",
  overrides: Partial<TripEventRecord> = {},
): TripEventRecord {
  return {
    eventId: `evt-${kind}-${occurredAt}`,
    tripId: "trip-1",
    kind,
    occurredAt: new Date(occurredAt),
    actor,
    payload: {},
    ...overrides,
  };
}

describe("Evidence timeline · happy path all stages SUPPORTS", () => {
  it("classifies each recorded stage as SUPPORTS with observedAt", () => {
    const events: TripEventRecord[] = [
      mkEvent("request_offered", "2026-08-23T10:00:00Z", "system"),
      mkEvent("request_accepted", "2026-08-23T10:00:30Z", "driver"),
      mkEvent("driver_dispatched", "2026-08-23T10:01:00Z", "system"),
      mkEvent("driver_arrived", "2026-08-23T10:05:00Z", "driver"),
      mkEvent("trip_started", "2026-08-23T10:07:00Z", "driver"),
      mkEvent("trip_completed", "2026-08-23T10:30:00Z", "driver"),
    ];
    const t = buildEvidenceTimeline({ tripId: "trip-1", events, jobType: "passenger_motorbike" });
    for (const stage of t.stages) {
      expect(stage.classification).toBe("SUPPORTS");
      expect(stage.observedAt).not.toBeNull();
    }
    expect(t.overallUnknowns.toLowerCase()).toMatch(/does not declare fault/);
  });
});

describe("Evidence timeline · missing stage → UNAVAILABLE (never fabricated)", () => {
  it("gap between accepted and started is honestly reported", () => {
    const events: TripEventRecord[] = [
      mkEvent("request_offered", "2026-08-23T10:00:00Z", "system"),
      mkEvent("request_accepted", "2026-08-23T10:00:30Z", "driver"),
      // no dispatched · arrived · started
      mkEvent("trip_completed", "2026-08-23T10:30:00Z", "driver"),
    ];
    const t = buildEvidenceTimeline({ tripId: "trip-1", events, jobType: "passenger_motorbike" });
    const dispatched = t.stages.find((s) => s.stage === "driver_dispatched")!;
    const arrived    = t.stages.find((s) => s.stage === "driver_arrived")!;
    const started    = t.stages.find((s) => s.stage === "trip_started")!;
    expect(dispatched.classification).toBe("UNAVAILABLE");
    expect(arrived.classification).toBe("UNAVAILABLE");
    expect(started.classification).toBe("UNAVAILABLE");
    expect(dispatched.note.toLowerCase()).toMatch(/no recorded event|does not know/);
  });
});

describe("Evidence timeline · cancellation is a first-class stage", () => {
  it("cancellation appended with actor + timestamp", () => {
    const events: TripEventRecord[] = [
      mkEvent("request_offered", "2026-08-23T10:00:00Z", "system"),
      mkEvent("request_accepted", "2026-08-23T10:00:30Z", "driver"),
      mkEvent("trip_cancelled", "2026-08-23T10:02:00Z", "traveller"),
    ];
    const t = buildEvidenceTimeline({ tripId: "trip-1", events, jobType: "passenger_motorbike" });
    const cancel = t.stages.find((s) => s.stage === "trip_cancelled");
    expect(cancel).toBeDefined();
    expect(cancel!.classification).toBe("SUPPORTS");
    expect(cancel!.note.toLowerCase()).toMatch(/traveller/);
  });
});

describe("Evidence timeline · proximity at completion is included when destination + observations supplied", () => {
  it("close observation returns OBSERVED_NEAR without asserting delivery", () => {
    const events: TripEventRecord[] = [
      mkEvent("trip_completed", "2026-08-23T10:30:00Z", "driver"),
    ];
    const destination = { lat: -7.7828, lng: 110.3671 };
    const t = buildEvidenceTimeline({
      tripId: "trip-1",
      events,
      jobType: "passenger_motorbike",
      destination,
      locationObservations: [
        {
          lat: -7.7828, lng: 110.3672,   // ~11m from destination
          observedAt: new Date("2026-08-23T10:29:30Z"),
          accuracyMeters: 8,
          consentId: "consent-1",
        },
      ],
    });
    expect(t.proximityAtCompletion?.status).toBe("OBSERVED_NEAR");
    expect(t.proximityAtCompletion?.interpretation.toLowerCase()).not.toMatch(/delivered/);
  });
});

describe("Evidence timeline · never returns a fault verdict", () => {
  it("overallUnknowns explicitly says NEX does not declare fault", () => {
    const t = buildEvidenceTimeline({ tripId: "trip-1", events: [], jobType: "passenger_motorbike" });
    expect(t.overallUnknowns.toLowerCase()).toMatch(/does not declare fault/);
    expect(t.overallUnknowns.toLowerCase()).toMatch(/gaps mean nex did not record/);
  });
});
