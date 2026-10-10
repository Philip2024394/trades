// WO-CAP-FOUNDER-VIEW-01 · nex1-diagnose route adversarial tests.
//
// Founder-locked 2026-09-13. Assertions:
//   - The endpoint produces unsigned proposals only
//   - founder_signature_slot is always null in the response
//   - execution_authority_granted is always false
//   - workstation_execution_ready is always false
//   - Security-escalate-only kinds → ESCALATED, no proposal drafted
//   - Test-namespace CAPs are refused (403)
//   - No hardcoded CAP IDs
//   - The button surface never grants any authority

import { describe, it, expect } from "vitest";
import { persistCapabilityGap } from "../registry";
import { POST } from "@/app/api/nex/cap/nex1-diagnose/route";

async function callPost(body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const req = new Request("http://localhost/api/nex/cap/nex1-diagnose", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json };
}

describe("WO-CAP-FOUNDER-VIEW-01 · POST /api/nex/cap/nex1-diagnose", () => {
  it("N-1 · missing cap_id → 400", async () => {
    const { status, json } = await callPost({});
    expect(status).toBe(400);
    expect(json.error).toBe("missing_cap_id");
  });

  it("N-2 · unknown cap_id → 404", async () => {
    const { status, json } = await callPost({ cap_id: "CAP-DOES-NOT-EXIST-9999" });
    expect(status).toBe(404);
    expect(json.error).toBe("cap_not_found");
  });

  it("N-3 · test-namespace CAP is refused (403) · button does not trigger test artefacts", async () => {
    const cap = await persistCapabilityGap({
      kind: "test.diagnose.button-refuse",
      category: "PERFORMANCE", priority: "LOW",
      title: "test", evidence: [], detector_agent_id: "test",
      dedupe_key: `route-test-${Date.now()}-${Math.random()}`,
    });
    const { status, json } = await callPost({ cap_id: cap.cap_id });
    expect(status).toBe(403);
    expect(json.error).toBe("cap_is_test_event");
  });

  it("N-4 · genuine PROPOSE CAP · produces UNSIGNED proposal · no execution authority granted", async () => {
    const cap = await persistCapabilityGap({
      kind: "rate_limiter.persistent_backoff",   // known PROPOSE-outcome kind in resolver
      category: "PERFORMANCE", priority: "MEDIUM",
      title: "Rate limiter persistent backoff on canonical intelligence source", evidence: [{ collection: "test", record_id: "e1", kind: "audit_finding" }],
      detector_agent_id: "adr-0320-bootstrap-seed",
      dedupe_key: `route-genuine-${Date.now()}-${Math.random()}`,
    });
    const { status, json } = await callPost({ cap_id: cap.cap_id });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.outcome).toBe("PROPOSE");
    expect(json.execution_authority_granted).toBe(false);
    expect(json.workstation_execution_ready).toBe(false);
    // Proposal, if returned, must have founder_signature_slot = null
    const proposal = json.proposal as { founder_signature_slot: unknown } | null;
    expect(proposal).not.toBeNull();
    expect(proposal?.founder_signature_slot).toBeNull();
  });

  it("N-5 · security-escalate-only kind → ESCALATE · NO proposal drafted", async () => {
    const cap = await persistCapabilityGap({
      kind: "guardian.te.evidence_source_registry_untrusted",
      category: "SECURITY", priority: "LOW",
      title: "Source registry integrity mismatch detected by Guardian",
      evidence: [{ collection: "test", record_id: "e2", kind: "audit_finding" }],
      detector_agent_id: "guardian",
      dedupe_key: `route-security-${Date.now()}-${Math.random()}`,
    });
    const { status, json } = await callPost({ cap_id: cap.cap_id });
    expect(status).toBe(200);
    expect(json.outcome).toBe("ESCALATE");
    expect(json.proposal).toBeNull();
    expect(json.execution_authority_granted).toBe(false);
  });

  it("N-6 · doctrine_note present in every response · does NOT claim autonomous resolution", async () => {
    const cap = await persistCapabilityGap({
      kind: "rate_limiter.persistent_backoff",
      category: "PERFORMANCE", priority: "LOW",
      title: "Rate limiter persistent backoff observed by scheduler", evidence: [{ collection: "test", record_id: "e3", kind: "audit_finding" }],
      detector_agent_id: "adr-0320-bootstrap-seed",
      dedupe_key: `route-doctrine-${Date.now()}-${Math.random()}`,
    });
    const { status, json } = await callPost({ cap_id: cap.cap_id });
    expect(status).toBe(200);
    expect(typeof json.doctrine_note).toBe("string");
    expect(json.doctrine_note).toMatch(/unsigned proposal only/i);
    expect(json.doctrine_note).toMatch(/Ed25519 signature/i);
    expect(json.doctrine_note).toMatch(/WO-CAP-EXECUTION-03/);
  });

  it("N-7 · GET is not allowed · 405", async () => {
    const { GET } = await import("@/app/api/nex/cap/nex1-diagnose/route");
    const res = await GET();
    expect(res.status).toBe(405);
  });
});
