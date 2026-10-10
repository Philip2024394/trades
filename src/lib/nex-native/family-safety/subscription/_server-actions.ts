// src/lib/nex-native/family-safety/subscription/_server-actions.ts
//
// NEX Family Safety · subscription · server actions · Phase 1.
//
// Load-bearing doctrine:
//   · All actions enforce `resolveNexAppSessionFromContext` and return
//     `{ok:false, reason:'not_authenticated'}` when the session is
//     absent · they never throw out.
//   · All actions pass through the TEST payment adapter · Phase 1 has
//     no live providers.
//   · All writes carry test_mode=TRUE · simulated=TRUE.
//   · Duplicate payment callback with the same idempotency_key returns
//     `{ok:true, reason:'duplicate_ignored'}` without granting a second
//     entitlement.
//
// Server-only. Marked "use server" so RSC call-sites can import these
// as Server Actions.

"use server";

import { randomUUID } from "node:crypto";
import {
  cancelActiveEntitlement,
  getActiveEntitlement,
  grantActiveEntitlement,
  hasActiveEntitlement,
  recordCancelledPayment,
  recordFailedPayment,
  recordPaymentAttempt,
} from "./entitlement-service";
import { getPlanById } from "./plan-catalog";
import { TEST_PAYMENT_ADAPTER } from "./test-payment-adapter";
import { isPlanId, result, type SubscriptionActionResult } from "./types";

// --------------------------------------------------------------------
// Session resolver · the exact same pattern Emergency Help uses.
// --------------------------------------------------------------------

type SessionLike = { account?: { id?: string | null } | null } | null;

async function resolveActorAccountId(): Promise<string | null> {
  try {
    const mod: {
      resolveNexAppSessionFromContext?: () => Promise<SessionLike>;
    } = await import("@/lib/nex-native/app/session");
    const fn = mod.resolveNexAppSessionFromContext;
    if (typeof fn !== "function") return null;
    const s = await fn();
    const id = s?.account?.id;
    if (typeof id === "string" && id.trim().length > 0) return id;
    return null;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------
// initiateTestCheckoutAction
// --------------------------------------------------------------------

export interface InitiateCheckoutInput {
  readonly planId: string;
  /** Only used by Playwright · propagates to the TEST adapter. */
  readonly simulatedOutcome?: "succeeded" | "failed" | "cancelled";
}

export interface InitiateCheckoutValue {
  readonly idempotencyKey: string;
  readonly planId: string;
  readonly outcome: "succeeded" | "failed" | "cancelled" | "duplicate_ignored";
  readonly entitlementId: string | null;
}

export async function initiateTestCheckoutAction(
  input: InitiateCheckoutInput,
): Promise<SubscriptionActionResult<InitiateCheckoutValue>> {
  const actor = await resolveActorAccountId();
  if (!actor) return result<InitiateCheckoutValue>(false, "not_authenticated");

  const planId = input.planId;
  if (!isPlanId(planId)) {
    return result<InitiateCheckoutValue>(false, "unknown_plan");
  }

  const plan = getPlanById(planId);
  if (!plan) return result<InitiateCheckoutValue>(false, "unknown_plan");

  const idempotencyKey = `fs-test-${randomUUID()}`;

  // Log the initiation attempt.
  await recordPaymentAttempt({
    ownerAccountId: actor,
    planId,
    idempotencyKey: `${idempotencyKey}__init`,
    outcome: "initiated",
    provider: "test_mode",
    providerResponseSummary: "SIMULATED · test adapter initiated",
  });

  // Dispatch through the TEST adapter.
  const r = await TEST_PAYMENT_ADAPTER.initiatePayment({
    ownerAccountId: actor,
    planId,
    idempotencyKey,
    simulatedOutcome: input.simulatedOutcome ?? "succeeded",
  });

  if (r.kind === "succeeded") {
    const grant = await grantActiveEntitlement({
      ownerAccountId: actor,
      planId,
      provider: "test_mode",
      providerRef: r.providerRef ?? null,
      idempotencyKey,
    });
    return result<InitiateCheckoutValue>(
      true,
      grant?.duplicate ? "duplicate_ignored" : "ok",
      {
        idempotencyKey,
        planId,
        outcome: grant?.duplicate ? "duplicate_ignored" : "succeeded",
        entitlementId: grant?.entitlement.entitlementId ?? null,
      },
    );
  }

  if (r.kind === "failed") {
    await recordFailedPayment(actor, planId, idempotencyKey, r.reason);
    return result<InitiateCheckoutValue>(false, "payment_failed", {
      idempotencyKey,
      planId,
      outcome: "failed",
      entitlementId: null,
    });
  }

  if (r.kind === "cancelled") {
    await recordCancelledPayment(actor, planId, idempotencyKey);
    return result<InitiateCheckoutValue>(false, "payment_cancelled", {
      idempotencyKey,
      planId,
      outcome: "cancelled",
      entitlementId: null,
    });
  }

  return result<InitiateCheckoutValue>(true, "duplicate_ignored", {
    idempotencyKey,
    planId,
    outcome: "duplicate_ignored",
    entitlementId: null,
  });
}

// --------------------------------------------------------------------
// confirmTestPaymentAction · simulated webhook callback replay
// --------------------------------------------------------------------

export interface ConfirmPaymentInput {
  readonly planId: string;
  readonly idempotencyKey: string;
}

export interface ConfirmPaymentValue {
  readonly outcome: "succeeded" | "duplicate_ignored";
  readonly entitlementId: string | null;
}

export async function confirmTestPaymentAction(
  input: ConfirmPaymentInput,
): Promise<SubscriptionActionResult<ConfirmPaymentValue>> {
  const actor = await resolveActorAccountId();
  if (!actor) return result<ConfirmPaymentValue>(false, "not_authenticated");

  const planId = input.planId;
  if (!isPlanId(planId)) {
    return result<ConfirmPaymentValue>(false, "unknown_plan");
  }

  const grant = await grantActiveEntitlement({
    ownerAccountId: actor,
    planId,
    provider: "test_mode",
    providerRef: `test_mode_ref_${input.idempotencyKey}`,
    idempotencyKey: input.idempotencyKey,
  });

  return result<ConfirmPaymentValue>(
    true,
    grant?.duplicate ? "duplicate_ignored" : "ok",
    {
      outcome: grant?.duplicate ? "duplicate_ignored" : "succeeded",
      entitlementId: grant?.entitlement.entitlementId ?? null,
    },
  );
}

// --------------------------------------------------------------------
// cancelTestEntitlementAction
// --------------------------------------------------------------------

export interface CancelEntitlementInput {
  readonly planId: string;
}

export interface CancelEntitlementValue {
  readonly entitlementId: string;
}

export async function cancelTestEntitlementAction(
  input: CancelEntitlementInput,
): Promise<SubscriptionActionResult<CancelEntitlementValue>> {
  const actor = await resolveActorAccountId();
  if (!actor)
    return result<CancelEntitlementValue>(false, "not_authenticated");

  const planId = input.planId;
  if (!isPlanId(planId))
    return result<CancelEntitlementValue>(false, "unknown_plan");

  const cancelled = await cancelActiveEntitlement(actor, planId);
  if (!cancelled)
    return result<CancelEntitlementValue>(false, "no_active_entitlement");

  return result<CancelEntitlementValue>(true, "ok", {
    entitlementId: cancelled.entitlementId,
  });
}

// --------------------------------------------------------------------
// readMyEntitlementAction · dashboard uses this
// --------------------------------------------------------------------

export interface ReadMyEntitlementValue {
  readonly isActive: boolean;
  readonly planId: string;
  readonly entitlementId: string | null;
  readonly activatedAt: string | null;
  readonly cancelledAt: string | null;
}

export async function readMyEntitlementAction(input: {
  readonly planId: string;
}): Promise<SubscriptionActionResult<ReadMyEntitlementValue>> {
  const actor = await resolveActorAccountId();
  if (!actor) return result<ReadMyEntitlementValue>(false, "not_authenticated");

  const planId = input.planId;
  if (!isPlanId(planId))
    return result<ReadMyEntitlementValue>(false, "unknown_plan");

  const row = await getActiveEntitlement(actor, planId);
  const isActive = row !== null && (await hasActiveEntitlement(actor, planId));
  return result<ReadMyEntitlementValue>(true, "ok", {
    isActive,
    planId,
    entitlementId: row?.entitlementId ?? null,
    activatedAt: row?.activatedAt ?? null,
    cancelledAt: row?.cancelledAt ?? null,
  });
}
