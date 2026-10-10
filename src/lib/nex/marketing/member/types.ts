// src/lib/nex/marketing/member/types.ts
//
// NEX Managed Email Marketing · Stage 4 · Member-facing shared types
// Founder-authorised programme (three-lane operating doctrine · ADR-0003a).
//
// **Contact-boundary hard-lock** (ADR-0003a Clause 1): all types in this
// module refer to contacts by COUNT + opaque contact_id. Never by email
// address. No response type exposes a raw address to a member.

// ─── Member auth context ────────────────────────────────────────────
export interface MemberAuthContext {
  readonly member_id: string;
  readonly authenticated: boolean;
  readonly session_source: "cookie" | "bearer" | "unauthenticated";
}

// ─── Audience count · no addresses ─────────────────────────────────
export interface AudienceQuery {
  readonly country?: string;
  readonly category?: string;
  readonly language?: string;
}

export interface AudienceCount {
  readonly total_discovered: number;       // all contacts matching country+category BEFORE compliance
  readonly eligible: number;                // discovered - suppressed - opted-out - bounced
  readonly suppressed: number;              // opt_out or hard_bounced
  readonly not_eligible_reason: {
    readonly opt_out: number;
    readonly hard_bounced: number;
    readonly complaint: number;
  };
  readonly query: AudienceQuery;
  readonly computed_at: string;
}

// ─── Campaign lifecycle · maps to nex.marketing_campaign.status ────
// Founder Stage 4 direction: use existing states, don't silently redefine.
// Mapping from Stage 4 vocabulary → existing DB status:
//   DRAFT              → 'draft'
//   READY_FOR_REVIEW   → 'pending_approval'
//   SCHEDULED / QUEUED → 'approved' + scheduled_at column
//   SENDING            → 'sending'
//   SENT               → 'sent'
//   PARTIALLY_FAILED   → 'sent' with fail_count > 0
//   FAILED             → 'failed'
//   CANCELLED          → 'cancelled'
export type MemberCampaignStatus =
  | "draft"
  | "pending_approval"
  | "approved"           // scheduled/queued
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

// ─── Member campaign summary (returned by list/get) ────────────────
export interface MemberCampaignSummary {
  readonly campaign_id: string;
  readonly member_id: string;
  readonly package_id: string | null;
  readonly display_name: string;
  readonly status: MemberCampaignStatus;
  readonly target_count: number;
  readonly send_count: number;
  readonly fail_count: number;
  readonly opened_count: number;               // observed opens
  readonly clicked_count: number;
  readonly bounced_count: number;
  readonly complained_count: number;
  readonly scheduled_for: string | null;
  readonly proposed_at: string | null;
  readonly approved_at: string | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly created_at: string;
}

// ─── Composer input (member creates or updates a campaign) ─────────
export interface CampaignComposerInput {
  readonly display_name: string;
  readonly subject_line: string;
  readonly preheader?: string;
  readonly from_email: string;                 // MUST match one of member's authorised senders
  readonly from_name?: string;
  readonly reply_to?: string;
  readonly mjml_source?: string;               // optional · else use content_blocks
  readonly content_blocks?: ReadonlyArray<ContentBlock>;
  readonly banner_image_url?: string;
  readonly cta_url?: string;
  readonly cta_label?: string;
  readonly footer_text?: string;
  readonly audience: AudienceQuery;
  readonly package_id: string;
  readonly sender_id: string;
  readonly scheduled_for?: string;             // ISO · null = send-now on approval
}

// ─── Content block primitives (kept intentionally small) ───────────
export type ContentBlock =
  | { readonly kind: "heading"; readonly text: string; readonly level?: 1 | 2 | 3 }
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "image"; readonly url: string; readonly alt: string; readonly link?: string }
  | { readonly kind: "banner"; readonly url: string; readonly alt: string; readonly link?: string }
  | { readonly kind: "button"; readonly label: string; readonly url: string }
  | { readonly kind: "divider" }
  | { readonly kind: "video_thumbnail"; readonly thumbnail_url: string; readonly link: string; readonly alt: string };

// ─── Preview shape (returns compiled HTML + text · never addresses) ─
export interface CampaignPreview {
  readonly campaign_id: string;
  readonly subject: string;
  readonly preheader: string | null;
  readonly from: { readonly email: string; readonly name: string | null };
  readonly compiled_html: string;
  readonly text_fallback: string;
  readonly desktop_width_px: number;
  readonly mobile_width_px: number;
}

// ─── Review-before-send outcome ────────────────────────────────────
export interface ReviewOutcome {
  readonly campaign_id: string;
  readonly display_name: string;
  readonly audience: AudienceQuery;
  readonly audience_count: AudienceCount;
  readonly sender: {
    readonly sender_id: string;
    readonly email: string;
    readonly display_name: string | null;
    readonly provider: string;
    readonly health_state: string;
    readonly hourly_capacity: number | null;
    readonly hourly_remaining: number | null;
    readonly daily_capacity: number | null;
    readonly daily_remaining: number | null;
  };
  readonly package: {
    readonly package_id: string;
    readonly display_name: string | null;
    readonly package_type: string;
    readonly purchased: number;
    readonly reserved: number;
    readonly consumed: number;
    readonly remaining: number;
    readonly status: string;
  };
  readonly send_ready: boolean;                // package + sender both have capacity for eligible count
  readonly refusal_reasons: ReadonlyArray<{
    readonly kind: "package_exhausted" | "sender_exhausted" | "sender_unhealthy" | "audience_empty" | "compliance_block" | "package_not_active";
    readonly detail: string;
  }>;
  readonly reviewed_at: string;
}

// ─── Analytics view (member sees these) ────────────────────────────
export interface MemberCampaignAnalytics {
  readonly campaign_id: string;
  readonly display_name: string;
  readonly status: MemberCampaignStatus;
  readonly queued: number;
  readonly sent: number;
  readonly delivered: number;                  // provider-confirmed
  readonly observed_opens: number;             // NEVER labelled "read"
  readonly clicks: number;
  readonly bounces: number;
  readonly complaints: number;
  readonly unsubscribes: number;
  readonly failures: number;
  readonly last_event_at: string | null;
  readonly first_send_at: string | null;
  readonly rates: {
    readonly delivery_rate: number;            // delivered / sent
    readonly observed_open_rate: number;       // observed_opens / delivered  (labelled 'observed')
    readonly click_rate: number;               // clicks / delivered
    readonly bounce_rate: number;              // bounces / sent
    readonly complaint_rate: number;           // complaints / delivered
    readonly unsubscribe_rate: number;         // unsubscribes / delivered
  };
}

// ─── Errors (member-facing) ────────────────────────────────────────
export class MemberAccessError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "MemberAccessError";
  }
}
export class MemberIsolationError extends Error {
  constructor(resource: string) {
    super(`Member is not authorised for resource · ${resource}`);
    this.name = "MemberIsolationError";
  }
}
export class MemberValidationError extends Error {
  constructor(reason: string, public readonly detail: string) {
    super(`${reason} · ${detail}`);
    this.name = "MemberValidationError";
  }
}
