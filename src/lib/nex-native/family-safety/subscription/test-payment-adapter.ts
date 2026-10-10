// src/lib/nex-native/family-safety/subscription/test-payment-adapter.ts
//
// NEX Family Safety · sealed payment-adapter INTERFACE + the Phase 1
// TEST adapter · the only adapter wired in Phase 1.
//
// Load-bearing doctrine:
//   · This file defines PaymentAdapter · the interface a real
//     provider adapter (Stripe · Xendit) MUST implement in Phase 2+.
//     A real adapter adds itself as a new file next to this one and
//     registers via `registerPaymentAdapter`. The entitlement service
//     is adapter-agnostic.
//   · NO real payment network calls happen here · the test adapter
//     dispatches outcome purely from the `simulatedOutcome` parameter
//     (which maps 1-to-1 to the Playwright `?outcome=` query param on
//     the checkout page).
//   · Every result carries the SAME `idempotencyKey` that was passed
//     in · so a duplicate callback with the same key is detected by
//     the entitlement service (uniqueness constraint in migration 202).

import type { PaymentIntentResult, PlanId } from "./types";

export interface InitiatePaymentInput {
  readonly ownerAccountId: string;
  readonly planId: PlanId;
  readonly idempotencyKey: string;
  /** Only consumed by the TEST adapter. */
  readonly simulatedOutcome?: "succeeded" | "failed" | "cancelled";
}

/** Sealed adapter contract · see `_server-actions.ts` for the caller. */
export interface PaymentAdapter {
  readonly id: "test_mode" | "stripe_tbd" | "xendit_tbd";
  initiatePayment(input: InitiatePaymentInput): Promise<PaymentIntentResult>;
}

// ──────────────────────────────────────────────────────────────────
// TEST adapter · the ONLY adapter wired in Phase 1.
// ──────────────────────────────────────────────────────────────────

export const TEST_PAYMENT_ADAPTER: PaymentAdapter = {
  id: "test_mode",
  async initiatePayment(input): Promise<PaymentIntentResult> {
    const outcome = input.simulatedOutcome ?? "succeeded";
    const trimmedKey = (input.idempotencyKey ?? "").trim();
    if (trimmedKey.length === 0) {
      // Even in the test adapter we refuse to produce a result
      // without an idempotency key · the service layer depends on
      // the key being unique per attempt.
      return {
        kind: "failed",
        idempotencyKey: trimmedKey,
        reason: "missing_idempotency_key",
        summary: "SIMULATED · test adapter rejected missing idempotency_key",
      };
    }
    if (outcome === "succeeded") {
      return {
        kind: "succeeded",
        idempotencyKey: trimmedKey,
        providerRef: `test_mode_ref_${trimmedKey}`,
        summary: "SIMULATED · test adapter succeeded",
      };
    }
    if (outcome === "failed") {
      return {
        kind: "failed",
        idempotencyKey: trimmedKey,
        reason: "simulated_failure",
        summary: "SIMULATED · test adapter failed on request",
      };
    }
    return {
      kind: "cancelled",
      idempotencyKey: trimmedKey,
      summary: "SIMULATED · test adapter cancelled on request",
    };
  },
};

// ──────────────────────────────────────────────────────────────────
// Adapter registry · Phase 1 has ONE adapter · Phase 2+ MAY register
// additional adapters without touching entitlement-service.ts.
// ──────────────────────────────────────────────────────────────────

const REGISTRY = new Map<string, PaymentAdapter>();
REGISTRY.set(TEST_PAYMENT_ADAPTER.id, TEST_PAYMENT_ADAPTER);

export function getAdapter(id: PaymentAdapter["id"]): PaymentAdapter | null {
  return REGISTRY.get(id) ?? null;
}

export function listAdapters(): ReadonlyArray<PaymentAdapter> {
  return Array.from(REGISTRY.values());
}

/** Future adapters register here · never from the test file. */
export function registerPaymentAdapter(a: PaymentAdapter): void {
  REGISTRY.set(a.id, a);
}

/** Reset to the Phase 1 default · used only by the adapter test file. */
export function __resetRegistryForTests(): void {
  REGISTRY.clear();
  REGISTRY.set(TEST_PAYMENT_ADAPTER.id, TEST_PAYMENT_ADAPTER);
}
