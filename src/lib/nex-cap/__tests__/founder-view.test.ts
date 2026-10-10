// WO-CAP-FOUNDER-VIEW-01 · classifier + recommendation adversarial tests.
//
// Founder-locked 2026-09-13. Assertions:
//   - Test-namespace CAPs never appear as REAL_RISK
//   - Security-escalate-only kinds always tag SECURITY_ESCALATION
//   - Deterministic recommendation (same input → same output)
//   - No hardcoded CAP IDs
//   - RESOLVED reflects underlying registry, never fabricated

import { describe, it, expect } from "vitest";
import type { CapabilityGap } from "../types";
import {
  classifyForFounder,
  isTestNamespaceCap,
  SECURITY_ESCALATE_ONLY_KINDS,
  summariseForFounder,
  recommendNextAction,
} from "../founder-view";

// Fixture uses a non-test-triggering title + non-test kind by default so
// tests can INDIVIDUALLY set the fields under test. Setting the kind
// or title is what determines TEST_EVENT tag, not the fixture itself.
function baseCap(overrides: Partial<CapabilityGap>): CapabilityGap {
  return {
    record_type: "NEX_CAPABILITY_GAP",
    cap_id: `CAP-FIXTURE-${Math.random().toString(36).slice(2, 10)}`,
    kind: "attractions.classification_vocabulary_insufficient",
    category: "INTELLIGENCE", priority: "MEDIUM",
    status: "OPEN",
    resolver_outcome: null,
    title: "fixture · genuine production CAP",
    proposed_wo_id: null,
    resolution_note: null,
    evidence: [],
    detected_at: "2026-09-01T00:00:00.000Z",
    last_updated_at: "2026-09-01T00:00:00.000Z",
    detector_agent_id: "adr-0320-bootstrap-seed",
    provenance_chain_hash: "hash",
    ...overrides,
  } as CapabilityGap;
}

describe("WO-CAP-FOUNDER-VIEW-01 · classifier", () => {
  it("C-1 · RESOLVED status → RESOLVED regardless of kind", () => {
    const c = baseCap({ kind: "attractions.classification_vocabulary_insufficient", status: "RESOLVED" });
    expect(classifyForFounder(c)).toBe("RESOLVED");
  });

  it("C-2 · test-namespace kind → TEST_EVENT even if priority=CRITICAL", () => {
    const c = baseCap({ kind: "test.exec.attack", priority: "CRITICAL", status: "OPEN" });
    expect(classifyForFounder(c)).toBe("TEST_EVENT");
  });

  it("C-3 · test.wo02.* kind → TEST_EVENT", () => {
    const c = baseCap({ kind: "test.wo02.a2", priority: "HIGH", status: "OPEN" });
    expect(classifyForFounder(c)).toBe("TEST_EVENT");
  });

  it("C-4 · detector_agent_id starting with 'test-' → TEST_EVENT", () => {
    const c = baseCap({ kind: "attractions.classification_vocabulary_insufficient", detector_agent_id: "test-harness-1" });
    expect(classifyForFounder(c)).toBe("TEST_EVENT");
  });

  it("C-5 · security-escalate-only kind (registry_untrusted) → SECURITY_ESCALATION even at LOW priority", () => {
    const c = baseCap({ kind: "guardian.te.evidence_source_registry_untrusted", priority: "LOW", status: "OPEN" });
    expect(classifyForFounder(c)).toBe("SECURITY_ESCALATION");
  });

  it("C-6 · security-escalate-only kind (test_masquerade) → SECURITY_ESCALATION", () => {
    const c = baseCap({ kind: "guardian.te.evidence_source_test_masquerade", priority: "MEDIUM", status: "OPEN" });
    expect(classifyForFounder(c)).toBe("SECURITY_ESCALATION");
  });

  it("C-7 · status=ESCALATED → SECURITY_ESCALATION regardless of kind", () => {
    const c = baseCap({ kind: "some.other.kind", status: "ESCALATED", priority: "HIGH" });
    expect(classifyForFounder(c)).toBe("SECURITY_ESCALATION");
  });

  it("C-8 · status=PROPOSED → WAITING_FOUNDER", () => {
    const c = baseCap({ kind: "transport.stranded_verified_no_promotion_executor", status: "PROPOSED", priority: "HIGH" });
    expect(classifyForFounder(c)).toBe("WAITING_FOUNDER");
  });

  it("C-9 · status=IN_PROGRESS → WAITING_FOUNDER", () => {
    const c = baseCap({ kind: "commerce.crawler_absent_sellers_unclaimed", status: "IN_PROGRESS", priority: "MEDIUM" });
    expect(classifyForFounder(c)).toBe("WAITING_FOUNDER");
  });

  it("C-10 · status=OPEN + genuine kind → NEX1_ACTIONABLE", () => {
    const c = baseCap({ kind: "attractions.classification_vocabulary_insufficient", status: "OPEN", priority: "HIGH" });
    expect(classifyForFounder(c)).toBe("NEX1_ACTIONABLE");
  });

  it("C-11 · status=TRIAGED + genuine kind → NEX1_ACTIONABLE", () => {
    const c = baseCap({ kind: "truth_engine.absent", status: "TRIAGED", priority: "HIGH" });
    expect(classifyForFounder(c)).toBe("NEX1_ACTIONABLE");
  });

  it("C-12 · classifier is pure · same input → same output", () => {
    const c = baseCap({ kind: "transport.stranded_verified_no_promotion_executor", status: "OPEN", priority: "HIGH" });
    expect(classifyForFounder(c)).toBe(classifyForFounder(c));
  });

  it("C-13 · isTestNamespaceCap · production seeded CAP is NOT test", () => {
    const c = baseCap({
      kind: "attractions.classification_vocabulary_insufficient",
      detector_agent_id: "adr-0320-bootstrap-seed",
      title: "Attractions classification loses 88% diversity",
    });
    expect(isTestNamespaceCap(c)).toBe(false);
    expect(classifyForFounder(c)).toBe("NEX1_ACTIONABLE");
  });

  it("C-14 · SECURITY_ESCALATE_ONLY_KINDS set matches doctrinal fixture", () => {
    expect(SECURITY_ESCALATE_ONLY_KINDS.has("guardian.te.evidence_source_registry_untrusted")).toBe(true);
    expect(SECURITY_ESCALATE_ONLY_KINDS.has("guardian.te.evidence_source_test_masquerade")).toBe(true);
    expect(SECURITY_ESCALATE_ONLY_KINDS.has("attractions.classification_vocabulary_insufficient")).toBe(false);
  });
});

describe("WO-CAP-FOUNDER-VIEW-01 · summary counts", () => {
  it("S-1 · counts derive from live CAP set · no hardcoded totals", () => {
    const caps = [
      baseCap({ kind: "attractions.classification_vocabulary_insufficient", priority: "HIGH", status: "OPEN" }),
      baseCap({ kind: "transport.stranded_verified_no_promotion_executor", priority: "HIGH", status: "OPEN" }),
      baseCap({ kind: "truth_engine.absent", priority: "HIGH", status: "OPEN" }),
      baseCap({ kind: "test.attack.x1", priority: "CRITICAL", status: "OPEN" }),      // TEST_EVENT
      baseCap({ kind: "guardian.te.evidence_source_registry_untrusted", priority: "LOW", status: "OPEN" }),  // SECURITY_ESCALATION
      baseCap({ kind: "some.other.kind", priority: "HIGH", status: "PROPOSED" }),     // WAITING_FOUNDER
      baseCap({ kind: "another.kind", priority: "MEDIUM", status: "RESOLVED" }),      // RESOLVED
    ];
    const s = summariseForFounder(caps);
    expect(s.total).toBe(7);
    expect(s.critical_actions).toBe(0);  // the CRITICAL is a TEST_EVENT · not counted
    expect(s.high_priority).toBe(3);     // three HIGH NEX1_ACTIONABLE
    expect(s.waiting_for_founder).toBe(1);
    expect(s.security_escalations).toBe(1);
    expect(s.test_events).toBe(1);
    expect(s.resolved).toBe(1);
    expect(s.nex1_actionable).toBe(3);
  });

  it("S-2 · empty registry → all zero", () => {
    const s = summariseForFounder([]);
    expect(s).toEqual({
      total: 0, critical_actions: 0, high_priority: 0, waiting_for_founder: 0,
      security_escalations: 0, nex1_actionable: 0, test_events: 0, resolved: 0,
    });
  });
});

describe("WO-CAP-FOUNDER-VIEW-01 · recommended next action (deterministic)", () => {
  it("R-1 · CRITICAL security escalation wins over everything else", () => {
    const caps = [
      baseCap({ kind: "attractions.classification_vocabulary_insufficient", priority: "HIGH", status: "OPEN" }),
      baseCap({ kind: "guardian.te.evidence_source_registry_untrusted", priority: "CRITICAL", status: "OPEN" }),
      baseCap({ kind: "transport.stranded_verified_no_promotion_executor", priority: "HIGH", status: "PROPOSED" }),
    ];
    const r = recommendNextAction(caps);
    expect(r.kind).toBe("FOUNDER_REVIEW");
    expect(r.cap_kind).toBe("guardian.te.evidence_source_registry_untrusted");
    expect(r.rationale).toMatch(/CRITICAL security escalation/);
  });

  it("R-2 · WAITING_FOUNDER wins over NEX1_ACTIONABLE at same priority", () => {
    const caps = [
      baseCap({ kind: "a.kind", priority: "HIGH", status: "OPEN",
        detected_at: "2026-09-01T00:00:00.000Z" }),
      baseCap({ kind: "b.kind", priority: "HIGH", status: "PROPOSED",
        detected_at: "2026-09-05T00:00:00.000Z" }),
    ];
    const r = recommendNextAction(caps);
    expect(r.kind).toBe("AWAIT_FOUNDER_SIGNATURE");
    expect(r.cap_kind).toBe("b.kind");
  });

  it("R-3 · highest-priority NEX1_ACTIONABLE wins when nothing else pending", () => {
    const caps = [
      baseCap({ kind: "a.kind", priority: "MEDIUM", status: "OPEN",
        detected_at: "2026-09-01T00:00:00.000Z" }),
      baseCap({ kind: "b.kind", priority: "HIGH", status: "OPEN",
        detected_at: "2026-09-05T00:00:00.000Z" }),
      baseCap({ kind: "c.kind", priority: "LOW", status: "OPEN",
        detected_at: "2026-09-03T00:00:00.000Z" }),
    ];
    const r = recommendNextAction(caps);
    expect(r.kind).toBe("NEX1_DIAGNOSE");
    expect(r.cap_priority).toBe("HIGH");
    expect(r.cap_kind).toBe("b.kind");
  });

  it("R-4 · tie broken by oldest detected_at", () => {
    const caps = [
      baseCap({ kind: "younger.kind", priority: "HIGH", status: "OPEN",
        detected_at: "2026-09-10T00:00:00.000Z" }),
      baseCap({ kind: "older.kind", priority: "HIGH", status: "OPEN",
        detected_at: "2026-09-05T00:00:00.000Z" }),
    ];
    const r = recommendNextAction(caps);
    expect(r.cap_kind).toBe("older.kind");
  });

  it("R-5 · TEST_EVENT CAPs are NEVER recommended even if CRITICAL", () => {
    const caps = [
      baseCap({ kind: "test.wo02.registry-tamper", priority: "CRITICAL", status: "OPEN" }),
      baseCap({ kind: "some.real.kind", priority: "LOW", status: "OPEN",
        detected_at: "2026-09-01T00:00:00.000Z" }),
    ];
    const r = recommendNextAction(caps);
    // The CRITICAL test event must be ignored; the LOW real CAP surfaces
    expect(r.cap_kind).toBe("some.real.kind");
    expect(r.kind).toBe("NEX1_DIAGNOSE");
  });

  it("R-6 · RESOLVED CAPs are never recommended", () => {
    const caps = [
      baseCap({ kind: "already.resolved", priority: "CRITICAL", status: "RESOLVED" }),
    ];
    const r = recommendNextAction(caps);
    expect(r.kind).toBe("NONE");
    expect(r.cap_id).toBeNull();
  });

  it("R-7 · empty registry → NONE", () => {
    const r = recommendNextAction([]);
    expect(r.kind).toBe("NONE");
  });

  it("R-8 · deterministic · same input → same output across runs", () => {
    const caps = [
      baseCap({ kind: "a.kind", priority: "HIGH", status: "OPEN",
        detected_at: "2026-09-01T00:00:00.000Z" }),
      baseCap({ kind: "b.kind", priority: "MEDIUM", status: "OPEN",
        detected_at: "2026-09-02T00:00:00.000Z" }),
    ];
    const r1 = recommendNextAction(caps);
    const r2 = recommendNextAction(caps);
    expect(r1.cap_kind).toBe(r2.cap_kind);
    expect(r1.kind).toBe(r2.kind);
    expect(r1.rationale).toBe(r2.rationale);
  });

  it("R-9 · no hardcoded CAP IDs · every field derives from input", () => {
    const c = baseCap({ cap_id: "CAP-UNIQUE-9876543", kind: "custom.kind", priority: "HIGH", status: "OPEN" });
    const r = recommendNextAction([c]);
    expect(r.cap_id).toBe("CAP-UNIQUE-9876543");
    expect(r.cap_kind).toBe("custom.kind");
  });
});
