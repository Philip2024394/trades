// src/lib/nex-native/emergency/_notification-hook.ts
//
// NEX Emergency Help · fan-out hook contract (L1 authors stub · L3
// provides the real implementation at
// `./emergency-notification-service.ts`).
//
// This module exists so the server actions in `./actions.ts` can call
// a transition-driven notification hook WITHOUT a hard import on L3's
// (not-yet-landed) notification service. When L3 lands, the import in
// `actions.ts` is swapped to point at the real module and the shapes
// below MUST remain source-compatible.
//
// Doctrine:
//   · The hook is INFORMATIONAL for the caller. It never throws
//     out of normal operation · a failed channel surfaces inside
//     `FanOutResult.failed[]` so the caller can log but still succeed.
//   · The stub is intentionally a NO-OP that returns `simulated: true`
//     with zero attempts. It is NOT a working notification path.
//   · The hook never performs its own authorization. The caller is
//     responsible for actor + state checks before invocation.

import type { IncidentCategory, IncidentState } from "./types";

export interface FanOutFailure {
  readonly channel: "email" | "sms" | "whatsapp" | "in_app";
  readonly recipientId: string;
  readonly reason: string;
}

export interface FanOutResult {
  readonly attempted: number;
  readonly succeeded: number;
  readonly failed: ReadonlyArray<FanOutFailure>;
  /** TRUE when the no-op stub ran · FALSE when the real L3 module ran. */
  readonly simulated: boolean;
}

/** Transitions that trigger a fan-out. The hook contract pins the set
 *  so the caller cannot accidentally pass an unrelated state. */
export type FanOutTransition = Extract<
  IncidentState,
  | "pending_confirmation"
  | "active"
  | "revoked_within_window"
  | "cancelled"
  | "resolved"
>;

export interface FanOutArgs {
  readonly incidentId: string;
  readonly requesterAccountId: string;
  readonly transition: FanOutTransition;
  readonly locationLat: number | null;
  readonly locationLng: number | null;
  readonly category: IncidentCategory;
}

/**
 * Transition-driven fan-out hook. L3 provides the real implementation
 * at `./emergency-notification-service.ts`. Until L3 lands, this stub
 * returns a no-op success so L1's actions compile and run without the
 * notification side effect.
 *
 * When L3 is present, `actions.ts` imports L3's real module directly
 * and this stub is only used as a shape reference + fallback for
 * tests.
 */
export async function fanOutForTransitionStub(
  _args: FanOutArgs,
): Promise<FanOutResult> {
  return {
    attempted: 0,
    succeeded: 0,
    failed: [],
    simulated: true,
  };
}

/** Narrow runtime check so callers can assert they received a sane
 *  result without a type cast. */
export function isFanOutResult(v: unknown): v is FanOutResult {
  if (v === null || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.attempted === "number" &&
    typeof r.succeeded === "number" &&
    Array.isArray(r.failed) &&
    typeof r.simulated === "boolean"
  );
}
