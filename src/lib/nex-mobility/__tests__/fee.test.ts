// src/lib/nex-mobility/__tests__/fee.test.ts · Philip 2026-08-29
//
// Pure unit tests for the 8% fee math. No DB. Locks the rounding rule so
// future refactors can't silently shift a rupiah.

import { describe, it, expect } from "vitest";
import {
  calcNetworkFee,
  isProviderEligibleForBroadcast,
  NEX_FEE_BASIS_POINTS,
  MONTHLY_FREE_ALLOWANCE,
} from "../fee";

describe("calcNetworkFee · 8% rounded to nearest integer IDR", () => {
  it("standard price presets return expected fees", () => {
    expect(calcNetworkFee(15000)).toBe(1200);
    expect(calcNetworkFee(18000)).toBe(1440);
    expect(calcNetworkFee(22000)).toBe(1760);
    expect(calcNetworkFee(28000)).toBe(2240);
    expect(calcNetworkFee(35000)).toBe(2800);
  });

  it("small prices round toward zero when < 0.5 IDR fee", () => {
    expect(calcNetworkFee(0)).toBe(0);
    expect(calcNetworkFee(1)).toBe(0);   // 0.08 → 0
    expect(calcNetworkFee(6)).toBe(0);   // 0.48 → 0
    expect(calcNetworkFee(7)).toBe(1);   // 0.56 → 1
    expect(calcNetworkFee(12)).toBe(1);  // 0.96 → 1
    expect(calcNetworkFee(13)).toBe(1);  // 1.04 → 1
  });

  it("boundary cases straddling half-IDR round consistently (Math.round: half-to-+∞)", () => {
    // For positive integers Math.round is half-to-positive-infinity, so
    // 0.5 → 1, 1.5 → 2, 2.5 → 3. Confirm we do not accidentally use banker's.
    expect(calcNetworkFee(12488)).toBe(999);   // 999.04 → 999
    expect(calcNetworkFee(12494)).toBe(1000);  // 999.52 → 1000
    expect(calcNetworkFee(12500)).toBe(1000);  // 1000.00 → 1000
    expect(calcNetworkFee(12563)).toBe(1005);  // 1005.04 → 1005
    expect(calcNetworkFee(6250)).toBe(500);    // 500.00 exact
    expect(calcNetworkFee(6251)).toBe(500);    // 500.08 → 500
    expect(calcNetworkFee(6256)).toBe(500);    // 500.48 → 500
    expect(calcNetworkFee(6257)).toBe(501);    // 500.56 → 501
  });

  it("very large prices stay in safe integer range", () => {
    expect(calcNetworkFee(1_000_000)).toBe(80_000);
    expect(calcNetworkFee(5_000_000)).toBe(400_000);
    // Cap of MAX_SAFE_INTEGER is ~9e15 · we're nowhere near it
    expect(Number.isSafeInteger(calcNetworkFee(1_000_000))).toBe(true);
  });

  it("invalid inputs collapse to 0 (safe default)", () => {
    expect(calcNetworkFee(Number.NaN)).toBe(0);
    expect(calcNetworkFee(-100)).toBe(0);
    expect(calcNetworkFee(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("computation is deterministic across runs (no float drift)", () => {
    for (let i = 0; i < 1000; i++) {
      const first = calcNetworkFee(18000);
      const second = calcNetworkFee(18000);
      expect(first).toBe(second);
    }
  });

  it("basis-points constant is 800 = 8.00%", () => {
    expect(NEX_FEE_BASIS_POINTS).toBe(800);
  });

  it("monthly free allowance is 2 · lock 39", () => {
    expect(MONTHLY_FREE_ALLOWANCE).toBe(2);
  });
});

describe("isProviderEligibleForBroadcast · wallet + allowance gate", () => {
  const price = 18000;
  const fee   = calcNetworkFee(price); // 1440

  it("eligible when free allowance remains, ignoring wallet", () => {
    expect(isProviderEligibleForBroadcast({
      price_per_service_idr: price,
      wallet_balance_idr: 0,
      free_used_this_month: 0,
    })).toBe(true);
    expect(isProviderEligibleForBroadcast({
      price_per_service_idr: price,
      wallet_balance_idr: 0,
      free_used_this_month: 1,
    })).toBe(true);
  });

  it("wallet exactly equal to fee is eligible (>= not >)", () => {
    expect(isProviderEligibleForBroadcast({
      price_per_service_idr: price,
      wallet_balance_idr: fee,
      free_used_this_month: 2,
    })).toBe(true);
  });

  it("wallet 1 IDR short of fee is NOT eligible", () => {
    expect(isProviderEligibleForBroadcast({
      price_per_service_idr: price,
      wallet_balance_idr: fee - 1,
      free_used_this_month: 2,
    })).toBe(false);
  });

  it("wallet above fee is eligible", () => {
    expect(isProviderEligibleForBroadcast({
      price_per_service_idr: price,
      wallet_balance_idr: fee * 10,
      free_used_this_month: 2,
    })).toBe(true);
  });

  it("provider without price is never eligible", () => {
    expect(isProviderEligibleForBroadcast({
      price_per_service_idr: null,
      wallet_balance_idr: 100_000,
      free_used_this_month: 0,
    })).toBe(false);
  });

  it("null wallet is treated as 0", () => {
    expect(isProviderEligibleForBroadcast({
      price_per_service_idr: price,
      wallet_balance_idr: null,
      free_used_this_month: 5,
    })).toBe(false);
    expect(isProviderEligibleForBroadcast({
      price_per_service_idr: price,
      wallet_balance_idr: null,
      free_used_this_month: 0,   // still has allowance
    })).toBe(true);
  });
});
