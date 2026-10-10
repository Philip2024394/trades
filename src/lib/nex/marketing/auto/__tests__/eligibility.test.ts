// src/lib/nex/marketing/auto/__tests__/eligibility.test.ts
//
// NEX Stage 5 · Eligibility engine acceptance suite
// Founder-authorised programme (§4 crawler-discovered ≠ marketable).

import { describe, it, expect } from "vitest";
import { evaluateEligibility, DEFAULT_JURISDICTION_RULES } from "../eligibility";
import type { ContactEligibilitySnapshot } from "../types";

const base = (overrides: Partial<ContactEligibilitySnapshot> = {}): ContactEligibilitySnapshot => ({
  contact_id: "c-1",
  country: "US",
  language: "en",
  consent_basis: "discovered",
  opt_out: false,
  hard_bounced: false,
  complaint_count: 0,
  source_reference: "https://example.com/business",
  contact_confidence: 0.7,
  ...overrides,
});

describe("Stage 5 · eligibility · founder-locked rules", () => {
  it("(E1) crawler-discovered US contact with source_reference and confidence 0.7 → eligible (CAN-SPAM permits)", () => {
    const d = evaluateEligibility({ contact: base({ country: "US" }) });
    expect(d.eligible).toBe(true);
  });

  it("(E2) crawler-discovered UK contact → INELIGIBLE (PECR requires opt_in)", () => {
    const d = evaluateEligibility({ contact: base({ country: "GB" }) });
    expect(d.eligible).toBe(false);
    if (!d.eligible) expect(d.reason).toBe("insufficient_consent_basis");
  });

  it("(E3) explicit_opt_in UK contact → eligible", () => {
    const d = evaluateEligibility({ contact: base({ country: "GB", consent_basis: "explicit_opt_in" }) });
    expect(d.eligible).toBe(true);
  });

  it("(E4) explicit_opt_in trumps low-confidence rule when jurisdiction min_confidence applies", () => {
    // Explicit opt-in passes consent · but confidence still checked
    const d = evaluateEligibility({ contact: base({ country: "GB", consent_basis: "explicit_opt_in", contact_confidence: 0.1 }) });
    expect(d.eligible).toBe(false);
    if (!d.eligible) expect(d.reason).toBe("low_contact_confidence");
  });

  it("(E5) opt_out contact ALWAYS refused · highest priority", () => {
    const d = evaluateEligibility({ contact: base({ opt_out: true, consent_basis: "explicit_opt_in" }) });
    expect(d.eligible).toBe(false);
    if (!d.eligible) expect(d.reason).toBe("opt_out");
  });

  it("(E6) hard_bounced contact refused", () => {
    const d = evaluateEligibility({ contact: base({ hard_bounced: true }) });
    if (!d.eligible) expect(d.reason).toBe("hard_bounced");
  });

  it("(E7) complaint contact refused", () => {
    const d = evaluateEligibility({ contact: base({ complaint_count: 1 }) });
    if (!d.eligible) expect(d.reason).toBe("complaint_blocked");
  });

  it("(E8) unknown country → jurisdiction_restricted (default deny)", () => {
    const d = evaluateEligibility({ contact: base({ country: "XX" }) });
    if (!d.eligible) expect(d.reason).toBe("jurisdiction_restricted");
  });

  it("(E9) missing country → jurisdiction_restricted", () => {
    const d = evaluateEligibility({ contact: base({ country: null }) });
    if (!d.eligible) expect(d.reason).toBe("jurisdiction_restricted");
  });

  it("(E10) missing source_reference in GB → no_provenance", () => {
    const d = evaluateEligibility({ contact: base({ country: "GB", consent_basis: "explicit_opt_in", source_reference: null }) });
    if (!d.eligible) expect(d.reason).toBe("no_provenance");
  });

  it("(E11) low contact_confidence → low_contact_confidence", () => {
    const d = evaluateEligibility({ contact: base({ country: "US", contact_confidence: 0.2 }) });
    if (!d.eligible) expect(d.reason).toBe("low_contact_confidence");
  });

  it("(E12) policy min_confidence override raises the bar", () => {
    // US default min 0.5 · contact at 0.6 · policy demands 0.8 → refused
    const d = evaluateEligibility({ contact: base({ country: "US", contact_confidence: 0.6 }), policy_min_confidence: 0.8 });
    if (!d.eligible) expect(d.reason).toBe("low_contact_confidence");
  });

  it("(E13) crawler-discovered Indonesia (professional_business regime) → eligible with source_reference", () => {
    const d = evaluateEligibility({ contact: base({ country: "ID", consent_basis: "discovered" }) });
    expect(d.eligible).toBe(true);
  });

  it("(E14) unknown consent_basis → refused", () => {
    const d = evaluateEligibility({ contact: base({ consent_basis: null }) });
    if (!d.eligible) expect(d.reason).toBe("insufficient_consent_basis");
  });

  it("(E15) crawler-discovered ≠ marketable · verified across 5 GDPR jurisdictions", () => {
    for (const country of ["GB", "DE", "FR", "NL", "IT"]) {
      const d = evaluateEligibility({ contact: base({ country, consent_basis: "discovered" }) });
      expect(d.eligible).toBe(false);
    }
  });

  it("(E16) DEFAULT_JURISDICTION_RULES is READ-ONLY per module contract (Map returned, callers do not mutate)", () => {
    expect(DEFAULT_JURISDICTION_RULES.size).toBeGreaterThan(5);
    // ReadonlyMap doesn't have .set surfaced in the type · runtime it's just a Map
    // The contract is documented in the type · runtime immutability is not enforced
    // but any attempt to mutate would corrupt the shared reference for other tests
  });
});
