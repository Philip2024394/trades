// src/lib/nex/programmer-review/reviewer.test.ts
//
// NEX Programmer Agent · Phase C · reviewer unit + adversarial tests
// Philip 2026-09-05 · AUTHORIZE §26 §30
//
// Covers:
//   · Verdict derivation rules (V1-V6)
//   · Individual rule checks (R1-R5 + test-quality)
//   · 8-case adversarial matrix A-H
//   · Real defect detection (falsifiable benchmark)
//   · Real NEX slice review
//   · Claude-cannot-self-certify
//   · No production authority
//   · False-positive defence
//   · Uncertainty acceptance

import { describe, it, expect } from "vitest";
import { review } from "./reviewer";
import type { ReviewRequest, Finding } from "./types";
import {
  CASE_A, CASE_B, CASE_C, CASE_D, CASE_E, CASE_F, CASE_G, CASE_H,
  CASE_REAL_NEX, CASE_REAL_DEFECT,
  type FixtureCase,
} from "../../../../tests/fixtures/programmer-review-proof/_phase_c_fixture_cases";

// ─── Helper for building minimal review requests ─────────────────

function baseRequest(overrides: Partial<ReviewRequest> = {}): ReviewRequest {
  return {
    review_id: `rev_test_${Math.random().toString(36).slice(2, 8)}`,
    requirement: "test requirement · function must return X",
    implementation: {
      id: "impl_test",
      files: ["test/file.ts"],
      summary: "test implementation that returns X reliably",
      claim: "returns X reliably",
      claimed_by: "claude",
    },
    tests: { files: ["test/file.test.ts"], passed: 1, failed: 0, summary: "checks return value for X inputs", known_gaps: [] },
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

// ─── Adversarial matrix · all 8 cases (§26 · §30) ─────────────────

describe("§26 · 8-case adversarial matrix · reviewer correctly classifies each", () => {
  const cases: Array<FixtureCase & { note?: string }> = [CASE_A, CASE_B, CASE_C, CASE_D, CASE_E, CASE_F, CASE_G, CASE_H];
  for (const c of cases) {
    it(`Case ${c.case_id} · ${c.label} · expects ${c.expectation.expected_verdict}`, () => {
      const resp = review(c.request);
      expect(resp.verdict, `Case ${c.case_id}: ${c.label}`).toBe(c.expectation.expected_verdict);
      if (c.expectation.expected_finding_categories) {
        const categories = new Set(resp.findings.map((f) => f.category));
        for (const cat of c.expectation.expected_finding_categories) {
          expect(categories.has(cat), `Case ${c.case_id}: expected finding category '${cat}'`).toBe(true);
        }
      }
    });
  }
});

// ─── §22 · real defect · falsifiable benchmark ──────────────────

describe("§22 · real defect detection · falsifiable benchmark", () => {
  it("reviewer catches the rate-limiter defect via test-quality analysis", () => {
    const resp = review(CASE_REAL_DEFECT.request);
    expect(resp.verdict).toBe(CASE_REAL_DEFECT.expectation.expected_verdict);
    const cats = new Set(resp.findings.map((f) => f.category));
    expect(cats.has("test_gap")).toBe(true);
  });
});

// ─── §21 · real NEX slice review ────────────────────────────────

describe("§21 · real NEX slice · P0.3 independent review", () => {
  it("reviewer independently reaches ACCEPT for the P0.3 slice · does not defer to claim", () => {
    const resp = review(CASE_REAL_NEX.request);
    expect(resp.verdict).toBe("ACCEPT");
    // Reasoning trace must include the "claim not authority" annotation
    expect(resp.reasoning_trace.some((s) => /CLAIM not authority/.test(s))).toBe(true);
  });
});

// ─── §4 · reviewer disagrees with Claude when evidence disagrees ─

describe("§4 · reviewer can DISAGREE with Claude", () => {
  it("Claude claims complete + tests pass · but the reviewer detects material evidence gap → NEEDS_CHANGES", () => {
    const req = baseRequest({
      requirement: "handleAuth(req) must validate JWT, enforce role, log audit event.",
      implementation: {
        id: "i",
        files: ["a.ts"],
        summary: "Function returns 200.",
        claim: "Implementation complete · validates JWT · enforces role · logs audit event.",
        claimed_by: "claude",
      },
      tests: { files: ["a.test.ts"], passed: 5, failed: 0, summary: "checks status is 200", known_gaps: [] },
      requirement_details: {
        edge_cases_required: ["missing JWT", "invalid JWT", "role mismatch"],
        edge_cases_covered: [],
        security_requirements: ["JWT validation", "role enforcement"],
        security_violations_observed: [],
      },
    });
    const resp = review(req);
    // Claude said "complete". Reviewer disagrees:
    expect(resp.verdict).not.toBe("ACCEPT");
    expect(["NEEDS_CHANGES", "REJECT"]).toContain(resp.verdict);
  });
});

// ─── §5 · green tests are not proof of correctness ─────────────

describe("§5 · reviewer flags 'tests pass but insufficient' when edge cases uncovered", () => {
  it("passed tests + material uncovered edge case → NEEDS_CHANGES", () => {
    const req = baseRequest({
      requirement: "func must handle X and Y",
      tests: { files: ["t.ts"], passed: 10, failed: 0, summary: "checks X passes", known_gaps: [] },
      requirement_details: {
        edge_cases_required: ["X", "Y"],
        edge_cases_covered: ["X"],
        security_requirements: [],
        security_violations_observed: [],
      },
    });
    const resp = review(req);
    expect(resp.verdict).toBe("NEEDS_CHANGES");
  });
});

// ─── §16 · verdict and confidence are independent ───────────────

describe("§16 · verdict and confidence are separate axes", () => {
  it("UNCERTAIN verdict can have HIGH confidence (confident it's uncertain)", () => {
    const req = baseRequest({
      implementation: { id: "i", files: [], summary: "", claim: "does it", claimed_by: "claude" },
      tests: { files: [], passed: 0, failed: 0, summary: "", known_gaps: [] },
    });
    const resp = review(req);
    expect(resp.verdict).toBe("UNCERTAIN");
    expect(resp.confidence).toBe("high");
  });
});

// ─── §18 · false-positive defence ────────────────────────────────

describe("§18 · false-positive defence · correct-but-unfamiliar code accepted", () => {
  it("Case G · unfamiliar idiom · verdict is ACCEPT (not REJECT)", () => {
    const resp = review(CASE_G.request);
    expect(resp.verdict).toBe("ACCEPT");
    // No CRITICAL findings
    const criticalCount = resp.findings.filter((f) => f.severity === "CRITICAL").length;
    expect(criticalCount).toBe(0);
  });
});

// ─── §19 · uncertainty is a permitted outcome ───────────────────

describe("§19 · reviewer explicitly returns UNCERTAIN when evidence insufficient", () => {
  it("Case H · empty implementation · empty tests · verdict UNCERTAIN", () => {
    const resp = review(CASE_H.request);
    expect(resp.verdict).toBe("UNCERTAIN");
  });
});

// ─── §20 · self-review defence ──────────────────────────────────

describe("§20 · Claude/model self-assessment is not authoritative", () => {
  it("claim of 'I verified this and it is correct' does not automatically produce ACCEPT", () => {
    const req = baseRequest({
      requirement: "func must handle X",
      implementation: {
        id: "i", files: [], summary: "",
        claim: "I verified this implementation and it is correct.",
        claimed_by: "claude",
      },
      tests: { files: [], passed: 0, failed: 0, summary: "", known_gaps: [] },
    });
    const resp = review(req);
    expect(resp.verdict).not.toBe("ACCEPT");
    expect(resp.reasoning_trace.some((s) => /CLAIM not authority/.test(s))).toBe(true);
  });
});

// ─── §24 · no autonomous fixing · reviewer has no side effects ──

describe("§24 · reviewer has NO write authority · pure function", () => {
  it("reviewer module does not export commit/deploy/fix/mutate primitives", async () => {
    const mod = await import("./reviewer");
    const forbidden = ["commit", "push", "deploy", "fix", "mutate", "modifyProduction", "grantAccess", "createWorkforce"];
    for (const f of forbidden) {
      const leak = Object.keys(mod).find((n) => n.toLowerCase().startsWith(f.toLowerCase()));
      expect(leak, `reviewer leaks ${f}*`).toBeUndefined();
    }
  });
});

// ─── §13 · reviewer boundary — Claude cannot self-certify ───────

describe("§13 · Claude cannot self-certify · claimed_by treated as claim not authority", () => {
  it("marks reasoning_trace with 'CLAIM not authority' regardless of claimed_by", () => {
    const req = baseRequest();
    const resp = review(req);
    expect(resp.reasoning_trace.some((s) => /claimed_by=claude · treated as CLAIM not authority/.test(s))).toBe(true);
  });
});

// ─── V2 · verdict-derivation edge cases ────────────────────────

describe("verdict derivation · edge cases", () => {
  it("CRITICAL finding forces REJECT regardless of other signals", () => {
    const req = baseRequest({
      requirement_details: {
        edge_cases_required: [], edge_cases_covered: [],
        security_requirements: [], security_violations_observed: ["clear-text password stored in DB"],
      },
    });
    const resp = review(req);
    expect(resp.verdict).toBe("REJECT");
    expect(resp.confidence).toBe("high");
  });

  it("tests.failed > 0 with no other findings → NEEDS_CHANGES", () => {
    const req = baseRequest({
      tests: { files: ["t.ts"], passed: 3, failed: 2, summary: "checks pass path", known_gaps: [] },
    });
    const resp = review(req);
    expect(resp.verdict).toBe("NEEDS_CHANGES");
  });
});

// ─── Reasoning trace is deterministic and complete ──────────────

describe("reasoning trace · reproducibility", () => {
  it("trace includes every rule name and the FINAL verdict line", () => {
    const req = baseRequest();
    const resp = review(req);
    const traceStr = resp.reasoning_trace.join("\n");
    expect(traceStr).toContain("R1 requirement_mismatch");
    expect(traceStr).toContain("R2 security");
    expect(traceStr).toContain("R3 unsupported_claim");
    expect(traceStr).toContain("R4 runtime_evidence");
    expect(traceStr).toContain("R5 test_quality");
    expect(traceStr).toMatch(/FINAL verdict=/);
  });
});

// ─── §11 · knowledge reuse (integrates Phase B) ────────────────

describe("§11 · reviewer can reference Phase B knowledge (opt-in via relevant_knowledge_ids)", () => {
  it("empty relevant_knowledge_ids → knowledge_used=[]", () => {
    const req = baseRequest();
    const resp = review(req);
    expect(resp.knowledge_used).toEqual([]);
  });
  it("nonexistent id → knowledge_used=[] (no crash · quiet skip)", () => {
    const req = baseRequest({ relevant_knowledge_ids: ["know_nonexistent"] });
    const resp = review(req);
    expect(resp.knowledge_used).toEqual([]);
  });
});
