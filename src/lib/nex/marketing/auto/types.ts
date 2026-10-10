// src/lib/nex/marketing/auto/types.ts
//
// NEX Managed Email Marketing · Stage 5 · AUTO lane types
// Founder-authorised programme (three-lane operating doctrine · ADR-0003a).
//
// Founder-locked constants for the AUTO lane:
//   • AUTO uses shared executor (no second implementation)
//   • AUTO senders come from lane='auto', member_id IS NULL
//   • AUTO consumes NEX operating budget (NEVER member packages)
//   • Every AUTO campaign carries campaign.metadata.lane='auto', origin='auto'
//   • crawler-discovered ≠ marketing-eligible (see EligibilityDecision below)

// ─── Lane identifier (shared vocabulary with member/sender modules) ─
export const AUTO_LANE = "auto" as const;

// ─── Eligibility engine · pure decision output ─────────────────────
export type EligibilityDecision =
  | { eligible: true; reason: string; consent_basis_used: ConsentBasis }
  | { eligible: false; reason: EligibilityRefusalReason; detail: string };

export type ConsentBasis =
  | "explicit_opt_in"        // strongest · always eligible if not suppressed
  | "implicit"               // e.g. existing customer relationship in some jurisdictions
  | "discovered"             // crawler-only · lowest confidence · jurisdiction-specific
  | "unknown";

export type EligibilityRefusalReason =
  | "opt_out"
  | "hard_bounced"
  | "unsubscribed"
  | "complaint_blocked"
  | "invalid_address"
  | "insufficient_consent_basis"       // e.g. GDPR jurisdiction + discovered-only
  | "jurisdiction_restricted"          // country-specific rule refuses
  | "no_provenance"                    // discovered without source_reference
  | "low_contact_confidence"
  | "policy_block";                    // campaign policy refuses this contact

// ─── Contact eligibility snapshot (input to eligibility engine) ────
export interface ContactEligibilitySnapshot {
  readonly contact_id: string;
  readonly country: string | null;
  readonly language: string | null;
  readonly consent_basis: ConsentBasis | string | null;   // may be an existing DB value we don't recognise
  readonly opt_out: boolean;
  readonly hard_bounced: boolean;
  readonly complaint_count: number;
  readonly source_reference: string | null;
  readonly contact_confidence: number | null;             // 0..1
}

// ─── Jurisdictional eligibility profile (per-country) ──────────────
// Founder-locked: this table drives the eligibility engine · new countries
// added deliberately · never inferred. Applied via `eligibilityForCountry()`.
export type ConsentRegime =
  | "opt_in_required"          // GDPR-style · explicit_opt_in required for marketing
  | "opt_out_sufficient"       // CAN-SPAM-style · unsubscribe path suffices · but not for cold outreach in some interpretations
  | "professional_business"    // some jurisdictions permit B2B outreach with corporate address + provenance
  | "restricted";              // no marketing permitted (default when unrecognised)

export interface JurisdictionRule {
  readonly country: string;
  readonly regime: ConsentRegime;
  readonly permits_discovered: boolean;   // whether consent_basis='discovered' can proceed
  readonly requires_source_reference: boolean;
  readonly min_contact_confidence: number;
  readonly notes: string;
}

// ─── AUTO campaign policy (per campaign) ───────────────────────────
export interface AutoCampaignPolicy {
  readonly policy_id: string;
  readonly display_name: string;
  readonly country: string;                  // target country (jurisdictional rule applies)
  readonly category: string | null;
  readonly language: string | null;
  readonly min_contact_confidence: number;   // policy override
  readonly max_daily_sends: number;
  readonly budget_id: string;                // which operating budget
  readonly is_active: boolean;
}

// ─── Errors ─────────────────────────────────────────────────────────
export class AutoLaneIsolationError extends Error {
  constructor(reason: string) {
    super(`AUTO lane isolation violation · ${reason}`);
    this.name = "AutoLaneIsolationError";
  }
}
