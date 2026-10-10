// src/lib/nex/marketing/auto/eligibility.ts
//
// NEX Managed Email Marketing · Stage 5 · Eligibility engine
// Founder-authorised programme (§4 · CRAWLER-DISCOVERED ≠ AUTOMATICALLY MARKETABLE).
//
// **Pure function**. Given a contact snapshot + jurisdictional rule set,
// returns a deterministic EligibilityDecision. Never mutates state.
// Never invents consent. Never bypasses a rule.

import type {
  ContactEligibilitySnapshot,
  ConsentBasis,
  ConsentRegime,
  EligibilityDecision,
  JurisdictionRule,
} from "./types";

// ─── Default jurisdictional rule set (founder-locked · additive · never inferred) ─
// Countries not in this map default to 'restricted' (no marketing permitted).
export const DEFAULT_JURISDICTION_RULES: ReadonlyMap<string, JurisdictionRule> = new Map([
  // United States · CAN-SPAM 2003 · opt-out framework
  ["US", { country: "US", regime: "opt_out_sufficient", permits_discovered: true, requires_source_reference: true, min_contact_confidence: 0.5, notes: "CAN-SPAM · commercial-email · clear unsubscribe + physical-address requirements · not treated as consent-based" }],
  ["CA", { country: "CA", regime: "opt_in_required", permits_discovered: false, requires_source_reference: true, min_contact_confidence: 0.7, notes: "Canada Anti-Spam Legislation (CASL) · express or implied consent required for commercial-electronic-messages" }],
  ["GB", { country: "GB", regime: "opt_in_required", permits_discovered: false, requires_source_reference: true, min_contact_confidence: 0.7, notes: "UK PECR + UK-GDPR · opt-in for individual subscribers · corporate subscribers may be soft-opt-in but require existing relationship" }],
  ["UK", { country: "UK", regime: "opt_in_required", permits_discovered: false, requires_source_reference: true, min_contact_confidence: 0.7, notes: "Alias for GB · same rules" }],
  ["DE", { country: "DE", regime: "opt_in_required", permits_discovered: false, requires_source_reference: true, min_contact_confidence: 0.75, notes: "GDPR + UWG · strict opt-in · consent must be documented" }],
  ["FR", { country: "FR", regime: "opt_in_required", permits_discovered: false, requires_source_reference: true, min_contact_confidence: 0.75, notes: "GDPR + LCEN · B2C opt-in · B2B may be soft-opt-in with business-context proof" }],
  ["ES", { country: "ES", regime: "opt_in_required", permits_discovered: false, requires_source_reference: true, min_contact_confidence: 0.7, notes: "GDPR + LSSI-CE" }],
  ["IT", { country: "IT", regime: "opt_in_required", permits_discovered: false, requires_source_reference: true, min_contact_confidence: 0.7, notes: "GDPR" }],
  ["NL", { country: "NL", regime: "opt_in_required", permits_discovered: false, requires_source_reference: true, min_contact_confidence: 0.7, notes: "GDPR" }],
  ["AU", { country: "AU", regime: "opt_in_required", permits_discovered: false, requires_source_reference: true, min_contact_confidence: 0.7, notes: "Australia Spam Act · opt-in with unsubscribe · similar to CASL" }],
  ["NZ", { country: "NZ", regime: "opt_in_required", permits_discovered: false, requires_source_reference: true, min_contact_confidence: 0.7, notes: "NZ Unsolicited Electronic Messages Act" }],
  ["ID", { country: "ID", regime: "professional_business", permits_discovered: true, requires_source_reference: true, min_contact_confidence: 0.5, notes: "Indonesia · PDP Law considerations · B2B outreach with clear commercial context often accepted" }],
]);

// ─── Public API ────────────────────────────────────────────────────
export interface EligibilityInput {
  readonly contact: ContactEligibilitySnapshot;
  /** Optional override of the default rule set. */
  readonly rules?: ReadonlyMap<string, JurisdictionRule>;
  /** Optional min confidence override from campaign policy. */
  readonly policy_min_confidence?: number;
}

/** Evaluate whether a single contact is eligible for AUTO marketing.
 *  **Pure**. Deterministic. Never modifies state. */
export function evaluateEligibility(input: EligibilityInput): EligibilityDecision {
  const c = input.contact;
  const rules = input.rules ?? DEFAULT_JURISDICTION_RULES;

  // ─── 1 · Suppression checks (unambiguous · highest priority) ───
  if (c.opt_out) {
    return { eligible: false, reason: "opt_out", detail: "contact.opt_out=true" };
  }
  if (c.hard_bounced) {
    return { eligible: false, reason: "hard_bounced", detail: "contact.hard_bounced=true" };
  }
  if (c.complaint_count > 0) {
    return { eligible: false, reason: "complaint_blocked", detail: `complaint_count=${c.complaint_count}` };
  }

  // ─── 2 · Country + rule lookup (unrecognised country = restricted) ─
  const country = (c.country ?? "").trim().toUpperCase();
  if (!country) {
    return { eligible: false, reason: "jurisdiction_restricted", detail: "contact has no country · cannot verify eligibility" };
  }
  const rule = rules.get(country);
  if (!rule) {
    return { eligible: false, reason: "jurisdiction_restricted", detail: `no jurisdictional rule for country '${country}' · default to restricted · add rule deliberately` };
  }
  if (rule.regime === "restricted") {
    return { eligible: false, reason: "jurisdiction_restricted", detail: `country=${country} regime=restricted · ${rule.notes}` };
  }

  // ─── 3 · Provenance check ─────────────────────────────────────
  if (rule.requires_source_reference && !c.source_reference) {
    return { eligible: false, reason: "no_provenance", detail: `country=${country} requires source_reference · contact has none` };
  }

  // ─── 4 · Contact confidence check ─────────────────────────────
  const confidence = c.contact_confidence ?? 0;
  const min_confidence = Math.max(rule.min_contact_confidence, input.policy_min_confidence ?? 0);
  if (confidence < min_confidence) {
    return { eligible: false, reason: "low_contact_confidence", detail: `country=${country} min=${min_confidence} · contact_confidence=${confidence.toFixed(2)}` };
  }

  // ─── 5 · Consent-basis check per jurisdictional regime ─────────
  const consent_basis = normalizeConsentBasis(c.consent_basis);
  const consent_ok = evaluateConsentBasis(consent_basis, rule);
  if (!consent_ok.ok) {
    return {
      eligible: false,
      reason: "insufficient_consent_basis",
      detail: `country=${country} regime=${rule.regime} consent_basis=${consent_basis} · ${consent_ok.detail}`,
    };
  }

  // ─── 6 · Passed all gates ─────────────────────────────────────
  return {
    eligible: true,
    reason: `country=${country} regime=${rule.regime} consent_basis=${consent_basis} confidence=${confidence.toFixed(2)}`,
    consent_basis_used: consent_basis,
  };
}

// ─── Internal helpers ──────────────────────────────────────────────
function normalizeConsentBasis(raw: string | null): ConsentBasis {
  if (!raw) return "unknown";
  const norm = raw.trim().toLowerCase();
  switch (norm) {
    case "explicit_opt_in":
    case "explicit-opt-in":
    case "double_opt_in":
      return "explicit_opt_in";
    case "implicit":
    case "implied":
    case "existing_relationship":
      return "implicit";
    case "discovered":
    case "crawler":
    case "harvested":
      return "discovered";
    default:
      return "unknown";
  }
}

function evaluateConsentBasis(basis: ConsentBasis, rule: JurisdictionRule): { ok: boolean; detail: string } {
  if (basis === "explicit_opt_in") return { ok: true, detail: "explicit consent · always sufficient" };
  if (basis === "unknown") return { ok: false, detail: "consent_basis unknown · cannot proceed" };

  if (rule.regime === "opt_in_required") {
    return { ok: false, detail: "regime requires opt_in · this basis is insufficient" };
  }
  if (rule.regime === "opt_out_sufficient" || rule.regime === "professional_business") {
    if (basis === "discovered" && !rule.permits_discovered) {
      return { ok: false, detail: "regime permits discovered but this rule.permits_discovered=false" };
    }
    return { ok: true, detail: "regime permits this basis · unsubscribe path enforced separately" };
  }
  return { ok: false, detail: "regime rejects this basis" };
}

/** Structural export-boundary marker · confirms this module has NO
 *  contact-address extraction/export function. Verified by tests. */
export const _AUTO_ELIGIBILITY_CONTACT_BOUNDARY = "counts_and_decisions_only";
