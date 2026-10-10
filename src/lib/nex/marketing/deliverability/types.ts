// src/lib/nex/marketing/deliverability/types.ts
//
// NEX Deliverability Intelligence · types
// Founder-authorised programme · Session-5 · Part 12 · 2026-09-21.

export type SpfStatus =
  | "unknown" | "missing" | "pass" | "soft_fail" | "hard_fail" | "permerror";

export type DkimStatus =
  | "unknown" | "missing" | "pass" | "fail" | "no_signature";

export type DmarcStatus =
  | "unknown" | "missing" | "pass" | "fail"
  | "none_policy" | "quarantine_policy" | "reject_policy";

export type ReputationState =
  | "unknown"
  | "healthy"     // bounce_rate <2% AND complaint_rate <0.1%
  | "watch"       // bounce_rate 2-4% OR complaint_rate 0.1-0.3%
  | "warning"     // bounce_rate 4-8% OR complaint_rate 0.3-0.5%
  | "limited"     // bounce_rate 8-12% OR complaint_rate 0.5-1%
  | "frozen";     // bounce_rate ≥12% OR complaint_rate ≥1%

export interface DomainAuth {
  readonly sending_domain: string;
  readonly spf_status: SpfStatus;
  readonly spf_record: string | null;
  readonly dkim_status: DkimStatus;
  readonly dkim_selector: string | null;
  readonly dmarc_status: DmarcStatus;
  readonly dmarc_policy: string | null;
  readonly dmarc_pct: number | null;
  readonly aligned: boolean;
  readonly check_source: string | null;
  readonly check_method: string | null;
  readonly last_verified_at: string | null;
  readonly last_check_error: string | null;
  readonly first_observed_at: string;
  readonly updated_at: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface SenderReputation {
  readonly sender_id: string;
  readonly sends_24h: number;
  readonly sends_7d: number;
  readonly bounces_24h: number;
  readonly bounces_7d: number;
  readonly complaints_24h: number;
  readonly complaints_7d: number;
  readonly unsubs_24h: number;
  readonly unsubs_7d: number;
  readonly bounce_rate_24h: number | null;
  readonly bounce_rate_7d: number | null;
  readonly complaint_rate_24h: number | null;
  readonly complaint_rate_7d: number | null;
  readonly delivery_latency_p50_ms: number | null;
  readonly delivery_latency_p95_ms: number | null;
  readonly reputation_state: ReputationState;
  readonly reputation_reason: string | null;
  readonly computed_at: string;
  readonly window_end_at: string;
}

// ─── Reputation floor thresholds (Founder-authored · not runtime-editable) ─
// Derived from public deliverability best practice · encoded here as
// deterministic gates rather than opinions.
export interface ReputationThresholds {
  readonly bounce_watch: number;
  readonly bounce_warning: number;
  readonly bounce_limited: number;
  readonly bounce_frozen: number;
  readonly complaint_watch: number;
  readonly complaint_warning: number;
  readonly complaint_limited: number;
  readonly complaint_frozen: number;
}

export const DEFAULT_THRESHOLDS: ReputationThresholds = {
  bounce_watch:      0.02,
  bounce_warning:    0.04,
  bounce_limited:    0.08,
  bounce_frozen:     0.12,
  complaint_watch:   0.001,
  complaint_warning: 0.003,
  complaint_limited: 0.005,
  complaint_frozen:  0.010,
};

// ─── Next-permitted-send calculator inputs/outputs ─────────────────
export interface NextPermittedSendInput {
  readonly sender_id: string;
  readonly requested_units: number;
  readonly now?: () => Date;
}

export type NextPermittedSendOutcome =
  | { kind: "permitted"; permitted_units: number; reason: string }
  | { kind: "reputation_hold"; reputation_state: ReputationState; reason: string }
  | { kind: "capacity_exhausted"; remaining_hourly: number; remaining_daily: number }
  | { kind: "sender_not_found"; sender_id: string }
  | { kind: "sender_unhealthy"; health_state: string }
  | { kind: "domain_auth_blocked"; reason: string };

// Structural boundary markers · verified in acceptance
export const _DELIVERABILITY_NEVER_HARDCODES_PROVIDER_LIMITS =
  "capacity_read_from_sender_identity_capacity_source_never_assumed";
export const _DELIVERABILITY_NEVER_EVADES_PROVIDER_LIMITS =
  "clause_8_preserved_no_rotation_to_bypass_a_single_sender_cap";
export const _DELIVERABILITY_REPUTATION_FROM_REAL_EVIDENCE =
  "rates_aggregated_from_marketing_send_log_marketing_bounce_log_never_synthetic";
