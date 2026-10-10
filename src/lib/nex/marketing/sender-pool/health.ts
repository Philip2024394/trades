// src/lib/nex/marketing/sender-pool/health.ts
//
// NEX Managed Email Marketing · Stage 2 · Sender health state machine
// Founder-authorised programme.
//
// Pure state-transition logic + threshold-driven state derivation.
// No DB · no network · fully deterministic.

import type { HealthState, SenderIdentity } from "./types";
import { VALID_HEALTH_TRANSITIONS, InvalidHealthTransitionError } from "./types";

/** Validate a proposed transition · throw if illegal. */
export function assertValidHealthTransition(from: HealthState, to: HealthState): void {
  if (from === to) return;   // no-op transitions permitted
  const ok = VALID_HEALTH_TRANSITIONS.some(t => t.from === from && t.to === to);
  if (!ok) throw new InvalidHealthTransitionError(from, to);
}

/** Deterministic health derivation from observable signals.
 *  Called by the reputation/monitoring engine · never by ad-hoc code.
 *
 *  Priority order (highest wins):
 *   1. disabled           · terminal · never overridden
 *   2. provider_blocked   · provider rejected sender
 *   3. authentication_required · auth expired/failed
 *   4. paused             · admin action
 *   5. reputation_protection · bounce > 5% OR complaint > 0.5%
 *   6. warning            · bounce > 2% OR complaint > 0.1%
 *   7. limited            · usage > 80% of daily/hourly capacity
 *   8. healthy            · default
 */
export interface DeriveHealthInputs {
  readonly current_state: HealthState;
  readonly authentication_state: SenderIdentity["authentication_state"];
  readonly bounce_rate: number | null;
  readonly complaint_rate: number | null;
  readonly hourly_used_ratio: number | null;   // 0..1 · null if no limit configured
  readonly daily_used_ratio: number | null;
  readonly provider_blocked: boolean;
  readonly admin_paused: boolean;
}

export interface DerivedHealth {
  readonly proposed_state: HealthState;
  readonly reason: string;
}

// Configurable thresholds · founder-locked defaults · overridable per environment
export const DEFAULT_HEALTH_THRESHOLDS = {
  reputation_protection_bounce_rate: 0.05,
  reputation_protection_complaint_rate: 0.005,
  warning_bounce_rate: 0.02,
  warning_complaint_rate: 0.001,
  limited_usage_ratio: 0.80,
} as const;

export function deriveHealth(
  input: DeriveHealthInputs,
  thresholds: typeof DEFAULT_HEALTH_THRESHOLDS = DEFAULT_HEALTH_THRESHOLDS,
): DerivedHealth {
  // Terminal state · never override
  if (input.current_state === "disabled") {
    return { proposed_state: "disabled", reason: "terminal_state" };
  }

  // Absolute blocks
  if (input.provider_blocked) {
    return { proposed_state: "provider_blocked", reason: "provider_explicit_block" };
  }
  if (input.authentication_state === "expired" || input.authentication_state === "failed") {
    return { proposed_state: "authentication_required", reason: `authentication_state=${input.authentication_state}` };
  }
  if (input.admin_paused) {
    return { proposed_state: "paused", reason: "admin_paused" };
  }

  // Reputation triggers
  const br = input.bounce_rate ?? 0;
  const cr = input.complaint_rate ?? 0;
  if (br >= thresholds.reputation_protection_bounce_rate || cr >= thresholds.reputation_protection_complaint_rate) {
    return {
      proposed_state: "reputation_protection",
      reason: `bounce_rate=${br.toFixed(4)} complaint_rate=${cr.toFixed(4)} · at or above reputation-protection threshold`,
    };
  }
  if (br >= thresholds.warning_bounce_rate || cr >= thresholds.warning_complaint_rate) {
    return {
      proposed_state: "warning",
      reason: `bounce_rate=${br.toFixed(4)} complaint_rate=${cr.toFixed(4)} · at or above warning threshold`,
    };
  }

  // Capacity-usage triggers (limited state)
  const hu = input.hourly_used_ratio ?? 0;
  const du = input.daily_used_ratio ?? 0;
  const max_usage = Math.max(hu, du);
  if (max_usage >= thresholds.limited_usage_ratio) {
    return {
      proposed_state: "limited",
      reason: `usage_ratio=${max_usage.toFixed(3)} · above limited threshold`,
    };
  }

  return { proposed_state: "healthy", reason: "no_signal_triggers" };
}
