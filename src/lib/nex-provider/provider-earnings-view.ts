// src/lib/nex-provider/provider-earnings-view.ts
//
// DRIVER EARNINGS VIEW · pure data-shape composer for the tiny driver panel.
//
// This module does NOT render UI. It produces the DATA CONTRACT that the driver
// panel (Philip's 🚗 button inside Explore/chat) reads. Frontend renders the
// data · never invents numbers.
//
// Doctrine anchors:
//   - Driver commission model REVISED (2026-08-23): first 3 trips/month free ·
//     8% thereafter · wallet-gated dispatch · driver sees every deduction
//     transparently.
//   - Legal Boundary (2026-08-23): panel only shows numbers NEX can prove from
//     stored trip_fare + wallet_transaction records. NEX does not invent
//     earnings for trips it does not have records of.
//   - Traveller Protection Principle applies to drivers too: the driver sees
//     gross fare · NEX commission · net earnings · with provenance per line.

import type { CommissionPolicy, TripJobType } from "./provider-network-types";
import type { WalletSnapshot } from "./wallet";
import { suggestedTopupIdr } from "./wallet";

export interface TripFareRow {
  tripId: string;
  jobType: TripJobType;
  completedAt: Date;
  fareTotalIdr: number;
  driverPayoutIdr: number;
  nexCommissionIdr: number;
  isCommissionFreeTrip: boolean;
  sequenceInMonth: number;
  destinationLabel: string | null;   // short label · never precise coord
}

export interface EarningsViewInput {
  driverId: string;
  wallet: WalletSnapshot;
  policy: CommissionPolicy;
  now: Date;
  fares: TripFareRow[];       // all completed trip fares for this driver (caller may bound to reasonable range)
  historyLimit?: number;      // default 20 most recent
}

export interface DriverEarningsView {
  driverId: string;
  wallet: {
    balanceIdr: number;
    currency: "IDR";
    updatedAt: Date;
    dispatchable: boolean;
    dispatchableReason: string;
    suggestedTopupIdr: number;
  };
  freeTripAllowance: {
    perMonth: number;
    usedThisMonth: number;
    remainingThisMonth: number;
    monthLabel: string;
  };
  today: {
    completedTrips: number;
    grossFareIdr: number;
    nexCommissionIdr: number;
    driverEarningsIdr: number;
  };
  monthToDate: {
    completedTrips: number;
    grossFareIdr: number;
    nexCommissionIdr: number;
    driverEarningsIdr: number;
  };
  history: {
    tripId: string;
    completedAt: Date;
    label: string;
    fareTotalIdr: number;
    nexCommissionIdr: number;
    driverPayoutIdr: number;
    wasFreeTrip: boolean;
  }[];
  unknowns: string;
}

const MONTH_LABEL = (d: Date) =>
  `${d.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}`;

const isSameUtcDay = (a: Date, b: Date) =>
  a.getUTCFullYear() === b.getUTCFullYear() &&
  a.getUTCMonth() === b.getUTCMonth() &&
  a.getUTCDate() === b.getUTCDate();

const isSameUtcMonth = (a: Date, b: Date) =>
  a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();

export function composeDriverEarningsView(input: EarningsViewInput): DriverEarningsView {
  const { driverId, wallet, policy, now, fares, historyLimit = 20 } = input;

  const thisMonth = fares.filter((f) => isSameUtcMonth(f.completedAt, now));
  const today = fares.filter((f) => isSameUtcDay(f.completedAt, now));

  const sumFare = (rows: TripFareRow[]) => rows.reduce((a, r) => a + r.fareTotalIdr, 0);
  const sumComm = (rows: TripFareRow[]) => rows.reduce((a, r) => a + r.nexCommissionIdr, 0);
  const sumPayout = (rows: TripFareRow[]) => rows.reduce((a, r) => a + r.driverPayoutIdr, 0);

  const usedThisMonth = thisMonth.length;
  const remaining = Math.max(0, policy.freeCompletedTripsPerMonth - usedThisMonth);

  // Wallet dispatchability mirrors wallet.isWalletDispatchable rule
  const walletDispatchable = usedThisMonth < policy.freeCompletedTripsPerMonth
    ? { dispatchable: true, reason: "Within free-trip allowance." }
    : wallet.balanceIdr >= policy.minWalletBalanceIdr
      ? { dispatchable: true, reason: "Wallet balance sufficient." }
      : { dispatchable: false, reason: `Wallet below floor Rp ${policy.minWalletBalanceIdr.toLocaleString("id-ID")}. Top up to resume.` };

  const history = [...fares]
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
    .slice(0, historyLimit)
    .map((f) => ({
      tripId: f.tripId,
      completedAt: f.completedAt,
      label: f.destinationLabel ?? "trip",
      fareTotalIdr: f.fareTotalIdr,
      nexCommissionIdr: f.nexCommissionIdr,
      driverPayoutIdr: f.driverPayoutIdr,
      wasFreeTrip: f.isCommissionFreeTrip,
    }));

  return {
    driverId,
    wallet: {
      balanceIdr: wallet.balanceIdr,
      currency: "IDR",
      updatedAt: wallet.updatedAt,
      dispatchable: walletDispatchable.dispatchable,
      dispatchableReason: walletDispatchable.reason,
      suggestedTopupIdr: suggestedTopupIdr(wallet, policy),
    },
    freeTripAllowance: {
      perMonth: policy.freeCompletedTripsPerMonth,
      usedThisMonth,
      remainingThisMonth: remaining,
      monthLabel: MONTH_LABEL(now),
    },
    today: {
      completedTrips: today.length,
      grossFareIdr: sumFare(today),
      nexCommissionIdr: sumComm(today),
      driverEarningsIdr: sumPayout(today),
    },
    monthToDate: {
      completedTrips: usedThisMonth,
      grossFareIdr: sumFare(thisMonth),
      nexCommissionIdr: sumComm(thisMonth),
      driverEarningsIdr: sumPayout(thisMonth),
    },
    history,
    unknowns:
      "This view reflects only completed trip records NEX holds. Trips still in progress, pending payment, or subject to adjustment are not included here.",
  };
}
