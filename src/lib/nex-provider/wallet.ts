// src/lib/nex-provider/wallet.ts
//
// DRIVER WALLET · pure functions for balance + dispatchability.
//
// The wallet is a prepaid commission balance. Drivers top up (default Rp 10,000
// unit) · NEX debits commission after each completed non-free trip · when the
// balance drops below policy.minWalletBalanceIdr AND the driver is past their
// monthly free-trip allowance, NEX Dispatch stops offering the driver new jobs.
//
// Doctrine anchors (2026-08-23 REVISED commission model):
//   - Wallet is Stage-A infrastructure · no real money movement until Stage-B
//     payment prerequisites are satisfied.
//   - Free-trip allowance protects new drivers · they do NOT need to top up
//     before earning their first Rp.
//   - Every wallet mutation is a WalletTransaction row · reconciled by
//     SUM(amount_idr) grouped by driver.
//   - Never invent numbers · commission source is the pure commission calculator.

import type { CommissionPolicy, WalletTransactionKind } from "./provider-network-types";

export interface WalletSnapshot {
  driverId: string;
  balanceIdr: number;
  currency: "IDR";
  updatedAt: Date;
}

export interface WalletTransactionInput {
  driverId: string;
  kind: WalletTransactionKind;
  amountIdr: number;              // signed: topup/refund positive · debit negative
  tripId?: string;                // required for commission_debit
  reference?: string;             // e.g. payment provider id
  reason?: string;                // human audit note
  at?: Date;
}

export interface WalletTransactionOK {
  status: "OK";
  wallet: WalletSnapshot;
  transaction: {
    driverId: string;
    kind: WalletTransactionKind;
    amountIdr: number;
    balanceAfterIdr: number;
    tripId: string | null;
    reference: string | null;
    reason: string | null;
    createdAt: Date;
  };
}

export interface WalletTransactionRefused {
  status: "REFUSED";
  reason:
    | "TOPUP_MUST_BE_POSITIVE"
    | "COMMISSION_MUST_BE_NEGATIVE"
    | "COMMISSION_NEEDS_TRIP"
    | "REFUND_MUST_BE_POSITIVE"
    | "PAYOUT_MUST_BE_NEGATIVE";
  detail: string;
}

export type WalletTransactionResult = WalletTransactionOK | WalletTransactionRefused;

/**
 * Apply a wallet transaction to a snapshot. Pure. Returns a new snapshot and
 * the transaction record. Rejects transactions that violate their kind-invariants.
 */
export function applyWalletTransaction(
  before: WalletSnapshot,
  input: WalletTransactionInput,
): WalletTransactionResult {
  const at = input.at ?? new Date();

  switch (input.kind) {
    case "topup":
      if (!(input.amountIdr > 0)) {
        return { status: "REFUSED", reason: "TOPUP_MUST_BE_POSITIVE", detail: `topup amount must be > 0 · got ${input.amountIdr}` };
      }
      break;
    case "refund_credit":
      if (!(input.amountIdr > 0)) {
        return { status: "REFUSED", reason: "REFUND_MUST_BE_POSITIVE", detail: `refund_credit amount must be > 0 · got ${input.amountIdr}` };
      }
      break;
    case "commission_debit":
      if (!(input.amountIdr < 0)) {
        return { status: "REFUSED", reason: "COMMISSION_MUST_BE_NEGATIVE", detail: `commission_debit amount must be < 0 · got ${input.amountIdr}` };
      }
      if (!input.tripId) {
        return { status: "REFUSED", reason: "COMMISSION_NEEDS_TRIP", detail: "commission_debit requires a trip_id for audit." };
      }
      break;
    case "payout_debit":
      if (!(input.amountIdr < 0)) {
        return { status: "REFUSED", reason: "PAYOUT_MUST_BE_NEGATIVE", detail: `payout_debit amount must be < 0 · got ${input.amountIdr}` };
      }
      break;
    case "admin_adjustment":
      // no sign restriction · but audited via reason field
      break;
  }

  const balanceAfter = before.balanceIdr + input.amountIdr;
  return {
    status: "OK",
    wallet: {
      driverId: before.driverId,
      balanceIdr: balanceAfter,
      currency: "IDR",
      updatedAt: at,
    },
    transaction: {
      driverId: input.driverId,
      kind: input.kind,
      amountIdr: input.amountIdr,
      balanceAfterIdr: balanceAfter,
      tripId: input.tripId ?? null,
      reference: input.reference ?? null,
      reason: input.reason ?? null,
      createdAt: at,
    },
  };
}

/**
 * Determine whether the driver is currently allowed to accept new NEX jobs
 * from a WALLET perspective. This is one of several dispatch gates · consent,
 * verified status, freshness are checked separately in dispatch.ts.
 *
 * Rule (locked 2026-08-23):
 *   - Driver still within monthly free-trip allowance → ALWAYS dispatchable
 *     (drivers don't need to top up before earning their first Rp).
 *   - Otherwise → balance must be >= policy.minWalletBalanceIdr.
 */
export function isWalletDispatchable(
  wallet: WalletSnapshot,
  completedTripsThisMonth: number,
  policy: CommissionPolicy,
): { dispatchable: boolean; reason: string } {
  if (completedTripsThisMonth < policy.freeCompletedTripsPerMonth) {
    return {
      dispatchable: true,
      reason: `Within free-trip allowance (${completedTripsThisMonth}/${policy.freeCompletedTripsPerMonth} used) · wallet balance not a dispatch gate.`,
    };
  }
  if (wallet.balanceIdr >= policy.minWalletBalanceIdr) {
    return {
      dispatchable: true,
      reason: `Wallet Rp ${wallet.balanceIdr.toLocaleString("id-ID")} >= floor Rp ${policy.minWalletBalanceIdr.toLocaleString("id-ID")}.`,
    };
  }
  return {
    dispatchable: false,
    reason: `Wallet Rp ${wallet.balanceIdr.toLocaleString("id-ID")} < floor Rp ${policy.minWalletBalanceIdr.toLocaleString("id-ID")}. Top up Rp ${policy.walletTopupUnitIdr.toLocaleString("id-ID")} to resume accepting jobs.`,
  };
}

/**
 * Suggested top-up amount to bring the wallet back to a dispatchable state.
 * Rounded up to the nearest walletTopupUnitIdr.
 */
export function suggestedTopupIdr(
  wallet: WalletSnapshot,
  policy: CommissionPolicy,
): number {
  const deficit = policy.minWalletBalanceIdr - wallet.balanceIdr;
  if (deficit <= 0) return 0;
  const unit = policy.walletTopupUnitIdr;
  return Math.ceil(deficit / unit) * unit;
}

/**
 * Reconcile a list of transactions to a running balance. Useful for tests +
 * audits. Independent from the snapshot pathway.
 */
export function reconcileBalance(
  transactions: { amountIdr: number }[],
): number {
  return transactions.reduce((acc, t) => acc + t.amountIdr, 0);
}
