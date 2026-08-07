// NEX Compliance Engine · types
//
// Doctrine (Philip 2026-08-08): the ONE gate that mutates contact
// compliance state. Analytics ingests events · engine decides policy ·
// registry stores the result. never_contact + unsubscribe_at remain
// as computed convenience fields for existing expansion queries.

export type ComplianceState =
  | "allowed"
  | "suppressed_soft"
  | "suppressed_hard"
  | "unsubscribed"
  | "complaint"
  | "manual_block";

export type ComplianceEventType =
  | "hard_bounce_received"
  | "soft_bounce_received"
  | "complaint_received"
  | "unsubscribed"
  | "suppressed_soft_threshold"
  | "manual_suppressed"
  | "reinstated"
  | "delivered_reset_soft_streak";

export type ComplianceSource =
  | "sendgrid_webhook" | "ses_webhook" | "mailgun_webhook" | "postmark_webhook" | "simulator"
  | "manual_admin" | "expansion_check";

export type ContactCompliance = {
  contact_id: string;
  email: string | null;
  name: string | null;
  compliance_state: ComplianceState;
  compliance_reason: string | null;
  compliance_source: ComplianceSource | null;
  compliance_updated_at: string | null;
  soft_bounce_count: number;
  soft_bounce_last_at: string | null;
  never_contact: boolean;
  unsubscribe_at: string | null;
  last_provider_message_id: string | null;
};

export type ComplianceAuditEvent = {
  event_id: string;
  contact_id: string;
  event_type: ComplianceEventType;
  old_state: ComplianceState | null;
  new_state: ComplianceState | null;
  reason: string | null;
  source: ComplianceSource;
  provider: string | null;
  provider_message_id: string | null;
  campaign_id: string | null;
  actor: string | null;
  analytics_event_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
