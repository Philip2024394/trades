// NEX Campaign Builder · shared types
//
// A Campaign ORCHESTRATES a delivery. It references saved segments ·
// never stores a contact list. At send-time the Audience Engine
// performs a FRESH query so compliance is always current.
//
// Separation doctrine (Philip 2026-08-07):
//   Campaign Builder     orchestrates
//   Audience Engine      selects recipients
//   Contact Registry     canonical identities
//   Compliance Engine    eligibility
//   Email Runtime        delivery

export type CampaignType   = "marketing" | "transactional" | "announcement" | "newsletter";
export type CampaignStatus =
  | "draft" | "ready_for_review" | "approved" | "scheduled"
  | "sending" | "paused" | "completed" | "cancelled" | "archived";

export type SendStats = {
  attempted?: number;
  sent?: number;
  failed?: number;
  bounced?: number;
  opened?: number;
  clicked?: number;
  unsubscribed_via?: number;
};

export type CampaignPreviewCache = {
  matching: number;
  eligible_marketing: number;
  eligible_transactional: number;
  suppressed: { unsubscribed: number; never_contact: number; invalid_email: number; no_marketing_consent: number; total_suppressed: number };
  segments_used: string[];                     // segment_ids included in this aggregate
  warnings: string[];                           // e.g. "no segments attached", "invalid sender_from"
  estimated_send_seconds: number | null;        // rough estimate based on eligible count
  generated_at: string;
};

export type Campaign = {
  campaign_id: string;
  name: string;
  description: string | null;
  campaign_type: CampaignType;
  status: CampaignStatus;
  subject: string | null;
  preview_text: string | null;
  body_html: string | null;
  body_text: string | null;
  body_blocks: unknown[] | null;                // Composer source of truth · shape owned by src/lib/nex/composer/types.ts
  template_id: string | null;                    // origin template · NULL for from-scratch
  sender_name: string | null;
  sender_from: string | null;
  sender_reply_to: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_preview_at: string | null;
  last_preview: CampaignPreviewCache | null;
  send_stats: SendStats;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  segment_ids: string[];
};

export type CampaignInput = {
  name: string;
  description?: string | null;
  campaign_type?: CampaignType;
  subject?: string | null;
  preview_text?: string | null;
  body_html?: string | null;
  body_text?: string | null;
  body_blocks?: unknown[] | null;
  template_id?: string | null;
  sender_name?: string | null;
  sender_from?: string | null;
  sender_reply_to?: string | null;
  scheduled_at?: string | null;
  segment_ids?: string[];
  created_by?: string | null;
};

/**
 * Whitelisted transitions · single source of truth for the state machine.
 * Sending / completed transitions are triggered by the Delivery Engine
 * (Phase 4d) · admins can Pause · Cancel · Archive · Resume-to-Draft.
 */
export const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft:            ["ready_for_review", "archived"],
  ready_for_review: ["approved", "draft", "archived"],
  approved:         ["scheduled", "ready_for_review", "archived"],
  scheduled:        ["sending", "paused", "cancelled", "approved"],
  sending:          ["paused", "completed", "cancelled"],
  paused:           ["scheduled", "cancelled"],
  completed:        ["archived"],
  cancelled:        ["archived", "draft"],
  archived:         [],
};

export function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return CAMPAIGN_TRANSITIONS[from]?.includes(to) ?? false;
}
