// src/lib/nex-provider/evidence-timeline.ts
//
// EVIDENCE TIMELINE · reconstructs what NEX actually observed during a trip
// for dispute investigation / authority requests.
//
// Doctrine anchors:
//   - Legal Boundary First (2026-08-23 CONSTITUTIONAL): NEX does NOT
//     automatically declare who is guilty. It reports:
//       Evidence supports
//       Evidence conflicts
//       Evidence unavailable
//   - Truth Invariant (2026-08-22): every stage of the timeline cites its
//     underlying event · never a summary invented above the evidence.
//   - Traveller Protection Principle: even in disputes, NEX must not
//     manufacture certainty.
//
// This module is a PURE composer. It takes trip events (from nex.trip_event)
// + optional location observations + destination coordinates and returns a
// per-stage classification. Callers may render the returned structure into
// prose, tables, or authority-response bundles.

import type { TripEventKind, TripJobType } from "./provider-network-types";
import type { LatLng } from "../nex-distance/distance-intelligence";
import {
  interpretProximityToDestination,
  type LocationObservation,
  type ProximityInterpretation,
} from "./gps-interpretation";

export interface TripEventRecord {
  eventId: string;
  tripId: string;
  kind: TripEventKind;
  occurredAt: Date;
  actor: "driver" | "traveller" | "system" | "admin" | null;
  payload: Record<string, unknown>;
}

export type EvidenceClassification = "SUPPORTS" | "CONFLICTS" | "UNAVAILABLE";

export interface TimelineStage {
  stage:
    | "request_offered"
    | "request_accepted"
    | "driver_dispatched"
    | "driver_arrived"
    | "trip_started"
    | "trip_completed"
    | "trip_cancelled";
  classification: EvidenceClassification;
  supportingEventIds: string[];
  conflictingEventIds: string[];
  observedAt: Date | null;
  note: string;
}

export interface EvidenceTimeline {
  tripId: string;
  stages: TimelineStage[];
  proximityAtCompletion: ProximityInterpretation | null;
  overallNarrative: string;
  overallUnknowns: string;
}

const KIND_TO_STAGE: Partial<Record<TripEventKind, TimelineStage["stage"]>> = {
  request_offered: "request_offered",
  request_accepted: "request_accepted",
  driver_dispatched: "driver_dispatched",
  driver_arrived: "driver_arrived",
  trip_started: "trip_started",
  trip_completed: "trip_completed",
  trip_cancelled: "trip_cancelled",
};

const ORDER: TimelineStage["stage"][] = [
  "request_offered",
  "request_accepted",
  "driver_dispatched",
  "driver_arrived",
  "trip_started",
  "trip_completed",
];

export interface BuildTimelineInput {
  tripId: string;
  events: TripEventRecord[];
  jobType: TripJobType;
  destination?: LatLng | null;
  locationObservations?: LocationObservation[];
  completionWindowMinutes?: number;   // default 10 · window around completion for proximity check
}

export function buildEvidenceTimeline(input: BuildTimelineInput): EvidenceTimeline {
  const {
    tripId,
    events,
    destination,
    locationObservations = [],
    completionWindowMinutes = 10,
  } = input;

  const byStage = new Map<TimelineStage["stage"], TripEventRecord[]>();
  for (const e of events) {
    if (e.tripId !== tripId) continue;
    const stage = KIND_TO_STAGE[e.kind];
    if (!stage) continue;
    (byStage.get(stage) ?? byStage.set(stage, []).get(stage))!.push(e);
  }

  const cancelledEvents = events.filter((e) => e.tripId === tripId && e.kind === "trip_cancelled");
  const wasCancelled = cancelledEvents.length > 0;

  const stages: TimelineStage[] = ORDER.map((stage) => {
    const supporting = byStage.get(stage) ?? [];
    if (supporting.length === 0) {
      return {
        stage,
        classification: "UNAVAILABLE",
        supportingEventIds: [],
        conflictingEventIds: [],
        observedAt: null,
        note:
          wasCancelled && stageAfterCancel(stage)
            ? `Trip was cancelled before ${stage} could occur.`
            : `No recorded event for ${stage}. NEX does not know whether it happened.`,
      };
    }
    const earliest = supporting.reduce((a, b) => (a.occurredAt < b.occurredAt ? a : b));
    return {
      stage,
      classification: "SUPPORTS",
      supportingEventIds: supporting.map((e) => e.eventId),
      conflictingEventIds: [],
      observedAt: earliest.occurredAt,
      note: `Recorded ${supporting.length} event${supporting.length > 1 ? "s" : ""} for ${stage}, earliest ${earliest.occurredAt.toISOString()} by ${earliest.actor ?? "unknown actor"}.`,
    };
  });

  if (wasCancelled) {
    stages.push({
      stage: "trip_cancelled",
      classification: "SUPPORTS",
      supportingEventIds: cancelledEvents.map((e) => e.eventId),
      conflictingEventIds: [],
      observedAt: cancelledEvents[0].occurredAt,
      note: `Trip cancelled at ${cancelledEvents[0].occurredAt.toISOString()} by ${cancelledEvents[0].actor ?? "unknown actor"}.`,
    });
  }

  // Optional proximity check around completion event
  let proximityAtCompletion: ProximityInterpretation | null = null;
  const completed = (byStage.get("trip_completed") ?? [])[0];
  if (destination && completed) {
    const half = completionWindowMinutes * 60 * 1000;
    proximityAtCompletion = interpretProximityToDestination(
      locationObservations,
      destination,
      new Date(completed.occurredAt.getTime() - half),
      new Date(completed.occurredAt.getTime() + half),
    );
  }

  return {
    tripId,
    stages,
    proximityAtCompletion,
    overallNarrative: buildNarrative(stages, wasCancelled),
    overallUnknowns:
      "This timeline reports what NEX has evidence for. It does NOT declare fault. Gaps mean NEX did not record the event · not that the event did not happen.",
  };
}

function stageAfterCancel(stage: TimelineStage["stage"]): boolean {
  return stage === "trip_started" || stage === "trip_completed" || stage === "driver_arrived";
}

function buildNarrative(stages: TimelineStage[], wasCancelled: boolean): string {
  const lines: string[] = [];
  for (const s of stages) {
    if (s.classification === "SUPPORTS" && s.observedAt) {
      lines.push(`✓ ${s.stage} · ${s.observedAt.toISOString()}`);
    } else if (s.classification === "UNAVAILABLE") {
      lines.push(`· ${s.stage} · no evidence`);
    } else if (s.classification === "CONFLICTS") {
      lines.push(`✗ ${s.stage} · conflicting evidence`);
    }
  }
  if (wasCancelled) lines.push("(trip cancelled)");
  return lines.join("\n");
}
