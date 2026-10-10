// src/lib/nex/marketing/sender-pool/types.ts
//
// NEX Managed Email Marketing · Stage 2 · Sender Pool types
// Founder-authorised programme (three-lane operating doctrine 2026-09-21 · ADR-0003a Accepted).
//
// Canonical vocabulary shared by all three lanes (AUTO · MEMBER · FOUNDER).
// One production model. Doctrine hard-locks (Clauses 4·8·9·10) enforced at
// insert-time by the repository + selection engine.

// ─── Lane vocabulary (three-lane operating doctrine) ───────────────
export type Lane = "auto" | "member" | "founder";

// ─── Providers (matches migration CHECK constraint + email adapter registry) ─
export type Provider =
  | "resend"
  | "sendgrid"
  | "ses"
  | "mailgun"
  | "postmark"
  | "smtp-generic";

// ─── Authentication + verification (Clause 9) ──────────────────────
export type AuthenticationState = "pending" | "verified" | "expired" | "failed";

export type VerificationState =
  | "unverified"
  | "domain_pending"
  | "domain_verified"
  | "oauth_verified"
  | "dashboard_delegated"
  | "failed";

// ─── Health state machine (founder-locked 8-state vocabulary) ──────
export type HealthState =
  | "healthy"                    // ready to send · within capacity · reputation clean
  | "limited"                    // near capacity or minor reputation dip · sends allowed but conservative
  | "warning"                    // provider warning · investigate · sends allowed under caution
  | "paused"                     // temporarily halted by admin/system · reversible · sends refused
  | "authentication_required"    // auth expired / failed / needs re-auth · sends refused
  | "provider_blocked"           // provider explicitly rejected sender · sends refused
  | "reputation_protection"      // NEX-initiated hold due to bounce/complaint spike · sends refused
  | "disabled";                  // permanent · sends refused · terminal

// States that PERMIT sending (subject to capacity + authentication)
export const SENDABLE_HEALTH_STATES: ReadonlySet<HealthState> = new Set([
  "healthy",
  "limited",
  "warning",
]);

// States that BLOCK sending
export const BLOCKED_HEALTH_STATES: ReadonlySet<HealthState> = new Set([
  "paused",
  "authentication_required",
  "provider_blocked",
  "reputation_protection",
  "disabled",
]);

// Valid state transitions (M23-style · terminal states absorbing)
export const VALID_HEALTH_TRANSITIONS: ReadonlyArray<{ from: HealthState; to: HealthState }> = [
  { from: "healthy", to: "limited" },
  { from: "healthy", to: "warning" },
  { from: "healthy", to: "paused" },
  { from: "healthy", to: "authentication_required" },
  { from: "healthy", to: "provider_blocked" },
  { from: "healthy", to: "reputation_protection" },
  { from: "healthy", to: "disabled" },
  { from: "limited", to: "healthy" },
  { from: "limited", to: "warning" },
  { from: "limited", to: "paused" },
  { from: "limited", to: "reputation_protection" },
  { from: "limited", to: "provider_blocked" },
  { from: "limited", to: "disabled" },
  { from: "warning", to: "healthy" },
  { from: "warning", to: "limited" },
  { from: "warning", to: "paused" },
  { from: "warning", to: "reputation_protection" },
  { from: "warning", to: "provider_blocked" },
  { from: "warning", to: "disabled" },
  { from: "paused", to: "healthy" },
  { from: "paused", to: "disabled" },
  { from: "authentication_required", to: "healthy" },
  { from: "authentication_required", to: "disabled" },
  { from: "provider_blocked", to: "healthy" },
  { from: "provider_blocked", to: "disabled" },
  { from: "reputation_protection", to: "healthy" },
  { from: "reputation_protection", to: "warning" },
  { from: "reputation_protection", to: "disabled" },
  // 'disabled' is terminal · no transitions out
];

// ─── The canonical sender identity ─────────────────────────────────
export interface SenderIdentity {
  readonly sender_id: string;
  readonly member_id: string | null;                   // NULL for AUTO + FOUNDER · required for MEMBER
  readonly lane: Lane;

  // Identity
  readonly email: string;
  readonly display_name: string | null;
  readonly reply_to: string | null;
  readonly sending_domain: string | null;

  // Provider
  readonly provider: Provider;
  readonly provider_account_ref: string | null;

  // Authentication / verification
  readonly authentication_state: AuthenticationState;
  readonly verification_state: VerificationState;
  readonly authentication_expires_at: string | null;

  // Capacity (never hard-coded · provider-authorised)
  readonly daily_capacity: number | null;
  readonly hourly_capacity: number | null;
  readonly capacity_source: string | null;
  readonly capacity_verified_at: string | null;

  // Health
  readonly health_state: HealthState;
  readonly paused_reason: string | null;

  // Signals
  readonly last_send_at: string | null;
  readonly last_event_at: string | null;
  readonly last_failure_at: string | null;
  readonly last_failure_reason: string | null;
  readonly bounce_rate: number | null;
  readonly complaint_rate: number | null;

  // Authorisation trail
  readonly authorised_at: string | null;
  readonly authorised_by: string | null;
  readonly provenance: Readonly<Record<string, unknown>>;

  readonly created_at: string;
  readonly updated_at: string;
}

// ─── Capacity view (computed at selection time) ────────────────────
export interface SenderCapacity {
  readonly sender_id: string;
  readonly hourly_limit: number | null;
  readonly hourly_used: number;
  readonly hourly_remaining: number | null;            // null if no limit configured
  readonly daily_limit: number | null;
  readonly daily_used: number;
  readonly daily_remaining: number | null;
  /** Minimum of hourly_remaining and daily_remaining · null if both are null · 0 if either is 0 */
  readonly effective_remaining: number | null;
}

// ─── Selection input (lane-aware) ──────────────────────────────────
export interface SelectionInput {
  readonly lane: Lane;
  /** Required when lane='member' · MUST match the sender's member_id (Clause 4 member isolation). */
  readonly member_id?: string;
  /** Optional campaign_id for audit attribution. */
  readonly campaign_id?: string;
  /** How many sends are being requested? Defaults to 1. Selector rejects candidates
   *  whose effective_remaining is below `need`. */
  readonly need?: number;
  /** Preferred provider (weak preference · not enforced when unavailable). */
  readonly prefer_provider?: Provider;
  /** Injectable now-fn for deterministic tests. */
  readonly now?: () => Date;
}

export type SelectionOutcome =
  | { kind: "selected"; sender: SenderIdentity; capacity: SenderCapacity }
  | { kind: "no_eligible_sender"; reason: SelectionRefusalReason; candidates_considered: number };

export type SelectionRefusalReason =
  | "lane_mismatch"                    // no sender matched the requested lane
  | "member_scope_mismatch"             // member lane requested but no sender exists for that member_id
  | "authentication_required"           // all candidates unauthenticated
  | "health_blocked"                    // all candidates in a blocking health state
  | "capacity_exhausted"                // Clause 8 rule fires · all senders at cap · WAIT (never rotate to bypass)
  | "no_authorised_sender"              // no senders exist for the lane
  | "invalid_input";

// ─── Audit event kinds ──────────────────────────────────────────────
export type SenderAuditEventKind =
  | "created"
  | "authorised"
  | "verification_completed"
  | "authentication_changed"
  | "capacity_changed"
  | "health_changed"
  | "paused"
  | "resumed"
  | "blocked"
  | "disabled"
  | "send_attributed"
  | "provider_failure"
  | "reputation_protection_activated"
  | "reputation_protection_cleared";

export interface SenderAuditEvent {
  readonly audit_id: string;
  readonly sender_id: string;
  readonly event_type: SenderAuditEventKind;
  readonly from_state: Readonly<Record<string, unknown>> | null;
  readonly to_state: Readonly<Record<string, unknown>> | null;
  readonly actor: string;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly at_iso: string;
}

// ─── Errors ─────────────────────────────────────────────────────────
export class SenderPoolError extends Error {
  constructor(public readonly reason: string, message: string) {
    super(message);
    this.name = "SenderPoolError";
  }
}

export class InvalidHealthTransitionError extends SenderPoolError {
  constructor(from: HealthState, to: HealthState) {
    super("invalid_health_transition", `Cannot transition sender health from '${from}' to '${to}' · violates Stage-2 state machine.`);
  }
}

export class SenderNotAuthorisedError extends SenderPoolError {
  constructor(sender_id: string, actor: string) {
    super("sender_not_authorised", `Sender ${sender_id} not authorised for use by ${actor} · Clause 4 member-isolation or Clause 9 authentication requirement violated.`);
  }
}

export class CapacityEvasionAttemptError extends SenderPoolError {
  constructor(detail: string) {
    super("capacity_evasion_attempt", `Refused to route around exhausted sender capacity: ${detail} · Clause 8 no-evasion rule.`);
  }
}
