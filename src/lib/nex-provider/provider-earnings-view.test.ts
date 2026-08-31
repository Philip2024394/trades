// src/lib/nex-provider/provider-earnings-view.test.ts

import { describe, it, expect } from "vitest";
import { composeDriverEarningsView, type TripFareRow } from "./provider-earnings-view";
import type { CommissionPolicy } from "./provider-network-types";
import type { WalletSnapshot } from "./wallet";

const POLICY: CommissionPolicy = {
  policyId: "policy-1",
  jurisdiction: "ID/DIY/Yogyakarta",
  jobType: null,
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  effectiveTo: null,
  freeCompletedTripsPerMonth: 3,
  rateAfterFree: 0.08,
  minWalletBalanceIdr: 0,
  walletTopupUnitIdr: 10000,
  currency: "IDR",
  notes: null,
};

const NOW = new Date("2026-08-23T14:20:00Z");

function fare(overrides: Partial<TripFareRow>): TripFareRow {
  return {
    tripId: "t",
    jobType: "passenger_motorbike",
    completedAt: NOW,
    fareTotalIdr: 50000,
    driverPayoutIdr: 46000,
    nexCommissionIdr: 4000,
    isCommissionFreeTrip: false,
    sequenceInMonth: 1,
    destinationLabel: "Malioboro",
    ...overrides,
  };
}

const wallet = (balance = 10000): WalletSnapshot => ({
  driverId: "d1",
  balanceIdr: balance,
  currency: "IDR",
  updatedAt: NOW,
});

describe("Driver earnings view · reconciles today + month totals", () => {
  it("today's numbers sum to the day's fares", () => {
    const v = composeDriverEarningsView({
      driverId: "d1",
      wallet: wallet(10000),
      policy: POLICY,
      now: NOW,
      fares: [
        fare({ tripId: "t1", fareTotalIdr: 30000, nexCommissionIdr: 0, driverPayoutIdr: 30000, isCommissionFreeTrip: true,  sequenceInMonth: 1 }),
        fare({ tripId: "t2", fareTotalIdr: 50000, nexCommissionIdr: 0, driverPayoutIdr: 50000, isCommissionFreeTrip: true,  sequenceInMonth: 2 }),
        fare({ tripId: "t3", fareTotalIdr: 70000, nexCommissionIdr: 5600, driverPayoutIdr: 64400, isCommissionFreeTrip: false, sequenceInMonth: 4 }),
      ],
    });
    expect(v.today.completedTrips).toBe(3);
    expect(v.today.grossFareIdr).toBe(150000);
    expect(v.today.nexCommissionIdr).toBe(5600);
    expect(v.today.driverEarningsIdr).toBe(144400);
    expect(v.monthToDate.completedTrips).toBe(3);
  });
});

describe("Driver earnings view · free-trip allowance counter", () => {
  it("2 free trips used → 1 remaining · label reflects the month", () => {
    const v = composeDriverEarningsView({
      driverId: "d1",
      wallet: wallet(0),
      policy: POLICY,
      now: NOW,
      fares: [
        fare({ tripId: "t1", isCommissionFreeTrip: true, sequenceInMonth: 1, nexCommissionIdr: 0, driverPayoutIdr: 50000 }),
        fare({ tripId: "t2", isCommissionFreeTrip: true, sequenceInMonth: 2, nexCommissionIdr: 0, driverPayoutIdr: 50000 }),
      ],
    });
    expect(v.freeTripAllowance.usedThisMonth).toBe(2);
    expect(v.freeTripAllowance.remainingThisMonth).toBe(1);
    expect(v.freeTripAllowance.perMonth).toBe(3);
    expect(v.freeTripAllowance.monthLabel).toMatch(/August 2026/);
    // Still dispatchable within free-trip allowance regardless of wallet
    expect(v.wallet.dispatchable).toBe(true);
    expect(v.wallet.dispatchableReason.toLowerCase()).toMatch(/free-trip allowance/);
  });
});

describe("Driver earnings view · wallet gate applies once allowance exhausted", () => {
  it("allowance used up + wallet -1000 → NOT dispatchable · suggestedTopup rounded to unit", () => {
    const v = composeDriverEarningsView({
      driverId: "d1",
      wallet: wallet(-1000),
      policy: POLICY,
      now: NOW,
      fares: [
        fare({ tripId: "t1", isCommissionFreeTrip: true, sequenceInMonth: 1 }),
        fare({ tripId: "t2", isCommissionFreeTrip: true, sequenceInMonth: 2 }),
        fare({ tripId: "t3", isCommissionFreeTrip: true, sequenceInMonth: 3 }),
        fare({ tripId: "t4", isCommissionFreeTrip: false, sequenceInMonth: 4, nexCommissionIdr: 4000, driverPayoutIdr: 46000 }),
      ],
    });
    expect(v.wallet.dispatchable).toBe(false);
    expect(v.wallet.dispatchableReason.toLowerCase()).toMatch(/top up/);
    expect(v.wallet.suggestedTopupIdr).toBe(10000);
  });
});

describe("Driver earnings view · history sorted newest-first + labelled", () => {
  it("returns most recent trips first", () => {
    const v = composeDriverEarningsView({
      driverId: "d1",
      wallet: wallet(),
      policy: POLICY,
      now: NOW,
      fares: [
        fare({ tripId: "old", completedAt: new Date("2026-08-01T00:00:00Z") }),
        fare({ tripId: "new", completedAt: new Date("2026-08-22T00:00:00Z") }),
        fare({ tripId: "mid", completedAt: new Date("2026-08-10T00:00:00Z") }),
      ],
    });
    expect(v.history.map((h) => h.tripId)).toEqual(["new", "mid", "old"]);
  });
});

describe("Driver earnings view · unknowns note flags what is NOT included", () => {
  it("always includes the unknowns line about in-progress + pending adjustment", () => {
    const v = composeDriverEarningsView({
      driverId: "d1",
      wallet: wallet(),
      policy: POLICY,
      now: NOW,
      fares: [],
    });
    expect(v.unknowns.toLowerCase()).toMatch(/in progress|pending|adjustment/);
  });
});
