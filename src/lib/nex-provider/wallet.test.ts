// src/lib/nex-provider/wallet.test.ts

import { describe, it, expect } from "vitest";
import {
  applyWalletTransaction,
  isWalletDispatchable,
  suggestedTopupIdr,
  reconcileBalance,
  type WalletSnapshot,
} from "./wallet";
import type { CommissionPolicy } from "./provider-network-types";

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

const emptyWallet = (id = "d1"): WalletSnapshot => ({
  driverId: id,
  balanceIdr: 0,
  currency: "IDR",
  updatedAt: new Date("2026-08-23T00:00:00Z"),
});

describe("Wallet · applyWalletTransaction enforces kind-invariants", () => {
  it("topup must be positive", () => {
    const r = applyWalletTransaction(emptyWallet(), {
      driverId: "d1", kind: "topup", amountIdr: -100,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("TOPUP_MUST_BE_POSITIVE");
  });

  it("commission_debit must be negative", () => {
    const r = applyWalletTransaction(emptyWallet(), {
      driverId: "d1", kind: "commission_debit", amountIdr: 100, tripId: "t1",
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("COMMISSION_MUST_BE_NEGATIVE");
  });

  it("commission_debit requires a trip_id", () => {
    const r = applyWalletTransaction(emptyWallet(), {
      driverId: "d1", kind: "commission_debit", amountIdr: -100,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("COMMISSION_NEEDS_TRIP");
  });

  it("refund_credit must be positive", () => {
    const r = applyWalletTransaction(emptyWallet(), {
      driverId: "d1", kind: "refund_credit", amountIdr: -1,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("REFUND_MUST_BE_POSITIVE");
  });

  it("payout_debit must be negative", () => {
    const r = applyWalletTransaction(emptyWallet(), {
      driverId: "d1", kind: "payout_debit", amountIdr: 1000,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("PAYOUT_MUST_BE_NEGATIVE");
  });
});

describe("Wallet · balance mutates correctly", () => {
  it("topup Rp 10,000 → balance 10,000", () => {
    const r = applyWalletTransaction(emptyWallet(), {
      driverId: "d1", kind: "topup", amountIdr: 10000,
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") {
      expect(r.wallet.balanceIdr).toBe(10000);
      expect(r.transaction.balanceAfterIdr).toBe(10000);
    }
  });

  it("commission_debit -4000 on balance 10000 → 6000", () => {
    const start: WalletSnapshot = { ...emptyWallet(), balanceIdr: 10000 };
    const r = applyWalletTransaction(start, {
      driverId: "d1", kind: "commission_debit", amountIdr: -4000, tripId: "t1",
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") expect(r.wallet.balanceIdr).toBe(6000);
  });

  it("commission_debit that goes below zero is permitted (debt tracked)", () => {
    const start: WalletSnapshot = { ...emptyWallet(), balanceIdr: 500 };
    const r = applyWalletTransaction(start, {
      driverId: "d1", kind: "commission_debit", amountIdr: -4000, tripId: "t1",
    });
    expect(r.status).toBe("OK");
    if (r.status === "OK") expect(r.wallet.balanceIdr).toBe(-3500);
  });
});

describe("Wallet · isWalletDispatchable", () => {
  it("free-trip allowance takes precedence · balance ignored while within allowance", () => {
    const empty = emptyWallet();
    const r = isWalletDispatchable(empty, 0, POLICY); // 0 completed · allowance 3
    expect(r.dispatchable).toBe(true);
    expect(r.reason).toMatch(/free-trip allowance/i);
  });

  it("still dispatchable when balance >= floor (allowance exhausted)", () => {
    const w: WalletSnapshot = { ...emptyWallet(), balanceIdr: 100 };
    const r = isWalletDispatchable(w, 5, POLICY);
    expect(r.dispatchable).toBe(true);
  });

  it("NOT dispatchable when allowance exhausted AND balance < floor", () => {
    const w: WalletSnapshot = { ...emptyWallet(), balanceIdr: -100 };
    const r = isWalletDispatchable(w, 5, POLICY);
    expect(r.dispatchable).toBe(false);
    expect(r.reason).toMatch(/Top up/);
  });

  it("configurable floor · policy at Rp 5,000 floor · balance 3,000 = blocked", () => {
    const strict: CommissionPolicy = { ...POLICY, minWalletBalanceIdr: 5000 };
    const w: WalletSnapshot = { ...emptyWallet(), balanceIdr: 3000 };
    const r = isWalletDispatchable(w, 10, strict);
    expect(r.dispatchable).toBe(false);
  });
});

describe("Wallet · suggestedTopupIdr rounds up to policy unit", () => {
  it("no top up needed when balance already above floor", () => {
    const w: WalletSnapshot = { ...emptyWallet(), balanceIdr: 500 };
    const strict: CommissionPolicy = { ...POLICY, minWalletBalanceIdr: 0 };
    expect(suggestedTopupIdr(w, strict)).toBe(0);
  });

  it("Rp 7,500 deficit rounds up to Rp 10,000", () => {
    const w: WalletSnapshot = { ...emptyWallet(), balanceIdr: -7500 };
    expect(suggestedTopupIdr(w, POLICY)).toBe(10000);
  });

  it("Rp 12,000 deficit rounds up to Rp 20,000", () => {
    const w: WalletSnapshot = { ...emptyWallet(), balanceIdr: -12000 };
    expect(suggestedTopupIdr(w, POLICY)).toBe(20000);
  });
});

describe("Wallet · reconcileBalance = SUM(amount) for audit", () => {
  it("reconciles topups + debits + refunds", () => {
    const total = reconcileBalance([
      { amountIdr: 10000 },
      { amountIdr: -4000 },
      { amountIdr: -3200 },
      { amountIdr: 1500 },
    ]);
    expect(total).toBe(4300);
  });
});
