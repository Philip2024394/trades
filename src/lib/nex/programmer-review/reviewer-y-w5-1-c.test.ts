// src/lib/nex/programmer-review/reviewer-y-w5-1-c.test.ts
//
// NEX Programmer Agent · Phase C · Y-W5-1-C surgical extension tests
// Philip 2026-09-07 · AUTHORIZE Y-W5-1-C · surgical Phase C connection
//
// Purpose:
//   Prove exactly when knowledge CAN and CANNOT affect the verdict
//   under the Y-W5-1-C surgical extension. Knowledge is ADDITIVE ONLY
//   — it can add a MATERIAL finding that pushes ACCEPT → NEEDS_CHANGES,
//   but it cannot override rule-derived safety verdicts, cannot bypass
//   evidence-gap detection, and cannot become an uncontrolled authority.
//
// This test file is isolated from the main reviewer.test.ts to make
// the Y-W5-1-C connection self-contained and auditable.

import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Isolate this test's knowledge store in a fresh tmp dir
process.env.NEX_PROGRAMMER_LEARNING_DIR = mkdtempSync(path.join(tmpdir(), "nex-y-w5-1-c-"));

import { appendKnowledge } from "../programmer-learning/store";
import type { KnowledgeItem } from "../programmer-learning/types";
import { review } from "./reviewer";
import type { ReviewRequest } from "./types";

// ─── Fixture helpers ────────────────────────────────────────────

function baseRequest(overrides: Partial<ReviewRequest> = {}): ReviewRequest {
  // Baseline clean network-domain request: worded so that R1-R5 produce
  // ZERO findings, giving a pure ACCEPT baseline that R6 can then
  // additively modify. The word "network" is present for R6 domain-
  // relevance testing.
  return {
    review_id: `rev_yw5c_${Math.random().toString(36).slice(2, 8)}`,
    requirement: "the helper should perform a network call.",
    implementation: {
      id: "impl_net_helper",
      files: ["src/net/helper.ts"],
      summary: "network helper that performs the call and returns the result payload with success and error handling.",
      claim: "performs network call",
      claimed_by: "claude",
    },
    tests: {
      files: ["src/net/helper.test.ts"],
      passed: 3,
      failed: 0,
      summary: "checks that the network call performs correctly across success, error, and empty payload inputs.",
      known_gaps: [],
    },
    runtime_evidence: [],
    requirement_details: {
      edge_cases_required: [],
      edge_cases_covered: [],
      security_requirements: [],
      security_violations_observed: [],
    },
    ...overrides,
  };
}

function makeKnowledge(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
  const id = overrides.knowledge_id ?? `know_yw5c_${Math.random().toString(36).slice(2, 10)}`;
  return {
    knowledge_id: id,
    statement: "For network calls the implementation must include retry with exponential backoff and must handle timeout.",
    domain: "network",
    technology: "network.resilience",
    provenance: {
      source: "test-authoritative-source",
      source_type: "external_documentation",
      source_url: null,
      authority_tier: "TIER_1",
      retrieved_at: new Date().toISOString(),
      evidence_pointer: "test-fixture",
      observed_by: "system",
    },
    verification_status: "VERIFIED",
    confidence: 0.9,
    content_hash: `hash_${id}`,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Y-W5-1-C · Test 1 · No knowledge → existing behaviour unchanged ─

describe("Y-W5-1-C · Test 1 · no knowledge preserves existing behaviour", () => {
  it("no relevant_knowledge_ids → verdict identical to pre-extension expectation (ACCEPT for happy path)", () => {
    const req = baseRequest();
    const resp = review(req);
    expect(resp.verdict).toBe("ACCEPT");
    expect(resp.knowledge_used).toEqual([]);
    // R6 should record zero knowledge findings in the reasoning trace
    expect(resp.reasoning_trace.some((s) => s.includes("R6 knowledge_patterns → +0 finding(s)"))).toBe(true);
  });
});

// ─── Y-W5-1-C · Test 2 · Relevant VERIFIED knowledge participates in verdict ─

describe("Y-W5-1-C · Test 2 · relevant VERIFIED knowledge with unmet required pattern → NEEDS_CHANGES", () => {
  it("knowledge stating 'must include retry with backoff' + request lacking backoff → adds MATERIAL finding → verdict flips ACCEPT → NEEDS_CHANGES", () => {
    const k = makeKnowledge({
      statement: "For network calls the implementation must include retry with exponential backoff.",
    });
    appendKnowledge(k);
    const req = baseRequest({ relevant_knowledge_ids: [k.knowledge_id] });
    const resp = review(req);
    expect(resp.verdict).toBe("NEEDS_CHANGES");
    expect(resp.knowledge_used).toContain(k.knowledge_id);
    // A knowledge finding must exist and pin the knowledge_id in its evidence_pointer
    const kFinding = resp.findings.find((f) => f.evidence_pointer.includes(k.knowledge_id));
    expect(kFinding).toBeDefined();
    expect(kFinding!.severity).toBe("MATERIAL");
    expect(kFinding!.category).toBe("insufficient_evidence");
  });
});

// ─── Y-W5-1-C · Test 3 · Irrelevant knowledge does NOT change verdict ─

describe("Y-W5-1-C · Test 3 · irrelevant knowledge (domain mismatch) → no effect on verdict", () => {
  it("knowledge in domain 'postgres' + request about 'network' → knowledge is consulted but produces no finding → verdict unchanged (ACCEPT)", () => {
    const k = makeKnowledge({
      statement: "Postgres queries must use parameterized statements.",
      domain: "postgres",
      technology: "postgres.security",
    });
    appendKnowledge(k);
    const req = baseRequest({ relevant_knowledge_ids: [k.knowledge_id] });
    const resp = review(req);
    expect(resp.verdict).toBe("ACCEPT");
    // Knowledge appears in knowledge_used (audit) but produced NO finding
    expect(resp.knowledge_used).toContain(k.knowledge_id);
    const kFindings = resp.findings.filter((f) => f.evidence_pointer.includes(k.knowledge_id));
    expect(kFindings.length).toBe(0);
  });
});

// ─── Y-W5-1-C · Test 4 · UNVERIFIED knowledge cannot bypass safety model ─

describe("Y-W5-1-C · Test 4 · UNVERIFIED or low-confidence knowledge is inspected for audit only, NEVER affects verdict", () => {
  it("UNVERIFIED knowledge with strong 'must' statement → NO finding fires → verdict unchanged", () => {
    const k = makeKnowledge({
      statement: "For network calls the implementation must include timeout.",
      verification_status: "DISCOVERED", // NOT VERIFIED
    });
    appendKnowledge(k);
    const req = baseRequest({ relevant_knowledge_ids: [k.knowledge_id] });
    const resp = review(req);
    expect(resp.verdict).toBe("ACCEPT");
    const kFindings = resp.findings.filter((f) => f.evidence_pointer.includes(k.knowledge_id));
    expect(kFindings.length).toBe(0);
  });

  it("low-confidence knowledge (< 0.7) → NO finding fires → verdict unchanged", () => {
    const k = makeKnowledge({
      statement: "For network calls the implementation must include timeout.",
      confidence: 0.5, // BELOW threshold
    });
    appendKnowledge(k);
    const req = baseRequest({ relevant_knowledge_ids: [k.knowledge_id] });
    const resp = review(req);
    expect(resp.verdict).toBe("ACCEPT");
    const kFindings = resp.findings.filter((f) => f.evidence_pointer.includes(k.knowledge_id));
    expect(kFindings.length).toBe(0);
  });
});

// ─── Y-W5-1-C · Test 5 · Determinism · same inputs → same verdict ─

describe("Y-W5-1-C · Test 5 · deterministic: same findings + same knowledge = same verdict", () => {
  it("running the same review twice with same knowledge yields identical verdict + finding count", () => {
    const k = makeKnowledge({
      statement: "For network calls the implementation must include retry with backoff.",
    });
    appendKnowledge(k);
    const req = baseRequest({ relevant_knowledge_ids: [k.knowledge_id] });
    const r1 = review(req);
    const r2 = review(req);
    expect(r1.verdict).toBe(r2.verdict);
    expect(r1.findings.length).toBe(r2.findings.length);
    expect(r1.knowledge_used).toEqual(r2.knowledge_used);
  });
});

// ─── Y-W5-1-C · Test 6 · Auditability · knowledge_used still recorded ─

describe("Y-W5-1-C · Test 6 · auditability: knowledge_used remains recorded in response", () => {
  it("consulted knowledge always appears in knowledge_used regardless of whether it produced a finding", () => {
    const k = makeKnowledge({
      // Statement that does NOT contain a "must have" pattern → will not fire a finding
      statement: "This is an observation about network patterns.",
    });
    appendKnowledge(k);
    const req = baseRequest({ relevant_knowledge_ids: [k.knowledge_id] });
    const resp = review(req);
    expect(resp.knowledge_used).toContain(k.knowledge_id);
    const kFindings = resp.findings.filter((f) => f.evidence_pointer.includes(k.knowledge_id));
    expect(kFindings.length).toBe(0);
  });
});

// ─── Y-W5-1-C · Test 7 · Knowledge cannot bypass safety rules ─

describe("Y-W5-1-C · Test 7 · knowledge CANNOT override rule-derived safety verdicts", () => {
  it("R2 CRITICAL security finding + present knowledge → verdict remains REJECT (V1 wins)", () => {
    const k = makeKnowledge({
      statement: "This system is safe.",
      confidence: 1.0,
    });
    appendKnowledge(k);
    const req = baseRequest({
      relevant_knowledge_ids: [k.knowledge_id],
      requirement_details: {
        edge_cases_required: [],
        edge_cases_covered: [],
        security_requirements: [],
        security_violations_observed: ["SQL injection allowed in query parameter"],
      },
    });
    const resp = review(req);
    // R2 fires CRITICAL security finding → V1 forces REJECT regardless of any knowledge
    expect(resp.verdict).toBe("REJECT");
  });

  it("V2 evidence gap (no tests + no runtime) + knowledge present → verdict remains UNCERTAIN", () => {
    const k = makeKnowledge({
      statement: "For network calls the implementation must include retry.",
    });
    appendKnowledge(k);
    const req = baseRequest({
      relevant_knowledge_ids: [k.knowledge_id],
      tests: { files: [], passed: 0, failed: 0, summary: "", known_gaps: [] },
      runtime_evidence: [],
    });
    const resp = review(req);
    // V2 wins BEFORE any knowledge finding could push toward NEEDS_CHANGES
    expect(resp.verdict).toBe("UNCERTAIN");
  });
});

// ─── Y-W5-1-C · Test 8 · Anti-self-reinforcement: verdict is derived, never manipulated ─

describe("Y-W5-1-C · Test 8 · knowledge is ADDITIVE only · findings only accumulate", () => {
  it("existing MATERIAL rule finding + relevant knowledge with no pattern violation → verdict remains NEEDS_CHANGES, knowledge does not REMOVE the rule finding", () => {
    const k = makeKnowledge({
      // Statement without a "must" pattern → no knowledge finding
      statement: "Network calls are often reliable.",
    });
    appendKnowledge(k);
    const req = baseRequest({
      relevant_knowledge_ids: [k.knowledge_id],
      // Setup that forces a MATERIAL requirement_mismatch or test_gap:
      requirement: "must delete records that are expired.",
      implementation: {
        id: "i",
        files: [],
        summary: "does something",
        claim: "does something",
        claimed_by: "claude",
      },
      tests: { files: [], passed: 1, failed: 0, summary: "checks that something is done", known_gaps: [] },
    });
    const resp = review(req);
    // Expect at least one MATERIAL finding from rules (R1 requirement_mismatch)
    const materials = resp.findings.filter((f) => f.severity === "MATERIAL");
    expect(materials.length).toBeGreaterThan(0);
    // Verdict must be at least NEEDS_CHANGES · knowledge cannot downgrade it
    expect(["NEEDS_CHANGES", "REJECT"]).toContain(resp.verdict);
  });
});
