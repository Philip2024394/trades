// src/lib/nex-driver/parcel-lifecycle.test.ts

import { describe, it, expect } from "vitest";
import {
  transitionParcel,
  recordGpsObservation,
  isParcelTerminal,
  isRecipientConfirmationEvent,
  ParcelStateError,
  type ParcelSnapshot,
  type ParcelState,
} from "./parcel-lifecycle";

function mkParcel(state: ParcelState = "created", overrides: Partial<ParcelSnapshot> = {}): ParcelSnapshot {
  return {
    parcelId: "p1",
    state,
    createdAt: new Date("2026-08-23T09:00:00Z"),
    stateUpdatedAt: new Date("2026-08-23T09:00:00Z"),
    completedAt: null,
    cancelledAt: null,
    cancelReason: null,
    driverId: null,
    ...overrides,
  };
}

describe("Parcel lifecycle · happy path all stages → completed", () => {
  it("walks the ladder", () => {
    const path: ParcelState[] = [
      "created", "matching", "driver_accepted",
      "driver_arrived_pickup", "parcel_picked_up", "in_transit",
      "arrived_destination", "recipient_confirmed", "completed",
    ];
    let p = mkParcel("created");
    for (let i = 0; i < path.length - 1; i++) {
      p = transitionParcel({ parcel: p, next: path[i + 1] });
    }
    expect(p.state).toBe("completed");
    expect(p.completedAt).not.toBeNull();
  });
});

describe("Parcel lifecycle · illegal transitions throw", () => {
  it("created → completed is rejected", () => {
    expect(() => transitionParcel({ parcel: mkParcel("created"), next: "completed" })).toThrow(ParcelStateError);
  });

  it("in_transit → completed is rejected (must reach recipient_confirmed first)", () => {
    expect(() =>
      transitionParcel({ parcel: mkParcel("in_transit"), next: "completed" }),
    ).toThrow(/recipient_confirmed/);
  });

  it("arrived_destination → completed is rejected (must confirm recipient first)", () => {
    expect(() =>
      transitionParcel({ parcel: mkParcel("arrived_destination"), next: "completed" }),
    ).toThrow(/recipient_confirmed/);
  });

  it("recipient_confirmed → completed IS allowed", () => {
    const p = transitionParcel({ parcel: mkParcel("recipient_confirmed"), next: "completed" });
    expect(p.state).toBe("completed");
    expect(p.completedAt).not.toBeNull();
  });

  it("non-adjacent forward transition rejected", () => {
    expect(() =>
      transitionParcel({ parcel: mkParcel("driver_accepted"), next: "in_transit" }),
    ).toThrow(ParcelStateError);
  });

  it("backwards transition rejected", () => {
    expect(() =>
      transitionParcel({ parcel: mkParcel("in_transit"), next: "driver_accepted" }),
    ).toThrow(ParcelStateError);
  });
});

describe("Parcel lifecycle · terminal exits require reason", () => {
  it("cancelled_by_sender without reason → CANCEL_REQUIRES_REASON", () => {
    expect(() =>
      transitionParcel({ parcel: mkParcel("driver_accepted"), next: "cancelled_by_sender" }),
    ).toThrow(/reason/i);
  });

  it("refused_by_recipient without reason → CANCEL_REQUIRES_REASON", () => {
    expect(() =>
      transitionParcel({ parcel: mkParcel("arrived_destination"), next: "refused_by_recipient" }),
    ).toThrow(/reason/i);
  });

  it("lost without reason → CANCEL_REQUIRES_REASON", () => {
    expect(() =>
      transitionParcel({ parcel: mkParcel("in_transit"), next: "lost" }),
    ).toThrow(/reason/i);
  });

  it("damaged with reason records terminal", () => {
    const p = transitionParcel({
      parcel: mkParcel("parcel_picked_up"),
      next: "damaged",
      cancelReason: "package fell from vehicle · sender notified",
    });
    expect(p.state).toBe("damaged");
  });

  it("cancellation records cancelledAt + reason", () => {
    const p = transitionParcel({
      parcel: mkParcel("driver_accepted"),
      next: "cancelled_by_driver",
      cancelReason: "vehicle issue · unable to complete pickup",
      now: new Date("2026-08-23T09:15:00Z"),
    });
    expect(p.state).toBe("cancelled_by_driver");
    expect(p.cancelledAt?.toISOString()).toBe("2026-08-23T09:15:00.000Z");
    expect(p.cancelReason).toMatch(/vehicle issue/);
  });
});

describe("Parcel lifecycle · cannot leave a terminal state", () => {
  it("completed → in_transit rejected", () => {
    expect(() =>
      transitionParcel({ parcel: mkParcel("completed"), next: "in_transit" }),
    ).toThrow(/terminal/i);
  });

  it("cancelled_by_sender → matching rejected", () => {
    expect(() =>
      transitionParcel({ parcel: mkParcel("cancelled_by_sender"), next: "matching" }),
    ).toThrow(/terminal/i);
  });

  it("refused_by_recipient → completed rejected", () => {
    expect(() =>
      transitionParcel({ parcel: mkParcel("refused_by_recipient"), next: "completed" }),
    ).toThrow(/terminal/i);
  });
});

describe("Parcel lifecycle · GPS never promotes state", () => {
  it("recordGpsObservation returns the same state · does not advance", () => {
    const p = mkParcel("in_transit");
    const after = recordGpsObservation(p);
    expect(after.state).toBe("in_transit");
    expect(after).toEqual(p);
  });
});

describe("Parcel lifecycle · terminality + recipient-confirmation event helpers", () => {
  it("terminal state helper", () => {
    for (const s of ["completed", "cancelled_by_sender", "cancelled_by_driver", "cancelled_by_system", "refused_by_recipient", "lost", "damaged"] as ParcelState[]) {
      expect(isParcelTerminal(s)).toBe(true);
    }
    for (const s of ["created", "matching", "driver_accepted", "driver_arrived_pickup", "parcel_picked_up", "in_transit", "arrived_destination", "recipient_confirmed"] as ParcelState[]) {
      expect(isParcelTerminal(s)).toBe(false);
    }
  });

  it("recipient-confirmation events include OTP · signature · photo — never GPS", () => {
    expect(isRecipientConfirmationEvent("recipient_otp_verified")).toBe(true);
    expect(isRecipientConfirmationEvent("recipient_signature_captured")).toBe(true);
    expect(isRecipientConfirmationEvent("recipient_photo_captured")).toBe(true);
    expect(isRecipientConfirmationEvent("gps_observation")).toBe(false);
    expect(isRecipientConfirmationEvent("pickup_photo_captured")).toBe(false);
  });
});
