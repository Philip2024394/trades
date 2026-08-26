// src/lib/nex-comms/types.ts
//
// Shared types for the NEX Communications Engine. Mirrors migration 095 enums.

export type CommsChannel =
  | "nex_in_app"
  | "nex_web"
  | "nex_inbox"
  | "email"
  | "push_notification"
  | "whatsapp"
  | "sms"
  | "voice_call";

export type CommsCategory =
  | "transactional"
  | "service"
  | "support"
  | "recruitment"
  | "marketing"
  | "verification"
  | "security"
  | "notification"
  | "booking"
  | "transport"
  | "business_enquiry";

export type CommsMessageStatus =
  | "queued"
  | "submitted"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "cancelled"
  | "unknown";

export type CommsSuppressionScope =
  | "all"
  | "marketing_only"
  | "recruitment_only"
  | "category_specific";

export type CommsSuppressionSource =
  | "recipient_stop_word"
  | "recipient_direct_request"
  | "admin_added"
  | "legal_requirement"
  | "bounce_or_invalid";

export type CommsPermissionBasis =
  | "contract_performance"
  | "transactional_response"
  | "explicit_opt_in"
  | "public_business_source"
  | "legal_obligation"
  | "legitimate_interest_documented"
  | "none";

export interface CommsContact {
  contactId: string;
  canonicalPhoneE164: string | null;
  email: string | null;
  inAppUserRef: string | null;
  displayName: string | null;
  jurisdiction: string | null;
  contactSource: string | null;
  contactSourceReference: string | null;
  firstSeenAt: Date;
  updatedAt: Date;
  provenance: Record<string, unknown>;
}

export interface CommsSuppressionRow {
  suppressionId: string;
  contactId: string;
  scope: CommsSuppressionScope;
  category: CommsCategory | null;
  source: CommsSuppressionSource;
  rawSignal: string | null;
  createdAt: Date;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  auditNote: string | null;
}

export interface CommsCampaign {
  campaignId: string;
  campaignKey: string;
  domain: string;
  category: CommsCategory;
  jurisdiction: string | null;
  dailyBudgetIdr: number | null;
  monthlyBudgetIdr: number | null;
  maxCostPerContactIdr: number | null;
  dailyMessageLimit: number | null;
  status: "draft" | "active" | "paused" | "completed" | "cancelled";
  createdBy: string;
  approvedBy: string | null;
  approvedAt: Date | null;
}

/**
 * The domain-neutral outbound message request. Composed by any NEX subsystem
 * that wants to communicate with a contact. The Communications Engine
 * evaluates it via permission + suppression + rate + budget + routing.
 */
export interface CommsSendRequest {
  idempotencyKey: string;             // deterministic per-attempt · e.g. `driver-recruitment:{candidate_id}:{campaign_id}`
  contact: CommsContact;
  templateId: string;
  templateKey: string;                // for logs · redundant with templateId
  templateVersion: string;
  category: CommsCategory;
  domain: string;                     // e.g. 'driver_recruitment' · 'booking' · 'transport'
  domainEntityRef?: string;
  correlationId?: string;
  permissionBasis: CommsPermissionBasis;
  campaign?: CommsCampaign;
  preferredChannels?: CommsChannel[]; // caller preference · router may still route to a lower tier
  cheaperChannelSwapAllowed?: boolean;// default true · engine may switch to a cheaper permitted channel
  content: {
    text?: string;
    mediaRef?: string;
    parameters?: Record<string, string | number | boolean>;
  };
  jurisdiction?: string;
}
