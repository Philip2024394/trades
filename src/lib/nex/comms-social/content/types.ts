// NEX Comms Centre · Social · Phase 2 content types.
//
// Charter §S-III: content grounding. Every generated post has a
// deterministic provenance trace back to merchant-authorised source
// data, or it does not autopublish.

import type { TenantId } from "../types";

// ── Source kinds ───────────────────────────────────────────────
export const CONTENT_SOURCE_KINDS = [
  "business_profile",
  "project",
  "product",
  "service",
  "offer",
  "testimonial",
  "faq",
  "company_milestone",
  "review_aggregate",
  "certification",
  "award",
  "press_mention",
  "service_area",
] as const;
export type ContentSourceKind = typeof CONTENT_SOURCE_KINDS[number];

// Charter §S-IV rights taxonomy.
export const RIGHTS_STATUSES = [
  "owned",
  "uploaded_by_customer_attested",
  "licensed_with_expiry",
  "nex_owned_evergreen",
  "nex_owned_licensed_with_expiry",
  "approved_nex_asset",
  "ai_generated_provenance_pending",
  "unknown",
  "restricted",
] as const;
export type RightsStatus = typeof RIGHTS_STATUSES[number];

// Only these rights statuses are visible to autopublish.
export const AUTOPUBLISH_ELIGIBLE_RIGHTS: readonly RightsStatus[] = [
  "owned",
  "uploaded_by_customer_attested",
  "nex_owned_evergreen",
  "approved_nex_asset",
  "licensed_with_expiry",             // caller must additionally check expires_at
  "nex_owned_licensed_with_expiry",   // caller must additionally check expires_at
];

export interface ContentSource {
  source_id:                      string;
  tenant_id:                      TenantId;
  kind:                           ContentSourceKind;
  slug:                           string | null;
  content:                        Record<string, unknown>;
  rights_status:                  RightsStatus;
  contains_identifiable_persons:  boolean;
  person_release_evidence_url:    string | null;
  attested_by:                    string | null;
  attested_at:                    string | null;
  expires_at:                     string | null;
  active:                         boolean;
  created_at:                     string;
  updated_at:                     string;
}

// ── Template + generation ─────────────────────────────────────
export const TEMPLATE_KINDS = [
  "project","educational","inspiration","product","faq",
  "before_after","testimonial","seasonal","company","offer",
] as const;
export type TemplateKind = typeof TEMPLATE_KINDS[number];

// A template variable slot binds a variable name to a source location.
// The generator populates the variable ONLY from an active + rights-
// eligible source of the declared kind. Missing source → template fails.
export interface TemplateVariableSlot {
  name:          string;               // variable identifier used in body via {{name}}
  source_kind:   ContentSourceKind;
  source_path:   string;               // dotted path into source.content JSONB · e.g. "trade_name" or "location.city"
  required:      boolean;
  claim_class:   ClaimClass;           // pre-declared class for the resulting claim (see Charter §S-III taxonomy)
}

export interface TemplateHashtagSlot {
  tag:           string;               // must be in the whitelist file OR be a plain factual tag matching a source value
  claim_class?:  ClaimClass;
}

export interface TemplateCTASlot {
  template:     string;                // e.g. "Contact {{business.name}} for a quote."
  source_kind?: ContentSourceKind;
  source_path?: string;
}

export interface ContentTemplate {
  template_id:      string;
  tenant_id:        TenantId | null;   // NULL = Nex-owned global
  slug:             string;
  kind:             TemplateKind;
  body:             string;
  variable_slots:   TemplateVariableSlot[];
  hashtags_slots:   TemplateHashtagSlot[];
  cta_slot:         TemplateCTASlot | null;
  min_source_refs:  number;
  status:           "draft" | "active" | "retired";
  created_at:       string;
  updated_at:       string;
}

// ── Claim taxonomy (Charter §S-III) ───────────────────────────
export const CLAIM_CLASSES = [
  "factual",                  // must resolve exactly to tenant-data field
  "subjective_descriptor",    // only from per-brand whitelist
  "implicit_qualification",   // treated as factual · needs credential grounding
  "social_proof",             // needs verified record
  "urgency_scarcity",         // needs active offer_record
  "comparative",              // FORBIDDEN without written merchant approval + evidence
] as const;
export type ClaimClass = typeof CLAIM_CLASSES[number];

export interface ExtractedClaim {
  text:           string;              // the offending phrase from the caption
  class:          ClaimClass;
  grounded:       boolean;
  source_ref:     string | null;       // source_id if grounded
  reason:         string | null;
  enforcement:    "hard_block" | "review_required" | "ok";
}

// ── Draft + provenance ────────────────────────────────────────
export type GenerationMode = "template_fill" | "llm_composed";
export type GroundingState = "pending" | "grounded" | "rejected";

// Provenance maps each populated variable back to the source that
// produced it. This is the audit trail Philip named as "why did Nex
// think that?" for social. Required per S-III + S-VIII.
export interface ProvenanceEntry {
  variable:     string;
  source_id:    string;
  source_kind:  ContentSourceKind;
  source_path:  string;
  value:        string;
}

export interface RejectionReason {
  code:              string;
  detail:            string;
  offending_claim?:  string;
  variable?:         string;
}

export interface ContentDraft {
  draft_id:            string;
  tenant_id:           TenantId;
  template_id:         string | null;
  generation_mode:    GenerationMode;
  platform:            string;
  caption:             string;
  hashtags:            string[];
  cta:                 string | null;
  source_refs:         string[];
  claims:              ExtractedClaim[];
  provenance:          Record<string, ProvenanceEntry>;
  grounding_state:     GroundingState;
  rejection_reasons:   RejectionReason[];
  created_by:          string;
  created_at:          string;
  updated_at:          string;
}
