// src/lib/nex-provider/commission.test.ts
//
// REVISED 2026-08-23. Model under test:
//   - First 3 completed trips per calendar month = 0% commission (free)
//   - Trip 4+ = 8% commission (policy.rateAfterFree)
//   - Both values live on policy row · never hard-coded here
//
// Rules enforced:
//   1. TRIP_NOT_COMPLETED for any non-completed state
//   2. NO_POLICY when policy is null (never invents rate)
//   3. Trip 1/2/3 in the month = 0% · nex_commission = 0
//   4. Trip 4/5/10 in the month = 8% (policy.rateAfterFree)
//   5. sequence_in_month = prior_count + 1 (deterministic)
//   6. Reconciliation: driver + nex = fare
//   7. Jurisdiction / job-type mismatch refused
//   8. Passenger-cancelled trips don't reach the calculator (state gate)
//   9. Driver-cancelled trips don't reach the calculator (state gate)

import { describe, it, expect } from "vitest";
import { calculateCommission } from "./commission";
import type { CommissionPolicy, TripState } from "./provider-network-types";

const POLICY: CommissionPolicy = {
  policyId: "policy-test",
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

describe("Commission · gated by trip state · cancellations never invoked", () => {
  const nonCompleted: TripState[] = [
    "accepted",
    "driver_arrived",
    "in_progress",
    "cancelled_by_traveller",   // passenger cancellation
    "cancelled_by_driver",      // driver cancellation
    "cancelled_by_system",
  ];
  it.each(nonCompleted)("refuses on state=%s", (state) => {
    const r = calculateCommission({
      fareTotalIdr: 50000,
      tripState: state,
      jobType: "passenger_motorbike",
      jurisdiction: "ID/DIY/Yogyakarta",
      policy: POLICY,
      completedTripsThisMonthBeforeThis: 0,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("TRIP_NOT_COMPLETED");
  });
});

describe("Commission · never invents a rate", () => {
  it("refuses with NO_POLICY when policy is null", () => {
    const r = calculateCommission({
      fareTotalIdr: 50000,
      tripState: "completed",
      jobType: "passenger_motorbike",
      jurisdiction: "ID/DIY/Yogyakarta",
      policy: null,
      completedTripsThisMonthBeforeThis: 0,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") {
      expect(r.reason).toBe("NO_POLICY");
      expect(r.detail).toMatch(/invent/i);
    }
  });

  it("rejects negative prior count", () => {
    const r = calculateCommission({
      fareTotalIdr: 50000,
      tripState: "completed",
      jobType: "passenger_motorbike",
      jurisdiction: "ID/DIY/Yogyakarta",
      policy: POLICY,
      completedTripsThisMonthBeforeThis: -1,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("NEGATIVE_PRIOR_COUNT");
  });

  it("rejects fractional prior count", () => {
    const r = calculateCommission({
      fareTotalIdr: 50000,
      tripState: "completed",
      jobType: "passenger_motorbike",
      jurisdiction: "ID/DIY/Yogyakarta",
      policy: POLICY,
      completedTripsThisMonthBeforeThis: 1.5,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("NEGATIVE_PRIOR_COUNT");
  });
});

describe("Commission · first 3 trips per calendar month = 0%", () => {
  it.each([
    [0, 1], // prior 0 · this is trip 1
    [1, 2],
    [2, 3],
  ])("prior=%i → sequence=%i · free · commission=0 · driver keeps full fare", (prior, seq) => {
    const r = calculateCommission({
      fareTotalIdr: 50000,
      tripState: "completed",
      jobType: "passenger_motorbike",
      jurisdiction: "ID/DIY/Yogyakarta",
      policy: POLICY,
      completedTripsThisMonthBeforeThis: prior,
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.isCommissionFreeTrip).toBe(true);
      expect(r.sequenceInMonth).toBe(seq);
      expect(r.appliedRate).toBe(0);
      expect(r.nexCommissionIdr).toBe(0);
      expect(r.driverPayoutIdr).toBe(50000);
    }
  });
});

describe("Commission · trip 4+ = 8% · Philip's exact worked values", () => {
  it("Rp 30,000 → NEX 2,400 → driver 27,600", () => {
    const r = calculateCommission({
      fareTotalIdr: 30000,
      tripState: "completed",
      jobType: "passenger_motorbike",
      jurisdiction: "ID/DIY/Yogyakarta",
      policy: POLICY,
      completedTripsThisMonthBeforeThis: 3,
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.isCommissionFreeTrip).toBe(false);
      expect(r.sequenceInMonth).toBe(4);
      expect(r.nexCommissionIdr).toBe(2400);
      expect(r.driverPayoutIdr).toBe(27600);
    }
  });

  it("Rp 40,000 → NEX 3,200 → driver 36,800", () => {
    const r = calculateCommission({
      fareTotalIdr: 40000,
      tripState: "completed",
      jobType: "passenger_motorbike",
      jurisdiction: "ID/DIY/Yogyakarta",
      policy: POLICY,
      completedTripsThisMonthBeforeThis: 3,
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.nexCommissionIdr).toBe(3200);
      expect(r.driverPayoutIdr).toBe(36800);
    }
  });

  it("Rp 50,000 → NEX 4,000 → driver 46,000", () => {
    const r = calculateCommission({
      fareTotalIdr: 50000,
      tripState: "completed",
      jobType: "passenger_motorbike",
      jurisdiction: "ID/DIY/Yogyakarta",
      policy: POLICY,
      completedTripsThisMonthBeforeThis: 3,
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.nexCommissionIdr).toBe(4000);
      expect(r.driverPayoutIdr).toBe(46000);
    }
  });

  it("Rp 60,000 → NEX 4,800 → driver 55,200", () => {
    const r = calculateCommission({
      fareTotalIdr: 60000,
      tripState: "completed",
      jobType: "passenger_motorbike",
      jurisdiction: "ID/DIY/Yogyakarta",
      policy: POLICY,
      completedTripsThisMonthBeforeThis: 3,
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.nexCommissionIdr).toBe(4800);
      expect(r.driverPayoutIdr).toBe(55200);
    }
  });

  it("Rp 70,000 → NEX 5,600 → driver 64,400", () => {
    const r = calculateCommission({
      fareTotalIdr: 70000,
      tripState: "completed",
      jobType: "passenger_motorbike",
      jurisdiction: "ID/DIY/Yogyakarta",
      policy: POLICY,
      completedTripsThisMonthBeforeThis: 3,
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.nexCommissionIdr).toBe(5600);
      expect(r.driverPayoutIdr).toBe(64400);
    }
  });

  it("Rp 100,000 → NEX 8,000 → driver 92,000", () => {
    const r = calculateCommission({
      fareTotalIdr: 100000,
      tripState: "completed",
      jobType: "passenger_motorbike",
      jurisdiction: "ID/DIY/Yogyakarta",
      policy: POLICY,
      completedTripsThisMonthBeforeThis: 3,
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.nexCommissionIdr).toBe(8000);
      expect(r.driverPayoutIdr).toBe(92000);
    }
  });

  it("Trip 10 → still 8% (allowance stays exhausted for the month)", () => {
    const r = calculateCommission({
      fareTotalIdr: 50000,
      tripState: "completed",
      jobType: "passenger_motorbike",
      jurisdiction: "ID/DIY/Yogyakarta",
      policy: POLICY,
      completedTripsThisMonthBeforeThis: 9,
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.sequenceInMonth).toBe(10);
      expect(r.isCommissionFreeTrip).toBe(false);
      expect(r.nexCommissionIdr).toBe(4000);
    }
  });
});

describe("Commission · reconciliation invariant holds", () => {
  it("driver + nex = fare · always · integer IDR · for prior counts 0..10", () => {
    for (const fare of [1, 100, 999, 1000, 12345, 50000, 100001, 999999]) {
      for (let prior = 0; prior <= 10; prior++) {
        const r = calculateCommission({
          fareTotalIdr: fare,
          tripState: "completed",
          jobType: "passenger_motorbike",
          jurisdiction: "ID/DIY/Yogyakarta",
          policy: POLICY,
          completedTripsThisMonthBeforeThis: prior,
        });
        expect(r.status).toBe("OK");
        if (r.status === "OK") {
          expect(r.driverPayoutIdr + r.nexCommissionIdr).toBe(fare);
          expect(Number.isInteger(r.driverPayoutIdr)).toBe(true);
          expect(Number.isInteger(r.nexCommissionIdr)).toBe(true);
        }
      }
    }
  });
});

describe("Commission · free-allowance remaining counter is correct", () => {
  it("prior=0 → before=3 after=2", () => {
    const r = calculateCommission({
      fareTotalIdr: 50000,
      tripState: "completed",
      jobType: "passenger_motorbike",
      jurisdiction: "ID/DIY/Yogyakarta",
      policy: POLICY,
      completedTripsThisMonthBeforeThis: 0,
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.freeAllowanceRemainingBefore).toBe(3);
      expect(r.freeAllowanceRemainingAfter).toBe(2);
    }
  });

  it("prior=3 → before=0 after=0 (allowance exhausted)", () => {
    const r = calculateCommission({
      fareTotalIdr: 50000,
      tripState: "completed",
      jobType: "passenger_motorbike",
      jurisdiction: "ID/DIY/Yogyakarta",
      policy: POLICY,
      completedTripsThisMonthBeforeThis: 3,
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.freeAllowanceRemainingBefore).toBe(0);
      expect(r.freeAllowanceRemainingAfter).toBe(0);
    }
  });
});

describe("Commission · jurisdiction / job-type mismatch refused", () => {
  it("policy jurisdiction mismatch → REFUSED", () => {
    const r = calculateCommission({
      fareTotalIdr: 50000,
      tripState: "completed",
      jobType: "passenger_motorbike",
      jurisdiction: "ID/Central-Java/Magelang",
      policy: POLICY,
      completedTripsThisMonthBeforeThis: 3,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("POLICY_JURISDICTION_MISMATCH");
  });

  it("policy jobType mismatch → REFUSED", () => {
    const scoped: CommissionPolicy = { ...POLICY, jobType: "hotel_to_airport" };
    const r = calculateCommission({
      fareTotalIdr: 50000,
      tripState: "completed",
      jobType: "passenger_motorbike",
      jurisdiction: "ID/DIY/Yogyakarta",
      policy: scoped,
      completedTripsThisMonthBeforeThis: 3,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("POLICY_JOB_TYPE_MISMATCH");
  });
});

describe("Commission · configurable rate proves it is not hard-coded", () => {
  it("policy at 5% → NEX 2,500 on Rp 50,000", () => {
    const at5: CommissionPolicy = { ...POLICY, rateAfterFree: 0.05 };
    const r = calculateCommission({
      fareTotalIdr: 50000,
      tripState: "completed",
      jobType: "passenger_motorbike",
      jurisdiction: "ID/DIY/Yogyakarta",
      policy: at5,
      completedTripsThisMonthBeforeThis: 3,
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.nexCommissionIdr).toBe(2500);
      expect(r.driverPayoutIdr).toBe(47500);
      expect(r.appliedRate).toBe(0.05);
    }
  });

  it("policy at 0% (test/promo mode) → no commission ever", () => {
    const zeroPolicy: CommissionPolicy = { ...POLICY, rateAfterFree: 0 };
    const r = calculateCommission({
      fareTotalIdr: 50000,
      tripState: "completed",
      jobType: "passenger_motorbike",
      jurisdiction: "ID/DIY/Yogyakarta",
      policy: zeroPolicy,
      completedTripsThisMonthBeforeThis: 100,
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.nexCommissionIdr).toBe(0);
      expect(r.driverPayoutIdr).toBe(50000);
    }
  });

  it("free-allowance configurable · e.g. N=1 → trip 2 pays commission", () => {
    const oneFree: CommissionPolicy = { ...POLICY, freeCompletedTripsPerMonth: 1 };
    const r = calculateCommission({
      fareTotalIdr: 50000,
      tripState: "completed",
      jobType: "passenger_motorbike",
      jurisdiction: "ID/DIY/Yogyakarta",
      policy: oneFree,
      completedTripsThisMonthBeforeThis: 1, // this is trip 2
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.isCommissionFreeTrip).toBe(false);
      expect(r.nexCommissionIdr).toBe(4000);
    }
  });
});
