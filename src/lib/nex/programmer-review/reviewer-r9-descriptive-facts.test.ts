// src/lib/nex/programmer-review/reviewer-r9-descriptive-facts.test.ts
//
// R9 · Knowledge-derived DESCRIPTIVE-FACT pattern gap · M2 fix · 2026-09-08
// Founder-authorized concurrent work while V.5.4.3-002 runs.
//
// K_c1 statement: "fs.readFileSync(directoryPath) throws EISDIR"
// Prior state: Milestone 2 stayed 🟡 PARTIAL because R6 (prescriptive-only)
// couldn't recognize descriptive "X throws Y" statements. R9 closes the gap.
//
// Test matrix mirrors reviewer-y-w5-1-c.test.ts discipline:
//   · relevant + verified + high-conf + fn mentioned + no handling → NEEDS_CHANGES
//   · same knowledge but request evidences handling → ACCEPT (finding suppressed)
//   · same knowledge but domain mismatch → ACCEPT (irrelevant)
//   · UNVERIFIED → ACCEPT (safety gate)
//   · low confidence → ACCEPT (bounded knowledge only)
//   · determinism · same inputs → same verdict
//   · passive variant "EISDIR is thrown by fs.readFileSync" → NEEDS_CHANGES
//   · TypeError / ENOENT extraction variants both fire

import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Isolate this test's knowledge store in a fresh tmp dir
process.env.NEX_PROGRAMMER_LEARNING_DIR = mkdtempSync(path.join(tmpdir(), "nex-r9-descfact-"));

import { appendKnowledge } from "../programmer-learning/store";
import type { KnowledgeItem } from "../programmer-learning/types";
import { review } from "./reviewer";
import type { ReviewRequest } from "./types";

// ─── Fixture helpers ────────────────────────────────────────────

function fsRequest(overrides: Partial<ReviewRequest> = {}): ReviewRequest {
  // Baseline: implementation that calls fs.readFileSync. Summaries share
  // distinctive terms so R3 (unsupported_claim) does not fire · tests summary
  // mentions negative/error coverage so R5 (test_weakness) does not fire ·
  // R4 (runtime_evidence) is satisfied by including a runtime_evidence entry.
  // Result: R1-R5 clean → pure ACCEPT baseline that R9 can additively modify.
  // The word "nodejs" appears so R9 domain-relevance gate matches k.domain="nodejs.fs".
  return {
    review_id: `rev_r9_${Math.random().toString(36).slice(2, 8)}`,
    requirement: "read a config file from disk for the nodejs app.",
    implementation: {
      id: "impl_config_loader",
      files: ["src/config/loader.ts"],
      summary: "config loader uses fs.readFileSync to read the config file and returns the parsed payload for the nodejs app.",
      claim: "loads config via fs.readFileSync",
      claimed_by: "claude",
    },
    tests: {
      files: ["src/config/loader.test.ts"],
      passed: 3,
      failed: 0,
      summary: "loader tests exercise fs.readFileSync across success, error, and boundary payload inputs for the nodejs app.",
      known_gaps: [],
    },
    runtime_evidence: ["ran loader integration once against a valid config path"],
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
  const id = overrides.knowledge_id ?? `know_r9_${Math.random().toString(36).slice(2, 10)}`;
  return {
    knowledge_id: id,
    statement: "fs.readFileSync(directoryPath) throws EISDIR",   // K_c1 shape
    domain: "nodejs.fs",
    technology: "node",
    provenance: {
      source: "node-fs-docs",
      source_type: "external_documentation",
      source_url: null,
      authority_tier: "TIER_1",
      retrieved_at: new Date().toISOString(),
      evidence_pointer: "https://nodejs.org/api/fs.html",
      observed_by: "system",
    },
    verification_status: "VERIFIED",
    confidence: 0.95,
    content_hash: `hash_${id}`,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// § M2 CLOSURE · K_c1 shape now influences verdicts
// ═══════════════════════════════════════════════════════════════════

describe("R9 · descriptive-fact pattern gap · closes Milestone 2 for K_c1 shape", () => {

  it("K_c1-shape knowledge (VERIFIED, high-conf) + request mentions fs.readFileSync + NO error handling → NEEDS_CHANGES", () => {
    const k = makeKnowledge();
    appendKnowledge(k);
    const req = fsRequest({ relevant_knowledge_ids: [k.knowledge_id] });
    const resp = review(req);
    expect(resp.verdict).toBe("NEEDS_CHANGES");
    expect(resp.knowledge_used).toContain(k.knowledge_id);
    const finding = resp.findings.find((f) => f.evidence_pointer.includes(k.knowledge_id));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("MATERIAL");
    expect(finding!.category).toBe("insufficient_evidence");
    expect(finding!.message).toContain("fs.readFileSync");
    expect(finding!.message).toContain("EISDIR");
  });

  it("K_c1-shape knowledge + request shows explicit EISDIR handling → NO finding · verdict ACCEPT", () => {
    const k = makeKnowledge();
    appendKnowledge(k);
    // Override BOTH summaries in lock-step so R3 (unsupported_claim) does not fire on drifted terms.
    const req = fsRequest({
      relevant_knowledge_ids: [k.knowledge_id],
      implementation: {
        id: "impl_config_loader",
        files: ["src/config/loader.ts"],
        summary: "config loader uses fs.readFileSync and explicitly handles EISDIR when a directory path is passed for the nodejs app.",
        claim: "loads config with EISDIR handling",
        claimed_by: "claude",
      },
      tests: {
        files: ["src/config/loader.test.ts"],
        passed: 3, failed: 0,
        summary: "loader tests exercise fs.readFileSync across success, error, boundary payloads and explicitly cover the EISDIR handling directory path branch for the nodejs app.",
        known_gaps: [],
      },
    });
    const resp = review(req);
    expect(resp.verdict).toBe("ACCEPT");
    const findings = resp.findings.filter((f) => f.evidence_pointer.includes(k.knowledge_id));
    expect(findings.length).toBe(0);
  });

  it("K_c1-shape knowledge + request shows generic try/catch → NO finding · verdict ACCEPT (generic handling suppresses R9)", () => {
    const k = makeKnowledge();
    appendKnowledge(k);
    const req = fsRequest({
      relevant_knowledge_ids: [k.knowledge_id],
      implementation: {
        id: "impl_config_loader",
        files: ["src/config/loader.ts"],
        summary: "config loader uses fs.readFileSync wrapped in a try/catch that surfaces errors to the caller for the nodejs app.",
        claim: "loads config with try/catch",
        claimed_by: "claude",
      },
      tests: {
        files: ["src/config/loader.test.ts"],
        passed: 3, failed: 0,
        summary: "loader tests exercise fs.readFileSync inside a try/catch across success, error, and boundary payload inputs for the nodejs app.",
        known_gaps: [],
      },
    });
    const resp = review(req);
    expect(resp.verdict).toBe("ACCEPT");
    const findings = resp.findings.filter((f) => f.evidence_pointer.includes(k.knowledge_id));
    expect(findings.length).toBe(0);
  });

  it("K_c1-shape knowledge + request does NOT mention fs.readFileSync at all → NO finding · verdict ACCEPT (fn-mention gate)", () => {
    const k = makeKnowledge();
    appendKnowledge(k);
    const req = fsRequest({
      relevant_knowledge_ids: [k.knowledge_id],
      implementation: {
        id: "impl_other",
        files: ["src/other.ts"],
        summary: "nodejs helper that operates on strings only, no filesystem access.",
        claim: "string helper",
        claimed_by: "claude",
      },
      tests: {
        files: ["src/other.test.ts"],
        passed: 3, failed: 0,
        summary: "nodejs helper tests exercise the string operates path across success, error, and boundary inputs.",
        known_gaps: [],
      },
    });
    const resp = review(req);
    expect(resp.verdict).toBe("ACCEPT");
    const findings = resp.findings.filter((f) => f.evidence_pointer.includes(k.knowledge_id));
    expect(findings.length).toBe(0);
  });

  it("K_c1-shape knowledge in domain 'postgres' + request about nodejs.fs → domain mismatch · NO finding · ACCEPT", () => {
    const k = makeKnowledge({ domain: "postgres", technology: "postgres" });
    appendKnowledge(k);
    const req = fsRequest({ relevant_knowledge_ids: [k.knowledge_id] });
    const resp = review(req);
    expect(resp.verdict).toBe("ACCEPT");
    const findings = resp.findings.filter((f) => f.evidence_pointer.includes(k.knowledge_id));
    expect(findings.length).toBe(0);
  });

  it("UNVERIFIED K_c1-shape → NO finding (safety gate) · ACCEPT", () => {
    const k = makeKnowledge({ verification_status: "DISCOVERED" });
    appendKnowledge(k);
    const req = fsRequest({ relevant_knowledge_ids: [k.knowledge_id] });
    const resp = review(req);
    expect(resp.verdict).toBe("ACCEPT");
    const findings = resp.findings.filter((f) => f.evidence_pointer.includes(k.knowledge_id));
    expect(findings.length).toBe(0);
  });

  it("low-confidence K_c1-shape (<0.7) → NO finding · ACCEPT", () => {
    const k = makeKnowledge({ confidence: 0.5 });
    appendKnowledge(k);
    const req = fsRequest({ relevant_knowledge_ids: [k.knowledge_id] });
    const resp = review(req);
    expect(resp.verdict).toBe("ACCEPT");
    const findings = resp.findings.filter((f) => f.evidence_pointer.includes(k.knowledge_id));
    expect(findings.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § R9 · additional descriptive-fact variants
// ═══════════════════════════════════════════════════════════════════

describe("R9 · descriptive-fact extraction variants", () => {

  it("passive form 'EISDIR is thrown by fs.readFileSync' also fires", () => {
    const k = makeKnowledge({
      statement: "EISDIR is thrown by fs.readFileSync when the argument is a directory path.",
    });
    appendKnowledge(k);
    const req = fsRequest({ relevant_knowledge_ids: [k.knowledge_id] });
    const resp = review(req);
    expect(resp.verdict).toBe("NEEDS_CHANGES");
    const finding = resp.findings.find((f) => f.evidence_pointer.includes(k.knowledge_id));
    expect(finding).toBeDefined();
    expect(finding!.message).toContain("EISDIR");
  });

  it("'X can throw Y' variant fires", () => {
    const k = makeKnowledge({
      statement: "fs.readFileSync can throw ENOENT when the file does not exist.",
    });
    appendKnowledge(k);
    const req = fsRequest({ relevant_knowledge_ids: [k.knowledge_id] });
    const resp = review(req);
    expect(resp.verdict).toBe("NEEDS_CHANGES");
    const finding = resp.findings.find((f) => f.evidence_pointer.includes(k.knowledge_id));
    expect(finding).toBeDefined();
    expect(finding!.message).toContain("ENOENT");
  });

  it("TypeError-family error name is extracted", () => {
    const k = makeKnowledge({
      statement: "JSON.parse throws SyntaxError when the input is not valid JSON.",
      domain: "nodejs.json",
    });
    appendKnowledge(k);
    const req = fsRequest({
      relevant_knowledge_ids: [k.knowledge_id],
      requirement: "parse a json config for the nodejs app.",
      implementation: {
        id: "impl_json_parse",
        files: ["src/config/parser.ts"],
        summary: "config parser calls JSON.parse on the raw string and returns the parsed object with success paths.",
        claim: "parses via JSON.parse",
        claimed_by: "claude",
      },
    });
    const resp = review(req);
    expect(resp.verdict).toBe("NEEDS_CHANGES");
    const finding = resp.findings.find((f) => f.evidence_pointer.includes(k.knowledge_id));
    expect(finding).toBeDefined();
    expect(finding!.message).toContain("SyntaxError");
  });

  it("determinism: same input yields identical finding count + verdict", () => {
    const k = makeKnowledge();
    appendKnowledge(k);
    const req = fsRequest({ relevant_knowledge_ids: [k.knowledge_id] });
    const r1 = review(req);
    const r2 = review(req);
    expect(r1.verdict).toBe(r2.verdict);
    expect(r1.findings.length).toBe(r2.findings.length);
  });

  it("reasoning trace includes explicit R9 line", () => {
    const k = makeKnowledge();
    appendKnowledge(k);
    const req = fsRequest({ relevant_knowledge_ids: [k.knowledge_id] });
    const resp = review(req);
    expect(resp.reasoning_trace.some((s) => s.includes("R9 knowledge_descriptive_facts"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § R9 · non-fire cases (statement without extractable pair · no drift)
// ═══════════════════════════════════════════════════════════════════

describe("R9 · non-fire cases · additive-only discipline preserved", () => {

  it("purely prescriptive statement with no descriptive-fact pattern does NOT fire R9", () => {
    // "must handle EISDIR" is prescriptive · R6 territory. R6 may or may
    // not fire depending on its stopword filter (which drops "the eisdir"
    // shape); either way R9 MUST NOT fire because there is no throws/raises
    // verb linking a function name to an error identifier.
    const k = makeKnowledge({
      statement: "For fs operations the implementation must call handleEisdir when a directory is passed.",
    });
    appendKnowledge(k);
    const req = fsRequest({ relevant_knowledge_ids: [k.knowledge_id] });
    const resp = review(req);
    // R9 finding messages start with "Knowledge-derived descriptive-fact gap"
    const r9Findings = resp.findings.filter((f) =>
      f.evidence_pointer.includes(k.knowledge_id) &&
      f.message.startsWith("Knowledge-derived descriptive-fact gap"),
    );
    expect(r9Findings.length).toBe(0);
  });

  it("statement without any recognisable (fn, err) pair → NO R9 finding", () => {
    const k = makeKnowledge({
      statement: "Node.js filesystem operations are synchronous when using the Sync variants.",
    });
    appendKnowledge(k);
    const req = fsRequest({ relevant_knowledge_ids: [k.knowledge_id] });
    const resp = review(req);
    expect(resp.verdict).toBe("ACCEPT");
    const findings = resp.findings.filter((f) => f.evidence_pointer.includes(k.knowledge_id));
    expect(findings.length).toBe(0);
  });
});
