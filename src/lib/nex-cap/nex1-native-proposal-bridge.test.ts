// NEX1 Cognitive Boundary Bridge · tests
//
// Verifies the smallest deterministic translation function between the
// NEX1_NATIVE cognitive engine and the existing NEX2/NEX3 governance
// path. No new brain. No new agent. No signing. No autonomous
// execution. No LLM.
//
// Test axes (from the founder implementation prompt §11 · §12 · §14 ·
// §15 · §19):
//   A · Normal chat NOT bridged
//   B · Governed proposal produces valid envelope (NEX2 INDEPENDENTLY_VERIFIED)
//   C · Refusal on missing/short diagnosis
//   D · Escalated path · security-critical CAP kind
//   E · NEX2 rejection path · NEX3 arbitration
//   F · Integration · full NEX1 → NEX2 → NEX3 correlation chain
//   G · Determinism · same input → same proposal_id
//   H · Anti-collusion · bridge cannot forge founder signature
//   I · Cryptographic-boundary preservation · bridge output is unsigned
//   J · Negative · founder_signature_slot cannot be non-null
//   K · Negative · NEX3 with no NEX2 review → INSUFFICIENT_INPUT
//   L · Correlation IDs preserved end-to-end
//
// This test suite invokes the pure compute functions
// (nex2ReviewCompute, nex3ArbitrationCompute) directly. It does NOT
// start any daemon, does NOT call storage, does NOT introduce any new
// runtime process.

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  bridgeNex1NativeToProposal,
  deriveBridgedProposalId,
  NEX1_NATIVE_PROPOSAL_BRIDGE_VERSION,
  type Nex1NativeCognitiveResult,
  type Nex1NativeProposalBridgeInput,
} from "@/lib/nex-cap/nex1-native-proposal-bridge";
import { nex2ReviewCompute } from "@/lib/nex-agent-runtime/nex2/review";
import { nex3ArbitrationCompute } from "@/lib/nex-agent-runtime/nex3/arbitration";
import type { CapabilityGap } from "@/lib/nex-cap/types";
import type { Nex2ReviewRecord } from "@/lib/nex-agent-runtime/nex2/types";
import type { MissionContextChain } from "@/lib/nex-agent-runtime/nex1/types";

// ── Shared fixtures ───────────────────────────────────────────────────

function requestHashOf(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

function makeCognitiveResult(
  overrides: Partial<Nex1NativeCognitiveResult> = {},
): Nex1NativeCognitiveResult {
  return {
    turn_id: "TURN-test-0001",
    request_hash: requestHashOf("investigate protected substrate leak"),
    classification: "GOVERNED_PROPOSAL",
    diagnosis:
      "The observer detected a repeated 429 backoff from source_id=X spanning the last 3 poll cycles; upstream is rate-limiting our crawler.",
    proposed_fix_summary:
      "Reduce poll priority for source_id=X and increase min_interval_ms in the signed source registry manifest.",
    evidence_refs: ["gb://nex_rate_limit_events/evt-001", "gb://nex_snapshots/snap-042"],
    resolver_outcome: "PROPOSE",
    ...overrides,
  };
}

function makeCap(overrides: Partial<CapabilityGap> = {}): CapabilityGap {
  return {
    record_type: "NEX_CAPABILITY_GAP",
    cap_id: "CAP-test-0001",
    kind: "rate_limiter.persistent_backoff",
    category: "PERFORMANCE",
    priority: "MEDIUM",
    status: "TRIAGED",
    resolver_outcome: "PROPOSE",
    title: "persistent backoff on source X",
    evidence: [
      { collection: "nex_rate_limit_events", record_id: "evt-001", kind: "rate_limit_event" },
    ],
    proposed_wo_id: null,
    resolution_note: null,
    detected_at: "2026-09-19T12:00:00.000Z",
    last_updated_at: "2026-09-19T12:00:00.000Z",
    detector_agent_id: null,
    provenance_chain_hash: "fixture",
    ...overrides,
  };
}

function makeMissionContext(
  overrides: Partial<MissionContextChain> = {},
): MissionContextChain {
  return {
    record_type: "NEX1_MISSION_CONTEXT",
    context_id: "CTX-nex1-runtime03-test-MISSION-x-abcdef12",
    agent_id: "nex1-runtime03-test",
    instance_id: "inst-test-1",
    mission_id: "MISSION-test-0001",
    observations: [{ at: "t0", kind: "obs", detail: "detected repeat backoff", evidence_ref: "evt-001" }],
    knowledge_used: [],
    analysis: [{ at: "t1", kind: "analysis", detail: "priority too high", evidence_ref: null }],
    files_considered: [],
    tests_considered: [],
    proposed_solution: { at: "t2", kind: "proposed_solution", detail: "lower priority", evidence_ref: null },
    evidence_refs: ["evt-001"],
    handoff: { to: "nex2", note: "review please" },
    started_at: "t0",
    closed_at: "t2",
    signature_hex: "fixture-not-verified-in-these-tests",
    ...overrides,
  } as MissionContextChain;
}

// ─────────────────────────────────────────────────────────────────────
// Test A · Normal chat is NOT bridged
// ─────────────────────────────────────────────────────────────────────

describe("Test A · normal NEX1_NATIVE chat is NOT bridged", () => {
  it("A-1 · classification NORMAL_CHAT · bridge refuses", () => {
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult({ classification: "NORMAL_CHAT" }),
      cap_id: "CAP-normal-0001",
      mission_id: null,
    });
    expect(receipt.bridged).toBe(false);
    expect(receipt.refusal_reason).toBe("CLASSIFICATION_NORMAL_CHAT");
    expect(receipt.proposal).toBeNull();
  });

  it("A-2 · normal chat receipt still carries turn_id for audit", () => {
    const cr = makeCognitiveResult({ classification: "NORMAL_CHAT", turn_id: "TURN-abc" });
    const receipt = bridgeNex1NativeToProposal({ cognitive_result: cr, cap_id: "CAP-x", mission_id: null });
    expect(receipt.correlation.turn_id).toBe("TURN-abc");
    expect(receipt.correlation.proposal_id).toBeNull();
  });

  it("A-3 · refusal receipt does NOT invoke NEX2 · proposal is null", () => {
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult({ classification: "NORMAL_CHAT" }),
      cap_id: "CAP-x",
      mission_id: null,
    });
    expect(receipt.proposal).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Test B · Governed proposal produces valid envelope · NEX2 verifies it
// ─────────────────────────────────────────────────────────────────────

describe("Test B · governed proposal produces NEX2-consumable envelope", () => {
  it("B-1 · bridged=true · proposal envelope shape valid", () => {
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult(),
      cap_id: "CAP-test-0001",
      mission_id: null,
    });
    expect(receipt.bridged).toBe(true);
    expect(receipt.refusal_reason).toBeNull();
    expect(receipt.proposal).not.toBeNull();
    expect(receipt.proposal!.record_type).toBe("NEX_CAP_ENGINEERING_PROPOSAL");
    expect(receipt.proposal!.founder_signature_slot).toBeNull();
    expect(receipt.proposal!.authorised_workstation_scope).toBeNull();
    expect(receipt.proposal!.diagnosed_by_agent).toBe("nex1-master-engineer");
    expect(receipt.proposal!.evidence_chain.length).toBeGreaterThan(0);
    expect(receipt.proposal!.evidence_chain[0]).toBe("CAP-test-0001");
  });

  it("B-2 · NEX2 review of a well-formed bridged proposal returns INDEPENDENTLY_VERIFIED", () => {
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult(),
      cap_id: "CAP-test-0001",
      mission_id: null,
    });
    expect(receipt.bridged).toBe(true);
    const comp = nex2ReviewCompute({
      proposal: receipt.proposal!,
      cap: makeCap(),
      nex1_context: null,
      mission_id: null,
    });
    expect(comp.verdict).toBe("INDEPENDENTLY_VERIFIED");
    expect(comp.findings).toHaveLength(0);
  });

  it("B-3 · bridge does NOT invoke NEX2 · caller is responsible", () => {
    // Structural test: bridge output has no NEX2 review attached.
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult(),
      cap_id: "CAP-test-0001",
      mission_id: null,
    });
    expect((receipt as unknown as { nex2_review?: unknown }).nex2_review).toBeUndefined();
  });

  it("B-4 · bridge version constant present in receipt", () => {
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult(),
      cap_id: "CAP-test-0001",
      mission_id: null,
    });
    expect(receipt.bridge_version).toBe(NEX1_NATIVE_PROPOSAL_BRIDGE_VERSION);
    expect(receipt.bridge_version).toMatch(/^nex1-native-proposal-bridge\.v1\./);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Test C · Refusal path · malformed cognitive input
// ─────────────────────────────────────────────────────────────────────

describe("Test C · refusal on malformed cognitive input", () => {
  it("C-1 · diagnosis too short → DIAGNOSIS_TOO_SHORT", () => {
    const r = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult({ diagnosis: "short" }),
      cap_id: "CAP-x",
      mission_id: null,
    });
    expect(r.bridged).toBe(false);
    expect(r.refusal_reason).toBe("DIAGNOSIS_TOO_SHORT");
  });

  it("C-2 · fix summary too short → FIX_SUMMARY_TOO_SHORT", () => {
    const r = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult({ proposed_fix_summary: "ok" }),
      cap_id: "CAP-x",
      mission_id: null,
    });
    expect(r.bridged).toBe(false);
    expect(r.refusal_reason).toBe("FIX_SUMMARY_TOO_SHORT");
  });

  it("C-3 · empty evidence refs → EMPTY_EVIDENCE_REFS", () => {
    const r = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult({ evidence_refs: [] }),
      cap_id: "CAP-x",
      mission_id: null,
    });
    expect(r.bridged).toBe(false);
    expect(r.refusal_reason).toBe("EMPTY_EVIDENCE_REFS");
  });

  it("C-4 · missing turn_id → MISSING_TURN_ID", () => {
    const r = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult({ turn_id: "" }),
      cap_id: "CAP-x",
      mission_id: null,
    });
    expect(r.bridged).toBe(false);
    expect(r.refusal_reason).toBe("MISSING_TURN_ID");
  });

  it("C-5 · missing cap_id → MISSING_CAP_ID", () => {
    const r = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult(),
      cap_id: "",
      mission_id: null,
    });
    expect(r.bridged).toBe(false);
    expect(r.refusal_reason).toBe("MISSING_CAP_ID");
  });

  it("C-6 · missing request_hash → MISSING_REQUEST_HASH", () => {
    const r = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult({ request_hash: "" }),
      cap_id: "CAP-x",
      mission_id: null,
    });
    expect(r.bridged).toBe(false);
    expect(r.refusal_reason).toBe("MISSING_REQUEST_HASH");
  });
});

// ─────────────────────────────────────────────────────────────────────
// Test D · Escalated path · security-critical CAP kind
// ─────────────────────────────────────────────────────────────────────

describe("Test D · escalated path · security-critical CAP kind", () => {
  it("D-1 · security-critical kind with PROPOSE outcome → NEX2 ESCALATE_TO_FOUNDER", () => {
    // A well-intentioned bridge output where the caller mistakenly
    // classified a security-critical CAP as PROPOSE. NEX2 catches it.
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult({ resolver_outcome: "PROPOSE" }),
      cap_id: "CAP-sec-0001",
      mission_id: null,
    });
    expect(receipt.bridged).toBe(true);
    const cap = makeCap({
      cap_id: "CAP-sec-0001",
      kind: "guardian.te.evidence_source_registry_untrusted",
      category: "SECURITY",
      priority: "CRITICAL",
    });
    const comp = nex2ReviewCompute({
      proposal: receipt.proposal!,
      cap,
      nex1_context: null,
      mission_id: null,
    });
    expect(comp.verdict).toBe("ESCALATE_TO_FOUNDER");
    const hasEscalateFinding = comp.findings.some(
      (f) => f.kind === "escalate_only_kind_not_escalated",
    );
    expect(hasEscalateFinding).toBe(true);
  });

  it("D-2 · security-critical kind with ESCALATE outcome → NEX2 INDEPENDENTLY_VERIFIED", () => {
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult({ resolver_outcome: "ESCALATE" }),
      cap_id: "CAP-sec-0002",
      mission_id: null,
    });
    const cap = makeCap({
      cap_id: "CAP-sec-0002",
      kind: "guardian.te.evidence_source_test_masquerade",
      category: "SECURITY",
      priority: "CRITICAL",
    });
    const comp = nex2ReviewCompute({
      proposal: receipt.proposal!,
      cap,
      nex1_context: null,
      mission_id: null,
    });
    expect(comp.verdict).toBe("INDEPENDENTLY_VERIFIED");
  });
});

// ─────────────────────────────────────────────────────────────────────
// Test E · NEX2 rejection path · NEX3 arbitration disagreement
// ─────────────────────────────────────────────────────────────────────

describe("Test E · NEX3 arbitration on NEX2 conflict", () => {
  it("E-1 · CONFLICT_WITH_NEX1 · complete NEX1 chain → NEX3 can ALLOW", () => {
    // Construct a scenario where NEX2 raises multiple medium context-chain
    // findings but NEX1's actual chain (supplied to NEX3) is complete.
    // NEX3 should be able to override NEX2 on this evidence-quality basis.
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult(),
      cap_id: "CAP-conflict-0001",
      mission_id: "MISSION-conflict-0001",
    });
    // Emulate a NEX2 review that raised CONFLICT_WITH_NEX1.
    const fakeNex2Review: Nex2ReviewRecord = {
      record_type: "NEX2_REVIEW",
      review_id: "REV-nex2-test-conflict-01",
      proposal_id: receipt.proposal!.proposal_id,
      cap_id: "CAP-conflict-0001",
      mission_id: "MISSION-conflict-0001",
      nex1_context_id: null,
      reviewed_by_agent_id: "nex2-test",
      reviewed_by_instance_id: "inst-nex2-1",
      reviewed_by_public_key_der_hex: "aa".repeat(21),
      reviewed_at: "2026-09-19T13:00:00.000Z",
      verdict: "CONFLICT_WITH_NEX1",
      findings: [
        { kind: "context_chain_no_observations", severity: "medium", detail: "chain-side", evidence_ref: null },
        { kind: "context_chain_no_analysis", severity: "medium", detail: "chain-side", evidence_ref: null },
      ],
      reason_summary: "test conflict",
      evidence_ref: null,
      signature_hex: "not-verified-in-this-test",
    };
    const nex3Comp = nex3ArbitrationCompute({
      proposal: receipt.proposal!,
      cap: makeCap({ cap_id: "CAP-conflict-0001" }),
      nex2_review: fakeNex2Review,
      nex1_context: makeMissionContext({ mission_id: "MISSION-conflict-0001" }),
    });
    // NEX3 with only medium NEX2 findings + complete NEX1 chain →
    // supports_allow signals dominate.
    expect(nex3Comp.verdict).toBe("ALLOW");
    expect(nex3Comp.allow_score).toBeGreaterThan(nex3Comp.reject_score);
    expect(nex3Comp.reason_summary).toContain("ALLOW");
  });

  it("E-2 · NEX3 arbitration record carries signals independently derived", () => {
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult(),
      cap_id: "CAP-conflict-0002",
      mission_id: "MISSION-conflict-0002",
    });
    const fakeNex2Review: Nex2ReviewRecord = {
      record_type: "NEX2_REVIEW",
      review_id: "REV-nex2-test-conflict-02",
      proposal_id: receipt.proposal!.proposal_id,
      cap_id: "CAP-conflict-0002",
      mission_id: "MISSION-conflict-0002",
      nex1_context_id: null,
      reviewed_by_agent_id: "nex2-test",
      reviewed_by_instance_id: "inst-nex2-1",
      reviewed_by_public_key_der_hex: "bb".repeat(21),
      reviewed_at: "2026-09-19T13:00:00.000Z",
      verdict: "CONFLICT_WITH_NEX1",
      findings: [
        { kind: "context_chain_no_observations", severity: "medium", detail: "chain-side", evidence_ref: null },
        { kind: "context_chain_no_analysis", severity: "medium", detail: "chain-side", evidence_ref: null },
      ],
      reason_summary: "test conflict",
      evidence_ref: null,
      signature_hex: "not-verified-in-this-test",
    };
    const nex3Comp = nex3ArbitrationCompute({
      proposal: receipt.proposal!,
      cap: makeCap({ cap_id: "CAP-conflict-0002" }),
      nex2_review: fakeNex2Review,
      nex1_context: makeMissionContext({ mission_id: "MISSION-conflict-0002" }),
    });
    expect(nex3Comp.signals.some((s) => s.kind === "nex2_medium_findings_only")).toBe(true);
    expect(nex3Comp.signals.some((s) => s.kind === "nex1_chain_complete")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Test F · Full integration · correlation chain end-to-end
// ─────────────────────────────────────────────────────────────────────

describe("Test F · integration · NEX1 → NEX2 → NEX3 correlation chain", () => {
  it("F-1 · complete correlation chain preserves real IDs at every stage", () => {
    const turn_id = "TURN-integration-0001";
    const request_hash = requestHashOf("integration governed proposal");
    const cap_id = "CAP-integration-0001";
    const mission_id = "MISSION-integration-0001";

    // Stage 1 · NEX1_NATIVE cognitive result
    const cr = makeCognitiveResult({ turn_id, request_hash });

    // Stage 2 · Bridge to proposal
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: cr,
      cap_id,
      mission_id,
    });
    expect(receipt.bridged).toBe(true);
    const proposal_id = receipt.proposal!.proposal_id;
    expect(proposal_id).toMatch(/^CAP-PROP-BRIDGE-/);

    // Stage 3 · NEX2 review · construct with correlation preserved
    const nex1_context = makeMissionContext({ mission_id });
    const nex2Comp = nex2ReviewCompute({
      proposal: receipt.proposal!,
      cap: makeCap({ cap_id }),
      nex1_context,
      mission_id,
    });
    expect(nex2Comp.verdict).toBe("INDEPENDENTLY_VERIFIED");

    // (In production, NEX2 would sign a Nex2ReviewRecord with its own
    // Ed25519 key. For this test we do not need an actual NEX3
    // invocation because NEX2 approved; NEX3 would return
    // INSUFFICIENT_INPUT.)
    // But we still validate that IF NEX3 were called with an
    // INDEPENDENTLY_VERIFIED NEX2 review, it correctly declines.
    const fakeApprovedReview: Nex2ReviewRecord = {
      record_type: "NEX2_REVIEW",
      review_id: "REV-nex2-integration-0001",
      proposal_id,
      cap_id,
      mission_id,
      nex1_context_id: nex1_context.context_id,
      reviewed_by_agent_id: "nex2-test",
      reviewed_by_instance_id: "inst-1",
      reviewed_by_public_key_der_hex: "cc".repeat(21),
      reviewed_at: "2026-09-19T13:00:00.000Z",
      verdict: "INDEPENDENTLY_VERIFIED",
      findings: [],
      reason_summary: "clean",
      evidence_ref: null,
      signature_hex: "not-verified-in-this-test",
    };
    const nex3Comp = nex3ArbitrationCompute({
      proposal: receipt.proposal!,
      cap: makeCap({ cap_id }),
      nex2_review: fakeApprovedReview,
      nex1_context,
    });
    expect(nex3Comp.verdict).toBe("INSUFFICIENT_INPUT"); // no conflict to arbitrate

    // Chain integrity assertions
    expect(receipt.correlation.turn_id).toBe(turn_id);
    expect(receipt.correlation.proposal_id).toBe(proposal_id);
    expect(receipt.correlation.cap_id).toBe(cap_id);
    expect(receipt.correlation.mission_id).toBe(mission_id);
    expect(receipt.correlation.request_hash).toBe(request_hash);
    expect(fakeApprovedReview.proposal_id).toBe(proposal_id);
    expect(fakeApprovedReview.mission_id).toBe(mission_id);
    expect(fakeApprovedReview.nex1_context_id).toBe(nex1_context.context_id);
  });

  it("F-2 · full conflict chain with NEX3 arbitrating an actual disagreement", () => {
    const turn_id = "TURN-integration-0002";
    const request_hash = requestHashOf("integration conflict scenario");
    const cap_id = "CAP-integration-0002";
    const mission_id = "MISSION-integration-0002";

    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult({ turn_id, request_hash }),
      cap_id,
      mission_id,
    });
    const proposal_id = receipt.proposal!.proposal_id;

    // Force NEX2 to CONFLICT by giving it an incomplete mission context
    const partialContext = makeMissionContext({
      mission_id,
      observations: [],
      analysis: [],
      // Keep evidence_refs to prevent triggering context_chain_no_evidence
      // as well; we want exactly a 2-medium-finding CONFLICT.
      evidence_refs: ["evt-partial"],
    });
    const nex2Comp = nex2ReviewCompute({
      proposal: receipt.proposal!,
      cap: makeCap({ cap_id }),
      nex1_context: partialContext,
      mission_id,
    });
    expect(nex2Comp.verdict).toBe("CONFLICT_WITH_NEX1");

    // Build a Nex2ReviewRecord that mirrors NEX2's compute output
    const nex2Review: Nex2ReviewRecord = {
      record_type: "NEX2_REVIEW",
      review_id: "REV-nex2-integration-0002",
      proposal_id,
      cap_id,
      mission_id,
      nex1_context_id: partialContext.context_id,
      reviewed_by_agent_id: "nex2-test",
      reviewed_by_instance_id: "inst-2",
      reviewed_by_public_key_der_hex: "dd".repeat(21),
      reviewed_at: "2026-09-19T13:00:00.000Z",
      verdict: nex2Comp.verdict,
      findings: nex2Comp.findings,
      reason_summary: nex2Comp.reason_summary,
      evidence_ref: null,
      signature_hex: "not-verified-in-this-test",
    };

    // NEX3 arbitrates given the CONFLICT and now-complete NEX1 chain
    const completeContext = makeMissionContext({ mission_id });
    const nex3Comp = nex3ArbitrationCompute({
      proposal: receipt.proposal!,
      cap: makeCap({ cap_id }),
      nex2_review: nex2Review,
      nex1_context: completeContext,
    });
    expect(["ALLOW", "REJECT", "ESCALATE_TO_FOUNDER"]).toContain(nex3Comp.verdict);
    // Correlation preserved through all three stages
    expect(nex2Review.proposal_id).toBe(receipt.proposal!.proposal_id);
    expect(nex2Review.mission_id).toBe(mission_id);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Test G · Determinism
// ─────────────────────────────────────────────────────────────────────

describe("Test G · deterministic proposal_id derivation", () => {
  it("G-1 · same input → same proposal_id", () => {
    const id1 = deriveBridgedProposalId("TURN-abc", "hash-xyz", "CAP-x");
    const id2 = deriveBridgedProposalId("TURN-abc", "hash-xyz", "CAP-x");
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^CAP-PROP-BRIDGE-[0-9a-f]{24}$/);
  });

  it("G-2 · different inputs → different proposal_ids", () => {
    const a = deriveBridgedProposalId("TURN-abc", "hash-xyz", "CAP-x");
    const b = deriveBridgedProposalId("TURN-abc", "hash-xyz", "CAP-y");
    const c = deriveBridgedProposalId("TURN-abd", "hash-xyz", "CAP-x");
    const d = deriveBridgedProposalId("TURN-abc", "hash-xyw", "CAP-x");
    expect(new Set([a, b, c, d]).size).toBe(4);
  });

  it("G-3 · two bridge calls with identical input yield identical proposal_id", () => {
    const cr = makeCognitiveResult({ turn_id: "TURN-det", request_hash: "hash-det" });
    const r1 = bridgeNex1NativeToProposal({ cognitive_result: cr, cap_id: "CAP-det", mission_id: null });
    const r2 = bridgeNex1NativeToProposal({ cognitive_result: cr, cap_id: "CAP-det", mission_id: null });
    expect(r1.proposal!.proposal_id).toBe(r2.proposal!.proposal_id);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Test H · Anti-collusion · bridge cannot forge founder signature
// ─────────────────────────────────────────────────────────────────────

describe("Test H · anti-collusion invariants", () => {
  it("H-1 · bridge output always has founder_signature_slot === null", () => {
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult(),
      cap_id: "CAP-anti-1",
      mission_id: null,
    });
    expect(receipt.proposal!.founder_signature_slot).toBeNull();
  });

  it("H-2 · bridge output always has authorised_workstation_scope === null", () => {
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult(),
      cap_id: "CAP-anti-2",
      mission_id: null,
    });
    expect(receipt.proposal!.authorised_workstation_scope).toBeNull();
  });

  it("H-3 · bridge never introduces a new agent identity · uses existing nex1-master-engineer literal", () => {
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult(),
      cap_id: "CAP-anti-3",
      mission_id: null,
    });
    expect(receipt.proposal!.diagnosed_by_agent).toBe("nex1-master-engineer");
  });

  it("H-4 · bridge does not itself sign anything · no signature fields on receipt", () => {
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult(),
      cap_id: "CAP-anti-4",
      mission_id: null,
    });
    // Bridge produces no signature. Signing is NEX2/NEX3/Founder work.
    expect((receipt as unknown as Record<string, unknown>).signature_hex).toBeUndefined();
    expect((receipt as unknown as Record<string, unknown>).signed_by).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Test I · Cryptographic-boundary preservation · negative tests
// ─────────────────────────────────────────────────────────────────────

describe("Test I · negative · malformed proposal shapes NEX2 rejects", () => {
  it("I-1 · manually tampered founder_signature_slot triggers NEX2 REJECTED_UNSAFE", () => {
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult(),
      cap_id: "CAP-i1",
      mission_id: null,
    });
    // Simulate an attacker attempting to bypass authority by setting the
    // slot on the bridge output before it reaches NEX2. NEX2 catches it.
    const tampered = {
      ...receipt.proposal!,
      founder_signature_slot: "spoofed" as unknown as null,
    } as import("@/lib/nex-cap/nex1-engineer").CapEngineeringProposal;
    const nex2Comp = nex2ReviewCompute({
      proposal: tampered,
      cap: makeCap({ cap_id: "CAP-i1" }),
      nex1_context: null,
      mission_id: null,
    });
    expect(nex2Comp.verdict).toBe("REJECTED_UNSAFE");
    expect(nex2Comp.findings.some((f) => f.kind === "founder_signature_slot_not_null")).toBe(true);
  });

  it("I-2 · manually emptied evidence_chain triggers NEX2 REJECTED_INCOMPLETE_EVIDENCE", () => {
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult(),
      cap_id: "CAP-i2",
      mission_id: null,
    });
    const tampered = { ...receipt.proposal!, evidence_chain: [] as readonly string[] };
    const nex2Comp = nex2ReviewCompute({
      proposal: tampered,
      cap: makeCap({ cap_id: "CAP-i2" }),
      nex1_context: null,
      mission_id: null,
    });
    expect(nex2Comp.verdict).toBe("REJECTED_INCOMPLETE_EVIDENCE");
  });
});

// ─────────────────────────────────────────────────────────────────────
// Test J · Correlation · every stage carries the same proposal_id
// ─────────────────────────────────────────────────────────────────────

describe("Test J · correlation IDs propagate cleanly", () => {
  it("J-1 · receipt correlation matches proposal identifiers", () => {
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult({
        turn_id: "TURN-J1",
        request_hash: "hash-J1",
      }),
      cap_id: "CAP-J1",
      mission_id: "MISSION-J1",
    });
    expect(receipt.correlation.proposal_id).toBe(receipt.proposal!.proposal_id);
    expect(receipt.correlation.cap_id).toBe(receipt.proposal!.cap_id);
  });

  it("J-2 · mission_id is preserved when supplied", () => {
    const r = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult(),
      cap_id: "CAP-J2",
      mission_id: "MISSION-J2",
    });
    expect(r.correlation.mission_id).toBe("MISSION-J2");
  });

  it("J-3 · mission_id null when omitted", () => {
    const r = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult(),
      cap_id: "CAP-J3",
      mission_id: null,
    });
    expect(r.correlation.mission_id).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Test K · NEX3 with missing input · INSUFFICIENT_INPUT
// ─────────────────────────────────────────────────────────────────────

describe("Test K · NEX3 negative inputs", () => {
  it("K-1 · NEX3 with null nex2_review → INSUFFICIENT_INPUT", () => {
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult(),
      cap_id: "CAP-K1",
      mission_id: null,
    });
    const nex3Comp = nex3ArbitrationCompute({
      proposal: receipt.proposal!,
      cap: makeCap({ cap_id: "CAP-K1" }),
      nex2_review: null,
      nex1_context: null,
    });
    expect(nex3Comp.verdict).toBe("INSUFFICIENT_INPUT");
  });

  it("K-2 · NEX3 with INDEPENDENTLY_VERIFIED review → INSUFFICIENT_INPUT (no conflict)", () => {
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult(),
      cap_id: "CAP-K2",
      mission_id: null,
    });
    const verifiedReview: Nex2ReviewRecord = {
      record_type: "NEX2_REVIEW",
      review_id: "REV-K2",
      proposal_id: receipt.proposal!.proposal_id,
      cap_id: "CAP-K2",
      mission_id: null,
      nex1_context_id: null,
      reviewed_by_agent_id: "nex2-test",
      reviewed_by_instance_id: "inst-K2",
      reviewed_by_public_key_der_hex: "ee".repeat(21),
      reviewed_at: "2026-09-19T13:00:00.000Z",
      verdict: "INDEPENDENTLY_VERIFIED",
      findings: [],
      reason_summary: "clean",
      evidence_ref: null,
      signature_hex: "not-verified-in-this-test",
    };
    const nex3Comp = nex3ArbitrationCompute({
      proposal: receipt.proposal!,
      cap: makeCap({ cap_id: "CAP-K2" }),
      nex2_review: verifiedReview,
      nex1_context: null,
    });
    expect(nex3Comp.verdict).toBe("INSUFFICIENT_INPUT");
  });
});

// ─────────────────────────────────────────────────────────────────────
// Test L · Risk-asymmetry gate proof
// ─────────────────────────────────────────────────────────────────────

describe("Test L · NEX3 risk-asymmetry gate proof", () => {
  it("L-1 · security-critical CAP + critical NEX2 finding → NEX3 REJECT (hard gate)", () => {
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: makeCognitiveResult({ resolver_outcome: "PROPOSE" }),
      cap_id: "CAP-L1-security",
      mission_id: null,
    });
    // NEX2 raised a critical finding on the escalate-only mismatch
    const nex2Review: Nex2ReviewRecord = {
      record_type: "NEX2_REVIEW",
      review_id: "REV-L1",
      proposal_id: receipt.proposal!.proposal_id,
      cap_id: "CAP-L1-security",
      mission_id: null,
      nex1_context_id: null,
      reviewed_by_agent_id: "nex2-test",
      reviewed_by_instance_id: "inst-L1",
      reviewed_by_public_key_der_hex: "ff".repeat(21),
      reviewed_at: "2026-09-19T13:00:00.000Z",
      verdict: "ESCALATE_TO_FOUNDER",
      findings: [{
        kind: "escalate_only_kind_not_escalated",
        severity: "critical",
        detail: "test",
        evidence_ref: null,
      }],
      reason_summary: "test",
      evidence_ref: null,
      signature_hex: "not-verified-in-this-test",
    };
    const nex3Comp = nex3ArbitrationCompute({
      proposal: receipt.proposal!,
      cap: makeCap({
        cap_id: "CAP-L1-security",
        kind: "guardian.te.evidence_source_registry_untrusted",
        category: "SECURITY",
        priority: "CRITICAL",
      }),
      nex2_review: nex2Review,
      nex1_context: null,
    });
    expect(nex3Comp.verdict).toBe("REJECT");
    expect(nex3Comp.signals.some((s) => s.kind === "risk_asymmetry_reject")).toBe(true);
    expect(nex3Comp.reject_score).toBeGreaterThanOrEqual(10000);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Test M · Observability · micro-brain outputs stay with NEX1_NATIVE
// ─────────────────────────────────────────────────────────────────────

describe("Test M · bridge does not carry chat-turn micro-brain signals", () => {
  it("M-1 · bridge input schema has NO field for micro-brain outputs", () => {
    // Structural test: the Nex1NativeCognitiveResult type contains no
    // micro-brain fields. Verify by trying to build one with them —
    // if the type ever changes, this test fails. Runtime: any
    // extraneous field on the input is simply ignored.
    const extraneous = {
      ...makeCognitiveResult(),
      // Extraneous fields must not be persisted on the proposal
      micro_brain_consensus: "UNANIMOUS",
      mb_outcome_quality: "safe_by_prior_evidence",
      cortex_r11b: true,
    };
    const receipt = bridgeNex1NativeToProposal({
      cognitive_result: extraneous as Nex1NativeCognitiveResult,
      cap_id: "CAP-M1",
      mission_id: null,
    });
    expect(receipt.bridged).toBe(true);
    // Proposal should not contain any of those extraneous fields
    const p = receipt.proposal! as unknown as Record<string, unknown>;
    expect(p.micro_brain_consensus).toBeUndefined();
    expect(p.mb_outcome_quality).toBeUndefined();
    expect(p.cortex_r11b).toBeUndefined();
  });
});
