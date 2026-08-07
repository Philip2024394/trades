// NEX Contact Intelligence · shared types
//
// One person = one canonical contact record. Sources are relationships to
// the record. Merges preserve history. Duplicates get flagged, never
// silently coalesced.
//
// Doctrine: constitution_nex_contact_intelligence_registry_2026_08_07.md

export type LifecycleStage =
  | "lead"
  | "prospect"
  | "customer"
  | "supplier"
  | "trade"
  | "merchant"
  | "partner"
  | "archived";

export type ConsentValue = boolean | null;               // TRUE = granted · FALSE = refused · NULL = unknown / not-asked

export type PreferredChannel = "email" | "whatsapp" | "sms" | "phone" | "in_app";

/**
 * Canonical contact record. Every field maps to a column on nex.contacts
 * (or to a supporting table for arrays / history).
 *
 * Snapshot-based: every write appends a new snapshot · `latestPerKey`
 * returns the current identity per contact_id.
 */
export type Contact = {
  contact_id: string;
  // Identity
  name: string | null;
  company: string | null;
  email: string | null;                                  // primary email · canonical_email is normalized
  canonical_email: string | null;
  phone: string | null;                                  // primary phone · canonical_phone is normalized
  canonical_phone: string | null;
  country: string | null;                                // ISO 3166 alpha-2
  region: string | null;
  languages: string[];                                   // BCP-47 tags e.g. ["en", "en-GB"]
  trade_categories: string[];
  tags: string[];
  // State
  kind: string | null;                                    // legacy · superseded by lifecycle_stage
  lifecycle_stage: LifecycleStage | string | null;
  attributes: Record<string, unknown>;                   // free-form for customer/supplier/merchant status etc.
  // Consent (legal spine)
  consent_marketing: ConsentValue;
  consent_transactional: ConsentValue;
  consent_source: string | null;
  never_contact: boolean;
  unsubscribe_at: string | null;
  // Preferences
  preferred_channels: PreferredChannel[];
  // Timestamps
  first_seen_at: string | null;
  last_seen_at: string | null;
  last_contacted_at: string | null;
  updated_at: string;
  // Tenancy
  business_id: string | null;
  linked_business_id: string | null;
  // Legacy single-source shorthand · use ContactSource[] for full history
  source: string | null;
  source_ref: string | null;
  // GDPR
  deleted_at: string | null;
};

/**
 * Append-only source row. A contact seen in three sources over two years
 * has three source rows. Never overwritten.
 */
export type ContactSource = {
  source_row_id: string;
  contact_id: string;
  source_type: string;                                   // "trades" · "newsletter" · "crm" · "form" · "manual" · "csv" · "api"
  source_ref: string | null;
  source_metadata: Record<string, unknown>;
  observed_at: string;
  business_id: string | null;
};

/**
 * Merge audit row. `absorbed_contact_id` gets aliased into
 * `surviving_contact_id` from `decided_at`.
 */
export type ContactMerge = {
  merge_id: string;
  surviving_contact_id: string;
  absorbed_contact_id: string;
  decided_by: string | null;
  decided_at: string;
  rationale: string | null;
  match_signals: Record<string, unknown>;
  reversed_at: string | null;
  reversed_by: string | null;
};

/**
 * Dedup queue row. Detected pairs awaiting admin decision.
 * Auto-merge is never permitted.
 */
export type ContactDuplicateSuggestion = {
  suggestion_id: string;
  contact_a: string;
  contact_b: string;
  match_kind: "email_exact" | "phone_exact" | "name_company_fuzzy";
  confidence: number;                                     // 0..100
  detected_at: string;
  decided_at: string | null;
  decided_by: string | null;
  decision: "merge" | "keep_separate" | "pending" | null;
  merge_id: string | null;
};

/**
 * Aggregate overview for the Mission Control panel.
 * Every counter is derived from real registry queries.
 */
export type ContactOverview = {
  total_contacts: number;                                 // canonical rows (latest per contact_id · deleted excluded)
  by_source: Array<{ source_type: string; count: number }>;
  by_country: Array<{ country: string; count: number }>;
  by_lifecycle: Array<{ lifecycle_stage: string; count: number }>;
  by_consent: {
    marketing_yes: number; marketing_no: number; marketing_unknown: number;
    transactional_yes: number; transactional_no: number; transactional_unknown: number;
    never_contact: number;
    unsubscribed: number;
  };
  top_tags: Array<{ tag: string; count: number }>;
  duplicates_pending: number;
  merges_all_time: number;
  recently_added: Array<{ contact_id: string; name: string | null; email: string | null; source: string | null; first_seen_at: string | null }>;
  recently_contacted: Array<{ contact_id: string; name: string | null; email: string | null; last_contacted_at: string | null }>;
  growth: Array<{ day: string; added: number }>;         // last 30 days
  generated_at: string;
};

/** Input shape for `registry.upsert(...)`. Every source-importer builds one of these. */
export type ContactUpsertInput = {
  // At least one of email · phone is required.
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  company?: string | null;
  country?: string | null;
  region?: string | null;
  languages?: string[];
  trade_categories?: string[];
  tags?: string[];
  lifecycle_stage?: LifecycleStage | string | null;
  attributes?: Record<string, unknown>;
  consent_marketing?: ConsentValue;
  consent_transactional?: ConsentValue;
  consent_source?: string | null;
  never_contact?: boolean;
  unsubscribe_at?: string | null;
  preferred_channels?: PreferredChannel[];
  business_id?: string | null;
  linked_business_id?: string | null;
  // Source that produced this upsert · required · gets an append-only row in nex.contact_sources
  source: {
    type: string;                                         // "trades" · "newsletter" · "crm" · "form" · "manual" · "csv" · "api"
    ref?: string | null;
    metadata?: Record<string, unknown>;
  };
};

export type UpsertResult = {
  contact_id: string;
  created: boolean;                                        // true = new canonical row · false = merged into existing
  matched_by?: "email" | "phone";
};
