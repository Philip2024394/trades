// src/lib/nex-mobility/fee.ts · Philip 2026-08-29
//
// NEX network-fee math. Pure functions. Single source of truth for the 8%
// deduction and monthly allowance policy (doctrine v5 locks 37-39).
//
// EXACT ROUNDING RULE (constitutional):
//   network_fee_idr = Math.round(price_agreed_idr * NEX_FEE_BASIS_POINTS / 10000)
//
// This is JavaScript's Math.round: half-to-positive-infinity (banker's-neutral
// on positive integers). We do the multiplication in integer basis-points
// first to keep everything on integer math paths — no float drift at IDR
// scale. IDR has no sub-unit currency, so an integer output is exactly what
// the wallet ledger stores.
//
// Examples (verified in unit tests):
//   price   = 18000 → fee = 1440
//   price   = 22000 → fee = 1760
//   price   = 15000 → fee = 1200
//   price   = 12500 → fee = 1000
//   price   = 12488 → fee = 999    (99.904 → 999.04 → 999)
//   price   = 12494 → fee = 1000   (99.952 → 999.52 → 1000)
//   price   = 1     → fee = 0
//   price   = 6     → fee = 0      (0.48 → 0)
//   price   = 7     → fee = 1      (0.56 → 1)

export const NEX_FEE_BASIS_POINTS = 800;     // 8.00% (out of 10 000 bp)
export const MONTHLY_FREE_ALLOWANCE = 2;     // completed requests per calendar month, no fee

/**
 * Canonical network-fee calculation.
 *
 * @param priceAgreedIdr  The immutable price snapshotted onto the request
 *                        when the provider accepted (never changes after).
 * @returns integer IDR fee, always >= 0.
 */
export function calcNetworkFee(priceAgreedIdr: number): number {
  if (!Number.isFinite(priceAgreedIdr)) return 0;
  if (priceAgreedIdr <= 0) return 0;
  return Math.round((priceAgreedIdr * NEX_FEE_BASIS_POINTS) / 10000);
}

/**
 * True when the provider should be eligible to receive a broadcast — either
 * they still have monthly allowance remaining, OR their wallet balance is
 * >= the fee that would be charged on their listed price.
 *
 * Doctrine lock 42: wallet gate at eligibility, not at completion. A
 * completed service must never be abandoned for a wallet issue.
 */
export function isProviderEligibleForBroadcast(row: {
  price_per_service_idr: number | null | undefined;
  wallet_balance_idr: number | null | undefined;
  free_used_this_month: number | null | undefined;
}): boolean {
  if (row.price_per_service_idr == null) return false;
  const freeRemaining = MONTHLY_FREE_ALLOWANCE - Number(row.free_used_this_month ?? 0);
  if (freeRemaining > 0) return true;
  const fee = calcNetworkFee(Number(row.price_per_service_idr));
  return Number(row.wallet_balance_idr ?? 0) >= fee;
}
