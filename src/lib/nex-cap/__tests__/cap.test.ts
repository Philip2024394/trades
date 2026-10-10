// WO-CAP-01 · CAP module tests.

import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { persistCapabilityGap, loadCap, updateCapStatus, loadAllCaps, loadOpenCaps, loadResolvedCaps } from "../registry";
import { resolveCapProposal, applyResolverDecision, isAutoFixKind, isEscalateOnlyKind, listAutoFixKinds, listEscalateOnlyKinds } from "../resolver";
import { runCapDetectionPass } from "../detection";
import { CAP_COLLECTION } from "../types";
import { SOURCE_GUARDIAN_REJECTIONS_COLLECTION } from "@/lib/nex-intelligence/source-guardian";
import { NEX_NET_GROWTH_COLLECTION } from "@/lib/nex-agent-runtime/nex-net-growth";
import { getStorage } from "@/lib/nex/storage/registry";

const REPO = process.cwd();
async function rm(name: string) { try { await fs.unlink(path.join(REPO, "data", "nex-storage", `${name}.jsonl`)); } catch {} }

describe("WO-CAP-01 · CAP persistence + registry", () => {
  // Do NOT purge shared file · unique dedupe_keys prevent collision.

  it("C-1 · persistCapabilityGap creates a CAP with content-hashed cap_id + provenance", async () => {
    const cap = await persistCapabilityGap({
      kind: "test.example", category: "PERFORMANCE", priority: "MEDIUM",
      title: "test CAP",
      evidence: [{ collection: "x", record_id: "y", kind: "test" }],
      detector_agent_id: null,
    });
    expect(cap.cap_id).toMatch(/^CAP-PERFORMANCE-/);
    expect(cap.status).toBe("OPEN");
    expect(cap.provenance_chain_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("C-2 · dedupe_key produces idempotent cap_id (same key → same CAP)", async () => {
    const a = await persistCapabilityGap({
      kind: "test.dedupe", category: "SECURITY", priority: "LOW",
      title: "first", evidence: [], detector_agent_id: null,
      dedupe_key: "same-key",
    });
    const b = await persistCapabilityGap({
      kind: "test.dedupe", category: "SECURITY", priority: "LOW",
      title: "second", evidence: [], detector_agent_id: null,
      dedupe_key: "same-key",
    });
    expect(a.cap_id).toBe(b.cap_id);
  });

  it("C-3 · updateCapStatus transitions status and preserves provenance chain", async () => {
    const cap = await persistCapabilityGap({
      kind: "test.transition", category: "RELIABILITY", priority: "MEDIUM",
      title: "will transition", evidence: [], detector_agent_id: null,
    });
    const updated = await updateCapStatus({
      cap_id: cap.cap_id, status: "PROPOSED", resolver_outcome: "PROPOSE",
      proposed_wo_id: "WO-TEST-123", resolution_note: "unsigned proposal drafted",
    });
    expect(updated?.status).toBe("PROPOSED");
    expect(updated?.resolver_outcome).toBe("PROPOSE");
    expect(updated?.proposed_wo_id).toBe("WO-TEST-123");
  });

  it("C-4 · loadOpenCaps / loadResolvedCaps filter by status", async () => {
    const openCap = await persistCapabilityGap({
      kind: "t.open", category: "SECURITY", priority: "LOW", title: "open", evidence: [], detector_agent_id: null,
      dedupe_key: `open-${Date.now()}`,
    });
    const resolvedCap = await persistCapabilityGap({
      kind: "t.resolved", category: "SECURITY", priority: "LOW", title: "resolved", evidence: [], detector_agent_id: null,
      dedupe_key: `res-${Date.now()}`,
    });
    await updateCapStatus({ cap_id: resolvedCap.cap_id, status: "RESOLVED", resolution_note: "done" });
    const open = await loadOpenCaps();
    const resolved = await loadResolvedCaps();
    expect(open.some((c) => c.cap_id === openCap.cap_id)).toBe(true);
    expect(resolved.some((c) => c.cap_id === resolvedCap.cap_id)).toBe(true);
    expect(open.some((c) => c.cap_id === resolvedCap.cap_id)).toBe(false);
  });
});

describe("WO-CAP-01 · three-outcome resolver", () => {
  // Do NOT purge shared file · unique dedupe_keys prevent collision.

  it("R-1 · CRITICAL priority always ESCALATES (regardless of kind)", async () => {
    const cap = await persistCapabilityGap({
      kind: "any.kind", category: "PERFORMANCE", priority: "CRITICAL",
      title: "critical", evidence: [], detector_agent_id: null,
      dedupe_key: `crit-${Date.now()}`,
    });
    const decision = resolveCapProposal({ cap });
    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.next_status).toBe("ESCALATED");
  });

  it("R-2 · ESCALATE_ONLY kinds always escalate (security-critical registry tamper etc.)", async () => {
    const cap = await persistCapabilityGap({
      kind: "guardian.te.evidence_source_registry_untrusted",
      category: "SECURITY", priority: "HIGH",
      title: "registry tamper", evidence: [], detector_agent_id: null,
      dedupe_key: `escalate-only-${Date.now()}`,
    });
    const decision = resolveCapProposal({ cap });
    expect(decision.outcome).toBe("ESCALATE");
    expect(isEscalateOnlyKind(cap.kind)).toBe(true);
  });

  it("R-3 · unknown kind defaults to PROPOSE (unsigned WO · founder must sign)", async () => {
    const cap = await persistCapabilityGap({
      kind: "some.new.improvement", category: "PERFORMANCE", priority: "MEDIUM",
      title: "propose", evidence: [], detector_agent_id: null,
      dedupe_key: `prop-${Date.now()}`,
    });
    const decision = resolveCapProposal({ cap });
    expect(decision.outcome).toBe("PROPOSE");
    expect(decision.next_status).toBe("PROPOSED");
  });

  it("R-4 · applyResolverDecision transitions the CAP record atomically", async () => {
    const cap = await persistCapabilityGap({
      kind: "some.kind", category: "PERFORMANCE", priority: "LOW",
      title: "test", evidence: [], detector_agent_id: null,
      dedupe_key: `apply-${Date.now()}`,
    });
    const { cap: updated, decision } = await applyResolverDecision(cap);
    expect(decision.outcome).toBe("PROPOSE");
    expect(updated?.status).toBe("PROPOSED");
    expect(updated?.resolver_outcome).toBe("PROPOSE");
  });

  it("R-5 · AUTO_FIX list starts EMPTY · doctrine: prove PROPOSE first", () => {
    // Founder-locked: no auto-fix scopes registered until we have proven PROPOSE loop.
    expect(listAutoFixKinds()).toEqual([]);
    expect(listEscalateOnlyKinds().length).toBeGreaterThan(0);
  });

  it("R-6 · resolver is pure · same input → same outcome (deterministic P-S)", async () => {
    const cap = await persistCapabilityGap({
      kind: "deterministic.test", category: "UX", priority: "LOW",
      title: "det", evidence: [], detector_agent_id: null,
      dedupe_key: `det-${Date.now()}`,
    });
    const a = resolveCapProposal({ cap });
    const b = resolveCapProposal({ cap });
    expect(a).toEqual(b);
  });
});

describe("WO-CAP-01 · auto-detection", () => {
  // Do NOT purge shared files · unique dedupe_keys prevent collision.

  it("D-1 · Guardian rejections auto-generate SECURITY CAPs (deduped by code+host)", async () => {
    // Unique host per test run so parallel test files can't produce
    // a colliding CAP.
    const uniqueHost = `d1-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.example.com`;
    const store = getStorage();
    await store.save(SOURCE_GUARDIAN_REJECTIONS_COLLECTION, {
      record_type: "NEX_SOURCE_GUARDIAN_REJECTION",
      rejection_id: `GRD-REJ-test-${Date.now()}-d1`,
      rejection_code: "te.evidence_source_unregistered",
      requested_source_id: "bogus",
      requested_url: `https://${uniqueHost}/x`,
      requested_host: uniqueHost,
      requesting_agent_id: "intelligence-crawler",
      requesting_identity_id: "test-id-1",
      requesting_environment: "PRODUCTION_WORKFORCE",
      mission_id: null, authorization_context: {},
      reason: "test", rejected_at: new Date().toISOString(),
      provenance_chain_hash: "0000000000000000000000000000000000000000000000000000000000000000",
    });
    await runCapDetectionPass();
    const all = await loadAllCaps();
    const secCap = all.find((c) => c.category === "SECURITY" && c.kind === "guardian.te.evidence_source_unregistered" && c.title.includes(uniqueHost));
    expect(secCap).toBeDefined();
    expect(secCap?.evidence.length).toBeGreaterThan(0);
  });

  it("D-2 · running detection twice does NOT duplicate CAPs with same dedupe_key", async () => {
    const uniqueHost = `d2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.example.com`;
    const store = getStorage();
    await store.save(SOURCE_GUARDIAN_REJECTIONS_COLLECTION, {
      record_type: "NEX_SOURCE_GUARDIAN_REJECTION",
      rejection_id: `GRD-REJ-test-${Date.now()}-d2`,
      rejection_code: "te.evidence_source_missing_id",
      requested_source_id: null, requested_url: `https://${uniqueHost}`, requested_host: uniqueHost,
      requesting_agent_id: "intelligence-crawler", requesting_identity_id: "test-id-2",
      requesting_environment: "PRODUCTION_WORKFORCE",
      mission_id: null, authorization_context: {},
      reason: "test", rejected_at: new Date().toISOString(),
      provenance_chain_hash: "0000000000000000000000000000000000000000000000000000000000000000",
    });
    await runCapDetectionPass();
    await runCapDetectionPass();
    const all = await loadAllCaps();
    // Filter for CAPs specifically produced by this test's unique host
    const forThisRun = all.filter((c) => c.kind === "guardian.te.evidence_source_missing_id" && c.title.includes(uniqueHost));
    expect(forThisRun.length).toBe(1);
  });
});
