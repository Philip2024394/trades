// src/lib/nex/marketing/founder/types.ts
//
// NEX Managed Email Marketing · Founder Control Centre types
// Founder-authorised programme (three-lane operating doctrine · ADR-0003a).
//
// FOUNDER lane hard-locks (§2, §9, §26, §38, §39):
//   • FOUNDER senders come from lane='founder' AND member_id IS NULL
//   • FOUNDER campaigns carry metadata.lane='founder', origin='founder'
//   • FOUNDER sending NEVER consumes member packages
//   • FOUNDER accounting is founder-controlled (no per-recipient reservation in this wave · matches doctrine)
//   • Provider limits are hard constraints (Stage 2 Clause 8 preserved)
//   • Global unsubscribe re-checked at execution time
//   • No contact-address export

import type { AudienceQuery, AudienceCount, ContentBlock, CampaignPreview } from "../member/types";

// ─── Auth context ──────────────────────────────────────────────────
export interface FounderAuthContext {
  readonly authenticated: boolean;
  readonly actor: string;                          // e.g. 'founder' · 'admin:<id>'
  readonly source: "cookie" | "bearer" | "localhost" | "unauthenticated";
}

// ─── Founder campaign lifecycle (maps to existing marketing_campaign.status) ─
export type FounderCampaignStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

// ─── Send modes (§23) ──────────────────────────────────────────────
export type SendMode = "test_only" | "send_to_selected" | "auto_send";

// ─── Composer input ────────────────────────────────────────────────
export interface FounderCampaignInput {
  readonly display_name: string;
  readonly subject_line: string;
  readonly preheader?: string;
  readonly from_email: string;                     // MUST match one of the authorised FOUNDER senders
  readonly from_name?: string;
  readonly reply_to?: string;
  readonly content_blocks?: ReadonlyArray<ContentBlock>;
  readonly mjml_source?: string;
  readonly banner_image_url?: string;
  readonly cta_url?: string;
  readonly cta_label?: string;
  readonly footer_text?: string;                   // Founder sign-off (defaults to standard NEX footer if absent)
  readonly attachment_urls?: ReadonlyArray<string>;
  readonly audience: AudienceQuery;
  readonly sender_id: string;                      // FOUNDER-lane sender
  readonly scheduled_for?: string;
}

// ─── Founder campaign summary ──────────────────────────────────────
export interface FounderCampaignSummary {
  readonly campaign_id: string;
  readonly display_name: string;
  readonly status: FounderCampaignStatus;
  readonly sender_id: string | null;
  readonly target_count: number;
  readonly send_count: number;
  readonly fail_count: number;
  readonly opened_count: number;                   // observed opens
  readonly clicked_count: number;
  readonly bounced_count: number;
  readonly complained_count: number;
  readonly unsubscribed_count: number;
  readonly created_at: string;
  readonly proposed_at: string | null;
  readonly approved_at: string | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;
}

// ─── Sender view (Founder-safe · no credentials) ───────────────────
export interface FounderSenderView {
  readonly sender_id: string;
  readonly email: string;
  readonly display_name: string | null;
  readonly provider: string;
  readonly authentication_state: string;
  readonly verification_state: string;
  readonly health_state: string;
  readonly capacity: {
    readonly hourly_limit: number | null;
    readonly hourly_used: number;
    readonly hourly_remaining: number | null;
    readonly daily_limit: number | null;
    readonly daily_used: number;
    readonly daily_remaining: number | null;
    readonly effective_remaining: number | null;
  };
  readonly last_send_at: string | null;
  readonly is_sendable: boolean;
}

// ─── Review outcome ────────────────────────────────────────────────
export interface FounderReviewOutcome {
  readonly campaign_id: string;
  readonly display_name: string;
  readonly audience: AudienceQuery;
  readonly audience_count: AudienceCount;
  readonly sender: FounderSenderView;
  readonly send_ready: boolean;
  readonly refusal_reasons: ReadonlyArray<{
    readonly kind: "sender_unhealthy" | "sender_exhausted" | "audience_empty" | "sender_unverified" | "sender_lane_mismatch" | "policy_block" | "unsubscribe_footer_missing";
    readonly detail: string;
  }>;
  readonly reviewed_at: string;
}

// ─── Test-email input ──────────────────────────────────────────────
export interface TestEmailInput {
  readonly campaign_id: string;
  readonly test_recipient: string;                 // MUST be a real address · isolated · not added to contact db
}

export type TestEmailOutcome =
  | { kind: "test_sent"; provider_message_id: string; sender_email: string }
  | { kind: "test_refused"; reason: string };

// ─── System status (top-of-HQ readout) ─────────────────────────────
export interface HQSystemStatus {
  readonly ready: boolean;                         // true if all guards green
  readonly send_enabled: boolean;
  readonly primary_provider: string;               // e.g. 'resend'
  readonly configured_providers: ReadonlyArray<string>;
  readonly active_senders: number;
  readonly total_founder_senders: number;
  readonly pending_queue: number;
  readonly auto_state: "running" | "paused" | "not_configured";
  readonly compliance_ok: boolean;
  readonly last_activity_at: string | null;
  readonly backend_available: boolean;
}

// ─── Analytics (matches member shape · observed-open discipline) ───
export interface FounderCampaignAnalytics {
  readonly campaign_id: string;
  readonly display_name: string;
  readonly status: FounderCampaignStatus;
  readonly target_count: number;
  readonly send_count: number;
  readonly delivered: number;
  readonly observed_opens: number;                 // NEVER labelled "read"
  readonly clicks: number;
  readonly bounces: number;
  readonly complaints: number;
  readonly unsubscribes: number;
  readonly failures: number;
  readonly rates: {
    readonly delivery_rate: number;
    readonly observed_open_rate: number;
    readonly click_rate: number;
    readonly bounce_rate: number;
    readonly complaint_rate: number;
    readonly unsubscribe_rate: number;
  };
}

// ─── Preview (re-exported from member module for consistency) ──────
export type { CampaignPreview };

// ─── Errors ────────────────────────────────────────────────────────
export class FounderAccessError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "FounderAccessError";
  }
}
export class FounderLaneViolationError extends Error {
  constructor(detail: string) {
    super(`Founder lane violation · ${detail}`);
    this.name = "FounderLaneViolationError";
  }
}
export class FounderValidationError extends Error {
  constructor(public readonly reason: string, public readonly detail: string) {
    super(`${reason} · ${detail}`);
    this.name = "FounderValidationError";
  }
}

// ─── Global unsubscribe check result (§19) ─────────────────────────
export interface GlobalUnsubscribeCheck {
  readonly recipient: string;
  readonly is_suppressed: boolean;
  readonly reason: "opt_out" | "hard_bounced" | "unsubscribed" | "complaint" | "not_suppressed";
}
