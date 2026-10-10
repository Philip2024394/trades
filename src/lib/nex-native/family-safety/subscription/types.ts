// src/lib/nex-native/family-safety/subscription/types.ts
//
// NEX Family Safety · subscription + entitlement types · Phase 1.
//
// Load-bearing shape doctrine:
//   · PlanId must match the CHECK constraint in migration 202.
//   · EntitlementState must match the CHECK constraint in migration 202.
//   · PaymentIntentResult is the public envelope the test adapter
//     returns · a real provider adapter in Phase 2+ MUST return the
//     same shape to be swap-compatible.

export const PLAN_IDS = [
  "family_safety_pilot_free",
  "family_safety_tbd_1",
  "family_safety_tbd_2",
] as const;

export type PlanId = (typeof PLAN_IDS)[number];

export const ENTITLEMENT_STATES = [
  "pending",
  "active",
  "suspended",
  "cancelled",
  "expired",
  "failed",
] as const;

export type EntitlementState = (typeof ENTITLEMENT_STATES)[number];

export const PAYMENT_PROVIDERS = [
  "test_mode",
  "stripe_tbd",
  "xendit_tbd",
  "manual_grant",
] as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_OUTCOMES = [
  "initiated",
  "succeeded",
  "failed",
  "cancelled",
  "duplicate_ignored",
] as const;

export type PaymentOutcome = (typeof PAYMENT_OUTCOMES)[number];

/** Entitlement row shape · DB-side. */
export interface EntitlementRow {
  readonly entitlementId: string;
  readonly ownerAccountId: string;
  readonly planId: PlanId;
  readonly state: EntitlementState;
  readonly activatedAt: string | null;
  readonly expiresAt: string | null;
  readonly cancelledAt: string | null;
  readonly paymentProvider: PaymentProvider;
  readonly paymentProviderRef: string | null;
  readonly testMode: boolean;
  readonly simulated: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Payment attempt row shape · DB-side. */
export interface PaymentAttemptRow {
  readonly attemptId: string;
  readonly ownerAccountId: string;
  readonly planId: PlanId;
  readonly idempotencyKey: string;
  readonly outcome: PaymentOutcome;
  readonly provider: PaymentProvider;
  readonly providerResponseSummary: string | null;
  readonly entitlementId: string | null;
  readonly testMode: boolean;
  readonly simulated: boolean;
  readonly attemptedAt: string;
}

/** Public envelope every payment adapter returns.
 *
 *  Real-provider note: a Stripe / Xendit adapter in Phase 2+ MUST
 *  return the same shape so the server action can be adapter-agnostic.
 */
export type PaymentIntentResult =
  | {
      readonly kind: "succeeded";
      readonly idempotencyKey: string;
      readonly providerRef: string | null;
      readonly summary: string;
    }
  | {
      readonly kind: "failed";
      readonly idempotencyKey: string;
      readonly reason: string;
      readonly summary: string;
    }
  | {
      readonly kind: "cancelled";
      readonly idempotencyKey: string;
      readonly summary: string;
    }
  | {
      readonly kind: "duplicate_ignored";
      readonly idempotencyKey: string;
      readonly summary: string;
    };

/** Narrow return envelope for every server action in this module. */
export type SubscriptionActionReason =
  | "ok"
  | "not_authenticated"
  | "unknown_plan"
  | "duplicate_ignored"
  | "test_mode_required"
  | "already_active"
  | "no_active_entitlement"
  | "payment_failed"
  | "payment_cancelled"
  | "internal_error";

export interface SubscriptionActionResult<T> {
  readonly ok: boolean;
  readonly reason: SubscriptionActionReason;
  readonly value: T | null;
}

export function result<T>(
  ok: boolean,
  reason: SubscriptionActionReason,
  value: T | null = null,
): SubscriptionActionResult<T> {
  return { ok, reason, value };
}

export function isPlanId(x: unknown): x is PlanId {
  return typeof x === "string" && (PLAN_IDS as readonly string[]).includes(x);
}

export function isEntitlementState(x: unknown): x is EntitlementState {
  return (
    typeof x === "string" && (ENTITLEMENT_STATES as readonly string[]).includes(x)
  );
}
