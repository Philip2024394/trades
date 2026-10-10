// WO-CAP-FOUNDER-VIEW-01 · work-map API adversarial tests.
//
// Founder-locked 2026-09-13. Assertions:
//   - live_cap_registry.founder_summary counts are LIVE (change when CAPs
//     change · not hardcoded)
//   - recommended_next_action is deterministic + driven by registry
//   - full CAP list is preserved · TEST_EVENTs included but tagged
//   - No execution authority added to the route surface

import { describe, it, expect } from "vitest";
import { persistCapabilityGap } from "../registry";
import { GET } from "@/app/api/nex/work-map/route";

async function callGet(): Promise<Record<string, unknown>> {
  const res = await GET();
  return (await res.json()) as Record<string, unknown>;
}

describe("WO-CAP-FOUNDER-VIEW-01 · GET /api/nex/work-map · live registry projection", () => {
  it("W-1 · endpoint returns live_cap_registry with founder_summary + recommended_next_action + full list", async () => {
    const body = await callGet();
    const reg = body.live_cap_registry as Record<string, unknown>;
    expect(reg).toBeDefined();
    expect(reg.founder_summary).toBeDefined();
    expect(reg.recommended_next_action).toBeDefined();
    expect(Array.isArray(reg.founder_facing_caps)).toBe(true);
    expect(Array.isArray(reg.live_suggested_fixes)).toBe(true);
    expect(Array.isArray(reg.recent_resolutions)).toBe(true);
  });

  it("W-2 · adding a genuine HIGH CAP increases high_priority count · live not hardcoded", async () => {
    const before = await callGet();
    const beforeReg = before.live_cap_registry as Record<string, unknown>;
    const beforeSummary = beforeReg.founder_summary as { high_priority: number };

    await persistCapabilityGap({
      kind: "workmap.test.live-count",   // will be tagged as TEST_EVENT so does NOT bump high_priority
      category: "INTELLIGENCE", priority: "HIGH",
      title: "live count · test-namespace", evidence: [],
      detector_agent_id: null,
      dedupe_key: `workmap-live-test-${Date.now()}-${Math.random()}`,
    });
    // A PRODUCTION kind that WILL bump the counter
    const capId = `live-count-real-${Date.now()}-${Math.random()}`;
    await persistCapabilityGap({
      kind: "workmap.production.marker",
      category: "INTELLIGENCE", priority: "HIGH",
      title: "genuine production capability gap",
      evidence: [], detector_agent_id: "adr-0320-bootstrap-seed",
      dedupe_key: capId,
    });

    const after = await callGet();
    const afterReg = after.live_cap_registry as Record<string, unknown>;
    const afterSummary = afterReg.founder_summary as { high_priority: number; test_events: number };
    expect(afterSummary.high_priority).toBeGreaterThanOrEqual(beforeSummary.high_priority + 1);
    expect(afterSummary.test_events).toBeGreaterThanOrEqual(1);
  });

  it("W-3 · TEST_EVENT CAPs are visibly tagged in founder_facing_caps · never claimed as REAL_RISK", async () => {
    const cap = await persistCapabilityGap({
      kind: "test.workmap-tag.check",
      category: "SECURITY", priority: "CRITICAL",
      title: "adversarial test event", evidence: [],
      detector_agent_id: "test",
      dedupe_key: `workmap-tag-${Date.now()}-${Math.random()}`,
    });
    const body = await callGet();
    const reg = body.live_cap_registry as Record<string, unknown>;
    const full = reg.founder_facing_caps as Array<Record<string, unknown>>;
    const row = full.find((r) => r.cap_id === cap.cap_id);
    expect(row).toBeDefined();
    expect(row?.founder_class).toBe("TEST_EVENT");
    expect(row?.is_test_event).toBe(true);
    expect(row?.nex1_diagnose_available).toBe(false);
  });

  it("W-4 · security-escalate-only kind → SECURITY_ESCALATION regardless of status", async () => {
    const cap = await persistCapabilityGap({
      kind: "guardian.te.evidence_source_registry_untrusted",
      category: "SECURITY", priority: "MEDIUM",
      title: "genuine registry integrity issue", evidence: [],
      detector_agent_id: "guardian",
      dedupe_key: `workmap-sec-${Date.now()}-${Math.random()}`,
    });
    const body = await callGet();
    const reg = body.live_cap_registry as Record<string, unknown>;
    const full = reg.founder_facing_caps as Array<Record<string, unknown>>;
    const row = full.find((r) => r.cap_id === cap.cap_id);
    expect(row?.founder_class).toBe("SECURITY_ESCALATION");
    // NEX1 button UNAVAILABLE for security escalations (they are founder-only)
    expect(row?.nex1_diagnose_available).toBe(false);
  });

  it("W-5 · doctrine_note reminds that this is a govern surface not a resolve surface", async () => {
    const body = await callGet();
    const reg = body.live_cap_registry as Record<string, unknown>;
    expect(typeof reg.doctrine_note).toBe("string");
    expect(reg.doctrine_note).toMatch(/GOVERN/i);
    expect(reg.doctrine_note).toMatch(/WO-CAP-EXECUTION-03/);
    expect(reg.doctrine_note).toMatch(/never code execution/i);
    // Founder-locked more-truthful wording: doctrine_note MUST NOT claim
    // absolute impossibility · it describes the architectural gates.
    expect(reg.doctrine_note).not.toMatch(/never break/i);
    expect(reg.doctrine_note).toMatch(/directly mutate protected code/i);
  });

  it("W-6 · recommended_next_action never picks a TEST_EVENT · registry-driven not hardcoded", async () => {
    // Even if a CRITICAL test event exists, the recommendation must not
    // surface it. The rec must either be NONE, or an AWAIT_FOUNDER_SIGNATURE,
    // or a REAL NEX1_ACTIONABLE CAP.
    await persistCapabilityGap({
      kind: "test.rec.critical-noise",
      category: "SECURITY", priority: "CRITICAL",
      title: "critical noise · test only", evidence: [],
      detector_agent_id: "test",
      dedupe_key: `workmap-rec-noise-${Date.now()}-${Math.random()}`,
    });
    const body = await callGet();
    const reg = body.live_cap_registry as Record<string, unknown>;
    const rec = reg.recommended_next_action as { kind: string; cap_kind: string | null };
    if (rec.cap_kind) {
      expect(rec.cap_kind.toLowerCase().startsWith("test.")).toBe(false);
      expect(rec.cap_kind.toLowerCase().startsWith("test-")).toBe(false);
    }
    expect(["NEX1_DIAGNOSE", "AWAIT_FOUNDER_SIGNATURE", "FOUNDER_REVIEW", "NONE"]).toContain(rec.kind);
  });
});
