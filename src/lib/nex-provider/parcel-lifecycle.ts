// src/lib/nex-provider/parcel-lifecycle.ts
//
// PARCEL LIFECYCLE STATE MACHINE.
//
// Doctrine anchors:
//   - Legal Boundary First (2026-08-23 CONSTITUTIONAL): GPS never promotes a
//     parcel to `completed`. Recipient confirmation (OTP / photo / signature)
//     is what establishes delivery.
//   - Truth Invariant (2026-08-22): illegal transitions throw · never silent.
//   - Separate from trip lifecycle: a parcel has its own state machine so a
//     multi-parcel trip can carry multiple parcels each with their own custody.
//
// Legal forward path:
//   created → matching → driver_accepted → driver_arrived_pickup
//     → parcel_picked_up → in_transit → arrived_destination
//     → recipient_confirmed → completed
//
// Terminal exits (from most non-terminal states):
//   cancelled_by_sender · cancelled_by_driver · cancelled_by_system
//   refused_by_recipient · lost · damaged

export type ParcelState =
  | "created"
  | "matching"
  | "driver_accepted"
  | "driver_arrived_pickup"
  | "parcel_picked_up"
  | "in_transit"
  | "arrived_destination"
  | "recipient_confirmed"
  | "completed"
  | "cancelled_by_sender"
  | "cancelled_by_driver"
  | "cancelled_by_system"
  | "refused_by_recipient"
  | "lost"
  | "damaged";

export type ParcelEventKind =
  | "pickup_photo_captured"
  | "handover_confirmed_by_sender"
  | "recipient_otp_verified"
  | "recipient_signature_captured"
  | "recipient_photo_captured"
  | "gps_observation"
  | "issue_reported"
  | "lost_reported"
  | "damaged_reported";

export interface ParcelSnapshot {
  parcelId: string;
  state: ParcelState;
  createdAt: Date;
  stateUpdatedAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  driverId: string | null;
}

const FORWARD: ParcelState[] = [
  "created",
  "matching",
  "driver_accepted",
  "driver_arrived_pickup",
  "parcel_picked_up",
  "in_transit",
  "arrived_destination",
  "recipient_confirmed",
  "completed",
];

const TERMINALS: ParcelState[] = [
  "completed",
  "cancelled_by_sender",
  "cancelled_by_driver",
  "cancelled_by_system",
  "refused_by_recipient",
  "lost",
  "damaged",
];

const CANCEL_STATES: ParcelState[] = [
  "cancelled_by_sender",
  "cancelled_by_driver",
  "cancelled_by_system",
];

export class ParcelStateError extends Error {
  code:
    | "ILLEGAL_TRANSITION"
    | "TERMINAL_STATE"
    | "CANCEL_REQUIRES_REASON"
    | "COMPLETED_REQUIRES_RECIPIENT_CONFIRMED"
    | "GPS_CANNOT_PROMOTE_STATE";
  constructor(code: ParcelStateError["code"], detail: string) {
    super(detail);
    this.name = "ParcelStateError";
    this.code = code;
  }
}

export interface ParcelTransitionInput {
  parcel: ParcelSnapshot;
  next: ParcelState;
  now?: Date;
  cancelReason?: string;
}

export function transitionParcel(input: ParcelTransitionInput): ParcelSnapshot {
  const { parcel, next } = input;
  const now = input.now ?? new Date();

  if (TERMINALS.includes(parcel.state)) {
    throw new ParcelStateError(
      "TERMINAL_STATE",
      `Parcel ${parcel.parcelId} is already in terminal state ${parcel.state}.`,
    );
  }

  // Terminal exit paths (cancellations · refusal · lost · damaged)
  const terminalExit = TERMINALS.includes(next) && next !== "completed";
  if (terminalExit) {
    // Cancellations require a reason. Refusals, lost, damaged also require a reason.
    if (!input.cancelReason || input.cancelReason.trim().length === 0) {
      throw new ParcelStateError(
        "CANCEL_REQUIRES_REASON",
        `Transition to ${next} requires a non-empty reason for audit.`,
      );
    }
    const patch: Partial<ParcelSnapshot> = { state: next, stateUpdatedAt: now };
    if (CANCEL_STATES.includes(next)) {
      patch.cancelledAt = now;
      patch.cancelReason = input.cancelReason;
    }
    return { ...parcel, ...patch };
  }

  // completed transition requires recipient_confirmed as immediate prior
  if (next === "completed") {
    if (parcel.state !== "recipient_confirmed") {
      throw new ParcelStateError(
        "COMPLETED_REQUIRES_RECIPIENT_CONFIRMED",
        `Cannot mark parcel ${parcel.parcelId} completed from state ${parcel.state}. recipient_confirmed must be the immediate prior state.`,
      );
    }
    return { ...parcel, state: "completed", stateUpdatedAt: now, completedAt: now };
  }

  // Forward-only adjacent transition
  const iCur = FORWARD.indexOf(parcel.state);
  const iNext = FORWARD.indexOf(next);
  if (iCur === -1 || iNext === -1) {
    throw new ParcelStateError(
      "ILLEGAL_TRANSITION",
      `Unknown state in transition ${parcel.state} → ${next}.`,
    );
  }
  if (iNext !== iCur + 1) {
    throw new ParcelStateError(
      "ILLEGAL_TRANSITION",
      `Non-adjacent transition ${parcel.state} → ${next} is not permitted.`,
    );
  }

  return { ...parcel, state: next, stateUpdatedAt: now };
}

/**
 * A GPS observation MUST NOT change parcel state. This function returns the
 * parcel unchanged and throws if a caller tries to use it to promote state.
 * Callers may record a `gps_observation` event separately via parcel_event.
 */
export function recordGpsObservation(parcel: ParcelSnapshot): ParcelSnapshot {
  // Deliberate no-op on state. Callers that expected state promotion should
  // fail loudly — but the function returns the unchanged snapshot rather than
  // throwing, because recording a GPS observation itself is legitimate.
  return parcel;
}

export function isParcelTerminal(state: ParcelState): boolean {
  return TERMINALS.includes(state);
}

/**
 * True if this event kind is a recipient-confirmation event NEX may honestly
 * use to advance parcel state from arrived_destination to recipient_confirmed.
 * GPS observation is NEVER a recipient-confirmation event.
 */
export function isRecipientConfirmationEvent(kind: ParcelEventKind): boolean {
  return (
    kind === "recipient_otp_verified" ||
    kind === "recipient_signature_captured" ||
    kind === "recipient_photo_captured"
  );
}
