// NEX Audience Engine · shared types
//
// A Segment is a NAMED FILTER over the Contact Registry · never a
// materialised copy of contacts. Every campaign/newsletter/follow-up
// starts from a segment. The AudienceFilter shape covers 5 dimensions ·
// dimensions without data today are marked so the UI can show them as
// "planned" without lying about matching counts.
//
// Doctrine: constitution_nex_contact_intelligence_registry_2026_08_07.md

export type ContactSource = "trades" | "newsletter" | "crm" | "form" | "manual" | "csv" | "fs-store" | "api";

export type AudienceFilter = {
  // ── Location dimension ────────────────────────────────
  countries?: string[];                              // ISO 3166 alpha-2 OR display names ("United Kingdom")
  regions?: string[];                                // free-text OR city
  // ── Business dimension ────────────────────────────────
  trades?: string[];                                 // matches contact.trade_categories intersection
  // company_size / business_type · planned · no data today
  // ── Contact dimension ─────────────────────────────────
  consent_marketing?: boolean;                       // TRUE requires opt-in
  consent_transactional?: boolean;
  include_never_contact?: boolean;                   // default false · never include never-contact
  include_unsubscribed?: boolean;                    // default false
  sources?: ContactSource[];                         // rows must appear in contact_sources with one of these types
  last_contacted_before?: string;                    // ISO · e.g. inactive 90d = 90 days before now
  last_contacted_after?: string;
  first_seen_after?: string;                         // ISO · e.g. registered this month
  first_seen_before?: string;
  // ── Activity dimension ────────────────────────────────
  // opened_last_campaign · clicked · purchased · planned (Phase 7 tracking)
  // ── Identity dimension ────────────────────────────────
  has_crm_linkage?: boolean;                         // has a contact_sources row with source_type = "crm"
  // duplicate_status · confidence · AI interactions · planned
  // ── Free text ────────────────────────────────────────
  search?: string;                                   // matches name/company/email/tags
};

export type Segment = {
  segment_id: string;
  name: string;
  description: string | null;
  filter: AudienceFilter;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  used_count: number;
  last_used_at: string | null;
};

export type SegmentInput = {
  name: string;
  description?: string | null;
  filter: AudienceFilter;
  created_by?: string | null;
};

export type SuppressionBreakdown = {
  unsubscribed: number;
  never_contact: number;
  invalid_email: number;
  no_marketing_consent: number;
  total_suppressed: number;
};

export type AudiencePreview = {
  matching: number;                                  // all contacts matching non-compliance filter
  eligible_marketing: number;                        // matching AND passes marketing compliance
  eligible_transactional: number;                    // matching AND passes transactional compliance
  suppressed: SuppressionBreakdown;
  sample: Array<{
    contact_id: string;
    name: string | null;
    email: string | null;
    country: string | null;
    lifecycle_stage: string | null;
    consent_marketing: boolean | null;
    never_contact: boolean;
    unsubscribe_at: string | null;
  }>;
  filter_used: AudienceFilter;
  generated_at: string;
};
