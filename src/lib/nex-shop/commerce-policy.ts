// src/lib/nex-shop/commerce-policy.ts
//
// COMMERCE POLICY · pure fee calculator.
//
// Doctrine: seller_fee_rate is read from a nex.mp_commerce_policy row.
// NEVER hard-coded. Configurable per jurisdiction + optional category scope.

import type { CommercePolicy } from "./types";

export interface FeeCalcInput {
  saleIdr: number;
  jurisdiction: string;
  categoryId: string | null;
  policies: CommercePolicy[];
  now?: Date;
}

export interface FeeCalcOK {
  status: "OK";
  saleIdr: number;
  sellerReceivesIdr: number;
  nexCommissionIdr: number;
  appliedRate: number;
  policyId: string;
  currency: "IDR";
  reconciliation: string;
}

export interface FeeCalcRefused {
  status: "REFUSED";
  reason: "SALE_NON_POSITIVE" | "NO_POLICY_MATCH";
  detail: string;
}

export type FeeCalcResult = FeeCalcOK | FeeCalcRefused;

/**
 * Pick the most specific effective policy: category-scoped preferred over
 * jurisdiction-only. Effective window must cover `now`.
 */
function selectPolicy(
  policies: CommercePolicy[],
  jurisdiction: string,
  categoryId: string | null,
  now: Date,
): CommercePolicy | null {
  const nowMs = now.getTime();
  const active = policies.filter((p) => {
    if (p.jurisdiction !== jurisdiction) return false;
    if (p.effectiveFrom.getTime() > nowMs) return false;
    if (p.effectiveTo != null && p.effectiveTo.getTime() <= nowMs) return false;
    return true;
  });
  if (active.length === 0) return null;
  // Prefer category-scoped match over jurisdiction-only
  const scoped = categoryId ? active.find((p) => p.categoryId === categoryId) : undefined;
  if (scoped) return scoped;
  const generic = active.find((p) => p.categoryId == null);
  return generic ?? active[0];
}

export function calculateSellerFee(input: FeeCalcInput): FeeCalcResult {
  if (!(input.saleIdr > 0)) {
    return { status: "REFUSED", reason: "SALE_NON_POSITIVE", detail: `saleIdr must be > 0 · got ${input.saleIdr}` };
  }
  const now = input.now ?? new Date();
  const policy = selectPolicy(input.policies, input.jurisdiction, input.categoryId, now);
  if (!policy) {
    return { status: "REFUSED", reason: "NO_POLICY_MATCH", detail: `No effective commerce policy for jurisdiction '${input.jurisdiction}'.` };
  }
  const rawFee = input.saleIdr * policy.sellerFeeRate;
  let nexCommissionIdr = Math.round(rawFee);
  if (nexCommissionIdr < policy.minFeeIdr) nexCommissionIdr = policy.minFeeIdr;
  if (policy.maxFeeIdr != null && nexCommissionIdr > policy.maxFeeIdr) nexCommissionIdr = policy.maxFeeIdr;
  // Cap commission at sale amount just in case (min/max misconfigured)
  if (nexCommissionIdr > input.saleIdr) nexCommissionIdr = input.saleIdr;
  const sellerReceivesIdr = input.saleIdr - nexCommissionIdr;

  return {
    status: "OK",
    saleIdr: input.saleIdr,
    sellerReceivesIdr,
    nexCommissionIdr,
    appliedRate: policy.sellerFeeRate,
    policyId: policy.policyId,
    currency: "IDR",
    reconciliation: `${sellerReceivesIdr} + ${nexCommissionIdr} = ${input.saleIdr}`,
  };
}
