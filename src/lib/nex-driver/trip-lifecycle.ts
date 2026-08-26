// src/lib/nex-driver/trip-lifecycle.ts
//
// TRIP LIFECYCLE STATE MACHINE.
//
// Legal transitions:
//
//   accepted → driver_arrived → in_progress → completed
//   accepted → cancelled_by_traveller
//   accepted → cancelled_by_driver
//   accepted → cancelled_by_system
//   driver_arrived → in_progress
//   driver_arrived → cancelled_by_{traveller,driver,system}
//   in_progress → completed
//   in_progress → cancelled_by_{traveller,driver,system}
//
// Completed and cancelled_* states are terminal.
//
// Bright-line rules:
//   1. Commission fires ONLY when trip enters `completed`.
//   2. Any illegal transition throws · never silently ignored.
//   3. Trip lifecycle NEVER writes a fare row without matching completed state.

import type { TripState, TripJobType } from "./driver-network-types";

export interface TripSnapshot {
  tripId: string;
  driverId: string;
  jobType: TripJobType;
  jurisdiction: string;
  state: TripState;
  acceptedAt: Date;
  driverArrivedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
}

const TERMINAL: TripState[] = [
  "completed",
  "cancelled_by_traveller",
  "cancelled_by_driver",
  "cancelled_by_system",
];

const LEGAL_TRANSITIONS: Record<TripState, TripState[]> = {
  accepted: [
    "driver_arrived",
    "cancelled_by_traveller",
    "cancelled_by_driver",
    "cancelled_by_system",
  ],
  driver_arrived: [
    "in_progress",
    "cancelled_by_traveller",
    "cancelled_by_driver",
    "cancelled_by_system",
  ],
  in_progress: [
    "completed",
    "cancelled_by_traveller",
    "cancelled_by_driver",
    "cancelled_by_system",
  ],
  completed: [],
  cancelled_by_traveller: [],
  cancelled_by_driver: [],
  cancelled_by_system: [],
};

export class TripStateError extends Error {
  code: "ILLEGAL_TRANSITION" | "TERMINAL_STATE" | "CANCEL_REQUIRES_REASON";
  constructor(code: TripStateError["code"], detail: string) {
    super(detail);
    this.name = "TripStateError";
    this.code = code;
  }
}

export interface TransitionOptions {
  now?: Date;
  cancelReason?: string;
}

export function transitionTrip(
  trip: TripSnapshot,
  next: TripState,
  opts: TransitionOptions = {},
): TripSnapshot {
  const now = opts.now ?? new Date();

  if (TERMINAL.includes(trip.state)) {
    throw new TripStateError(
      "TERMINAL_STATE",
      `Trip ${trip.tripId} is already in terminal state ${trip.state}.`,
    );
  }
  if (!LEGAL_TRANSITIONS[trip.state].includes(next)) {
    throw new TripStateError(
      "ILLEGAL_TRANSITION",
      `Trip ${trip.tripId}: illegal transition ${trip.state} → ${next}.`,
    );
  }

  const isCancel =
    next === "cancelled_by_traveller" ||
    next === "cancelled_by_driver" ||
    next === "cancelled_by_system";

  if (isCancel && (!opts.cancelReason || opts.cancelReason.trim().length === 0)) {
    throw new TripStateError(
      "CANCEL_REQUIRES_REASON",
      "Cancelling a trip requires a non-empty reason for audit.",
    );
  }

  const patch: Partial<TripSnapshot> = { state: next };

  switch (next) {
    case "driver_arrived":
      patch.driverArrivedAt = now;
      break;
    case "in_progress":
      patch.startedAt = now;
      break;
    case "completed":
      patch.completedAt = now;
      break;
    case "cancelled_by_traveller":
    case "cancelled_by_driver":
    case "cancelled_by_system":
      patch.cancelledAt = now;
      patch.cancelReason = opts.cancelReason!;
      break;
  }

  return { ...trip, ...patch };
}

export function isTripEligibleForFareCommission(trip: TripSnapshot): boolean {
  return trip.state === "completed" && !!trip.completedAt;
}

export function isTerminal(state: TripState): boolean {
  return TERMINAL.includes(state);
}
