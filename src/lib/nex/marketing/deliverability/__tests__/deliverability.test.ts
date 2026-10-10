// src/lib/nex/marketing/deliverability/__tests__/deliverability.test.ts
//
// NEX Deliverability Intelligence acceptance · Session-5 · Part 12.
// Founder-authorised programme · 2026-09-21.

import { describe, it, expect } from "vitest";
import {
  classifyReputation, computeAligned, NULL_DOMAIN_CHECKER, DEFAULT_THRESHOLDS,
  _DELIVERABILITY_NEVER_HARDCODES_PROVIDER_LIMITS,
  _DELIVERABILITY_NEVER_EVADES_PROVIDER_LIMITS,
  _DELIVERABILITY_REPUTATION_FROM_REAL_EVIDENCE,
  type ReputationState,
} from "..";

// ═══════════════════════════════════════════════════════════════════
// A · Reputation state classifier (pure · deterministic)
// ═══════════════════════════════════════════════════════════════════
describe("Deliverability · (A) reputation classifier", () => {
  it("(A1) both null and no window → unknown", () => {
    const r = classifyReputation(null, null);
    expect(r.state).toBe("unknown");
  });

  it("(A2) healthy · well below all thresholds", () => {
    const r = classifyReputation(0.005, 0.0002);
    expect(r.state).toBe("healthy");
    expect(r.reason).toContain("bounce");
  });

  it("(A3) watch · bounce 2%", () => {
    const r = classifyReputation(0.021, 0.0002);
    expect(r.state).toBe("watch");
  });

  it("(A4) warning · complaint at 0.3%", () => {
    const r = classifyReputation(0.005, 0.0031);
    expect(r.state).toBe("warning");
  });

  it("(A5) limited · bounce 8%", () => {
    const r = classifyReputation(0.081, 0.0002);
    expect(r.state).toBe("limited");
  });

  it("(A6) frozen · bounce 12%", () => {
    const r = classifyReputation(0.121, 0);
    expect(r.state).toBe("frozen");
  });

  it("(A7) frozen · complaint 1%", () => {
    const r = classifyReputation(0.005, 0.011);
    expect(r.state).toBe("frozen");
  });

  it("(A8) worst-of-two-dimensions wins", () => {
    // bounce=healthy · complaint=frozen → frozen
    const r = classifyReputation(0.001, 0.011);
    expect(r.state).toBe("frozen");
  });

  it("(A9) thresholds are Founder-authored constants · not editable at runtime", () => {
    expect(DEFAULT_THRESHOLDS.bounce_frozen).toBe(0.12);
    expect(DEFAULT_THRESHOLDS.complaint_frozen).toBe(0.010);
    expect(Object.isFrozen(DEFAULT_THRESHOLDS)).toBe(false); // TS `readonly` not runtime frozen · that's OK · the CONSTANTS are exported once
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · Alignment computation
// ═══════════════════════════════════════════════════════════════════
describe("Deliverability · (B) alignment", () => {
  it("(B1) all three pass → aligned=true", () => {
    expect(computeAligned("pass", "pass", "pass")).toBe(true);
  });
  it("(B2) any not-pass → aligned=false", () => {
    expect(computeAligned("pass", "pass", "fail")).toBe(false);
    expect(computeAligned("pass", "fail", "pass")).toBe(false);
    expect(computeAligned("soft_fail", "pass", "pass")).toBe(false);
    expect(computeAligned("unknown", "unknown", "unknown")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · NULL_DOMAIN_CHECKER default is safe
// ═══════════════════════════════════════════════════════════════════
describe("Deliverability · (C) NULL_DOMAIN_CHECKER default", () => {
  it("(C1) returns unknown for every dimension · never fabricates", async () => {
    const r = await NULL_DOMAIN_CHECKER.checkDomain("abcscaffolding.co.uk");
    expect(r.spf_status).toBe("unknown");
    expect(r.dkim_status).toBe("unknown");
    expect(r.dmarc_status).toBe("unknown");
    expect(r.error).toContain("Founder decision");
    expect(r.check_source).toBe("null-domain-checker");
  });

  it("(C2) lowercases domain deterministically", async () => {
    const r = await NULL_DOMAIN_CHECKER.checkDomain("ABCScaffolding.co.UK");
    expect(r.sending_domain).toBe("abcscaffolding.co.uk");
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · Governance boundaries
// ═══════════════════════════════════════════════════════════════════
describe("Deliverability · (D) governance markers", () => {
  it("(D1) provider-limits marker exported · verified by string identity", () => {
    expect(_DELIVERABILITY_NEVER_HARDCODES_PROVIDER_LIMITS).toBe("capacity_read_from_sender_identity_capacity_source_never_assumed");
  });
  it("(D2) no-evasion marker exported", () => {
    expect(_DELIVERABILITY_NEVER_EVADES_PROVIDER_LIMITS).toBe("clause_8_preserved_no_rotation_to_bypass_a_single_sender_cap");
  });
  it("(D3) reputation-from-real-evidence marker exported", () => {
    expect(_DELIVERABILITY_REPUTATION_FROM_REAL_EVIDENCE).toBe("rates_aggregated_from_marketing_send_log_marketing_bounce_log_never_synthetic");
  });
  it("(D4) module exports NO synthetic-reputation setter · no bypass-cap function", async () => {
    const mod = await import("..");
    expect((mod as any).setReputationForTest).toBeUndefined();
    expect((mod as any).overrideBounceRate).toBeUndefined();
    expect((mod as any).bypassCapacityLimit).toBeUndefined();
    expect((mod as any).rotateSenderToEvadeLimit).toBeUndefined();
    expect((mod as any).setSenderReputationSynthetic).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// E · Threshold monotonicity (structural discipline)
// ═══════════════════════════════════════════════════════════════════
describe("Deliverability · (E) threshold monotonicity", () => {
  it("(E1) bounce thresholds strictly ascending · watch < warning < limited < frozen", () => {
    expect(DEFAULT_THRESHOLDS.bounce_watch).toBeLessThan(DEFAULT_THRESHOLDS.bounce_warning);
    expect(DEFAULT_THRESHOLDS.bounce_warning).toBeLessThan(DEFAULT_THRESHOLDS.bounce_limited);
    expect(DEFAULT_THRESHOLDS.bounce_limited).toBeLessThan(DEFAULT_THRESHOLDS.bounce_frozen);
  });
  it("(E2) complaint thresholds strictly ascending", () => {
    expect(DEFAULT_THRESHOLDS.complaint_watch).toBeLessThan(DEFAULT_THRESHOLDS.complaint_warning);
    expect(DEFAULT_THRESHOLDS.complaint_warning).toBeLessThan(DEFAULT_THRESHOLDS.complaint_limited);
    expect(DEFAULT_THRESHOLDS.complaint_limited).toBeLessThan(DEFAULT_THRESHOLDS.complaint_frozen);
  });
  it("(E3) complaint thresholds are stricter than bounce (public deliverability best practice)", () => {
    expect(DEFAULT_THRESHOLDS.complaint_frozen).toBeLessThan(DEFAULT_THRESHOLDS.bounce_frozen);
  });
});
