// src/lib/nex-driver/commission.ts
//
// COMMISSION CALCULATOR · pure function · REVISED 2026-08-23.
//
// Given a completed-trip fare, the driver's completed-trip count so far this
// calendar month (BEFORE this trip), and a commission policy, returns the
// driver payout, NEX commission, sequence-in-month and applied rate with
// full provenance.
//
// Commercial model (LOCKED · 2026-08-23):
//   - First `freeCompletedTripsPerMonth` completed trips per driver per
//     calendar month = 0% commission.
//   - Every trip beyond that = `rateAfterFree` (initial Indonesia value 8%).
//   - Rate lives on the policy row · never hard-coded here.
//
// Bright-line rules enforced:
//   1. Refuses to compute when trip is not in state 'completed'.
//   2. Refuses to compute without a policy row (never invents a rate).
//   3. First N trips in the month → applied_rate = 0, nex_commission = 0.
//   4. Trip beyond N → applied_rate = policy.rateAfterFree.
//   5. Reconciles: driver_payout + nex_commission === fare_total (integer IDR).
//   6. Sequence in month is deterministic: prior-trip-count + 1.
//   7. Cancelled trips (any state other than 'completed') NEVER count toward
//      the free-trip allowance (caller queries only completed trips).

import type { CommissionPolicy, TripJobType, TripState } from "./driver-network-types";

export interface CommissionInput {
  fareTotalIdr: number;
  tripState: TripState;
  jobType: TripJobType;
  jurisdiction: string;
  policy: CommissionPolicy | null;
  /**
   * Number of completed trips this driver has had in the current calendar
   * month BEFORE this trip is recorded. Caller is responsible for producing
   * this number transaction-safely (e.g. SELECT ... FOR UPDATE + COUNT).
   */
  completedTripsThisMonthBeforeThis: number;
}

export interface CommissionOK {
  status: "OK";
  fareTotalIdr: number;
  driverPayoutIdr: number;
  nexCommissionIdr: number;
  appliedRate: number;
  isCommissionFreeTrip: boolean;
  sequenceInMonth: number;
  freeAllowanceRemainingBefore: number;
  freeAllowanceRemainingAfter: number;
  policyId: string;
  jurisdiction: string;
  jobType: TripJobType;
  currency: "IDR";
  calculatedAt: Date;
  provenance: {
    policyEffectiveFrom: Date;
    policyEffectiveTo: Date | null;
    policyRateAfterFree: number;
    policyFreeCompletedTripsPerMonth: number;
    reconciliation: string;
    freeTripReasoning: string;
  };
}

export interface CommissionRefused {
  status: "REFUSED";
  reason:
    | "TRIP_NOT_COMPLETED"
    | "NO_POLICY"
    | "POLICY_EXPIRED"
    | "POLICY_NOT_YET_EFFECTIVE"
    | "POLICY_JURISDICTION_MISMATCH"
    | "POLICY_JOB_TYPE_MISMATCH"
    | "FARE_NON_POSITIVE"
    | "NEGATIVE_PRIOR_COUNT";
  detail: string;
}

export type CommissionResult = CommissionOK | CommissionRefused;

export function calculateCommission(input: CommissionInput): CommissionResult {
  // Rule 1: commission ONLY on completed trips
  if (input.tripState !== "completed") {
    return {
      status: "REFUSED",
      reason: "TRIP_NOT_COMPLETED",
      detail: `Commission is only calculated on completed trips. Current trip state: ${input.tripState}.`,
    };
  }

  // Rule 2: refuse without policy
  if (!input.policy) {
    return {
      status: "REFUSED",
      reason: "NO_POLICY",
      detail: "No commission policy supplied. NEX refuses to invent a commission rate.",
    };
  }

  if (input.completedTripsThisMonthBeforeThis < 0 || !Number.isInteger(input.completedTripsThisMonthBeforeThis)) {
    return {
      status: "REFUSED",
      reason: "NEGATIVE_PRIOR_COUNT",
      detail: `completedTripsThisMonthBeforeThis must be a non-negative integer · got ${input.completedTripsThisMonthBeforeThis}.`,
    };
  }

  const now = new Date();
  if (input.policy.effectiveFrom.getTime() > now.getTime()) {
    return {
      status: "REFUSED",
      reason: "POLICY_NOT_YET_EFFECTIVE",
      detail: `Policy ${input.policy.policyId} is not yet effective.`,
    };
  }
  if (input.policy.effectiveTo && input.policy.effectiveTo.getTime() < now.getTime()) {
    return {
      status: "REFUSED",
      reason: "POLICY_EXPIRED",
      detail: `Policy ${input.policy.policyId} expired at ${input.policy.effectiveTo.toISOString()}.`,
    };
  }

  if (input.policy.jurisdiction !== input.jurisdiction) {
    return {
      status: "REFUSED",
      reason: "POLICY_JURISDICTION_MISMATCH",
      detail: `Policy jurisdiction ${input.policy.jurisdiction} does not match trip jurisdiction ${input.jurisdiction}.`,
    };
  }

  if (input.policy.jobType !== null && input.policy.jobType !== input.jobType) {
    return {
      status: "REFUSED",
      reason: "POLICY_JOB_TYPE_MISMATCH",
      detail: `Policy jobType ${input.policy.jobType} does not match trip jobType ${input.jobType}.`,
    };
  }

  if (!(input.fareTotalIdr > 0)) {
    return {
      status: "REFUSED",
      reason: "FARE_NON_POSITIVE",
      detail: `Fare must be positive · got ${input.fareTotalIdr}.`,
    };
  }

  const sequenceInMonth = input.completedTripsThisMonthBeforeThis + 1;
  const isCommissionFreeTrip = sequenceInMonth <= input.policy.freeCompletedTripsPerMonth;

  const appliedRate = isCommissionFreeTrip ? 0 : input.policy.rateAfterFree;
  const commissionRaw = input.fareTotalIdr * appliedRate;
  const nexCommissionIdr = Math.round(commissionRaw);
  const driverPayoutIdr = input.fareTotalIdr - nexCommissionIdr;

  const before = Math.max(
    0,
    input.policy.freeCompletedTripsPerMonth - input.completedTripsThisMonthBeforeThis,
  );
  const after = Math.max(
    0,
    input.policy.freeCompletedTripsPerMonth - sequenceInMonth,
  );

  return {
    status: "OK",
    fareTotalIdr: input.fareTotalIdr,
    driverPayoutIdr,
    nexCommissionIdr,
    appliedRate,
    isCommissionFreeTrip,
    sequenceInMonth,
    freeAllowanceRemainingBefore: before,
    freeAllowanceRemainingAfter: after,
    policyId: input.policy.policyId,
    jurisdiction: input.jurisdiction,
    jobType: input.jobType,
    currency: "IDR",
    calculatedAt: new Date(),
    provenance: {
      policyEffectiveFrom: input.policy.effectiveFrom,
      policyEffectiveTo: input.policy.effectiveTo,
      policyRateAfterFree: input.policy.rateAfterFree,
      policyFreeCompletedTripsPerMonth: input.policy.freeCompletedTripsPerMonth,
      reconciliation: `${driverPayoutIdr} + ${nexCommissionIdr} = ${input.fareTotalIdr}`,
      freeTripReasoning: isCommissionFreeTrip
        ? `Trip ${sequenceInMonth} of month · within free allowance of ${input.policy.freeCompletedTripsPerMonth} · applied_rate = 0`
        : `Trip ${sequenceInMonth} of month · beyond free allowance of ${input.policy.freeCompletedTripsPerMonth} · applied_rate = ${input.policy.rateAfterFree}`,
    },
  };
}
