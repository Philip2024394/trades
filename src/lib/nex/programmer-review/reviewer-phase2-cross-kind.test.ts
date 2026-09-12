// src/lib/nex/programmer-review/reviewer-phase2-cross-kind.test.ts
//
// Phase 2 · Cross-kind extension · R7 (skill) + R8 (experience) tests
// Philip 2026-09-07 · AUTHORIZE Phase 2

import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.NEX_PROGRAMMER_LEARNING_DIR = mkdtempSync(path.join(tmpdir(), "nex-phase2-test-"));

import { appendSkill, appendExperience } from "../programmer-learning/store";
import type { SkillItem, ExperienceItem } from "../programmer-learning/types";
import { review } from "./reviewer";
import type { ReviewRequest } from "./types";

function baseRequest(overrides: Partial<ReviewRequest> = {}): ReviewRequest {
  return {
    review_id: `rev_p2_${Math.random().toString(36).slice(2, 8)}`,
    requirement: "the security helper should validate user input.",
    implementation: {
      id: "impl_p2_test",
      files: ["src/security/helper.ts"],
      summary: "security helper that validates the user input and returns the sanitized payload for downstream consumers.",
      claim: "validates input",
      claimed_by: "claude",
    },
    tests: {
      files: ["src/security/helper.test.ts"],
      passed: 3,
      failed: 0,
      summary: "checks that the security helper validates and returns sanitized payload across success and rejection paths.",
      known_gaps: [],
    },
    runtime_evidence: [],
    requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
    ...overrides,
  };
}

function makeSkill(overrides: Partial<SkillItem> = {}): SkillItem {
  const id = overrides.skill_id ?? `skill_p2_${Math.random().toString(36).slice(2, 10)}`;
  return {
    skill_id: id,
    name: "validate untrusted input against allowlist",
    domain: "security",
    description: "The skill of validating untrusted input by matching against an allowlist rather than a blocklist.",
    verification_recipe: "Skill requires the implementation must include allowlist matching and must include reject unknown inputs.",
    confidence: 0.9,
    promotion_state: "VERIFIED",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeExperience(overrides: Partial<ExperienceItem> = {}): ExperienceItem {
  const id = overrides.experience_id ?? `exp_p2_${Math.random().toString(36).slice(2, 10)}`;
  return {
    experience_id: id,
    task: "security helper input validation for booking system",
    initial_hypothesis: "allowlist matching would prevent SQL injection",
    action_taken: "implemented allowlist-based input validation",
    files_involved: ["src/security/helper.ts"],
    expected_result: "no SQL injection possible via user input",
    actual_result: "allowlist matching prevented all injection attempts in tests",
    evidence: ["test-log-1", "test-log-2", "test-log-3"],
    outcome: "success",
    lessons: [
      "For untrusted input the implementation must include allowlist matching and must include reject unknown patterns and must include audit trail on rejection.",
    ],
    timestamp: new Date().toISOString(),
    provenance: {
      source: "test-experience",
      source_type: "internal_test",
      source_url: null,
      authority_tier: "TIER_1",
      retrieved_at: new Date().toISOString(),
      evidence_pointer: "test-fixture",
      observed_by: "system",
    },
    ...overrides,
  };
}

// ─── R7 tests ────────────────────────────────────────────────────

describe("Phase 2 · R7 skill patterns · no skill → existing behaviour unchanged", () => {
  it("no relevant_skill_ids → verdict identical to pre-Phase-2 expectation", () => {
    const req = baseRequest();
    const resp = review(req);
    expect(resp.verdict).toBe("ACCEPT");
    expect(resp.skills_used).toEqual([]);
  });
});

describe("Phase 2 · R7 · VERIFIED skill with unmet check → NEEDS_CHANGES", () => {
  it("verified skill about allowlist matching + request lacking allowlist → adds MATERIAL finding · flips ACCEPT → NEEDS_CHANGES", () => {
    const s = makeSkill();
    appendSkill(s);
    const req = baseRequest({ relevant_skill_ids: [s.skill_id] });
    const resp = review(req);
    expect(resp.verdict).toBe("NEEDS_CHANGES");
    expect(resp.skills_used).toContain(s.skill_id);
    const skillFinding = resp.findings.find((f) => f.evidence_pointer.includes(s.skill_id));
    expect(skillFinding).toBeDefined();
    expect(skillFinding!.severity).toBe("MATERIAL");
  });
});

describe("Phase 2 · R7 · non-VERIFIED skill → no finding fires", () => {
  it("PRACTICED skill (not yet VERIFIED) does not affect verdict", () => {
    const s = makeSkill({ promotion_state: "PRACTICED" });
    appendSkill(s);
    const req = baseRequest({ relevant_skill_ids: [s.skill_id] });
    const resp = review(req);
    expect(resp.verdict).toBe("ACCEPT");
    const skillFindings = resp.findings.filter((f) => f.evidence_pointer.includes(s.skill_id));
    expect(skillFindings.length).toBe(0);
  });

  it("low-confidence skill (<0.7) does not affect verdict", () => {
    const s = makeSkill({ confidence: 0.5 });
    appendSkill(s);
    const req = baseRequest({ relevant_skill_ids: [s.skill_id] });
    const resp = review(req);
    expect(resp.verdict).toBe("ACCEPT");
    const skillFindings = resp.findings.filter((f) => f.evidence_pointer.includes(s.skill_id));
    expect(skillFindings.length).toBe(0);
  });
});

describe("Phase 2 · R7 · domain mismatch → no effect", () => {
  it("skill in domain 'postgres' + request about 'security' → no finding", () => {
    const s = makeSkill({ domain: "postgres" });
    appendSkill(s);
    const req = baseRequest({ relevant_skill_ids: [s.skill_id] });
    const resp = review(req);
    expect(resp.verdict).toBe("ACCEPT");
    const skillFindings = resp.findings.filter((f) => f.evidence_pointer.includes(s.skill_id));
    expect(skillFindings.length).toBe(0);
  });
});

describe("Phase 2 · R7 cannot bypass CRITICAL safety verdict", () => {
  it("R2 CRITICAL security violation + relevant skill → verdict remains REJECT", () => {
    const s = makeSkill();
    appendSkill(s);
    const req = baseRequest({
      relevant_skill_ids: [s.skill_id],
      requirement_details: {
        edge_cases_required: [], edge_cases_covered: [], security_requirements: [],
        security_violations_observed: ["SQL injection allowed in query parameter"],
      },
    });
    const resp = review(req);
    expect(resp.verdict).toBe("REJECT");
  });
});

// ─── R8 tests ────────────────────────────────────────────────────

describe("Phase 2 · R8 experience patterns · no experience → existing behaviour unchanged", () => {
  it("no relevant_experience_ids → verdict identical to pre-Phase-2 expectation", () => {
    const req = baseRequest();
    const resp = review(req);
    expect(resp.verdict).toBe("ACCEPT");
    expect(resp.experiences_used).toEqual([]);
  });
});

describe("Phase 2 · R8 · SUCCESS experience with lesson-derived required pattern → NEEDS_CHANGES", () => {
  it("success experience about input validation booking + request in same domain lacking pattern → adds MATERIAL finding", () => {
    const e = makeExperience();
    appendExperience(e);
    const req = baseRequest({ relevant_experience_ids: [e.experience_id] });
    const resp = review(req);
    expect(resp.verdict).toBe("NEEDS_CHANGES");
    expect(resp.experiences_used).toContain(e.experience_id);
    const expFinding = resp.findings.find((f) => f.evidence_pointer.includes(e.experience_id));
    expect(expFinding).toBeDefined();
    expect(expFinding!.severity).toBe("MATERIAL");
  });
});

describe("Phase 2 · R8 · thin experience (evidence < 2) → no finding fires", () => {
  it("experience with only 1 evidence pointer does not fire", () => {
    const e = makeExperience({ evidence: ["only-one-pointer"] });
    appendExperience(e);
    const req = baseRequest({ relevant_experience_ids: [e.experience_id] });
    const resp = review(req);
    expect(resp.verdict).toBe("ACCEPT");
    const expFindings = resp.findings.filter((f) => f.evidence_pointer.includes(e.experience_id));
    expect(expFindings.length).toBe(0);
  });
});

describe("Phase 2 · R8 · unrelated task text (relevance < 2 word overlap) → no finding fires", () => {
  it("experience about completely different domain does not fire", () => {
    const e = makeExperience({
      task: "postgres schema migration for legacy tenant data",
      lessons: ["For legacy migrations the implementation must include batch commits and must include rollback safety."],
    });
    appendExperience(e);
    const req = baseRequest({ relevant_experience_ids: [e.experience_id] });
    const resp = review(req);
    expect(resp.verdict).toBe("ACCEPT");
    const expFindings = resp.findings.filter((f) => f.evidence_pointer.includes(e.experience_id));
    expect(expFindings.length).toBe(0);
  });
});

describe("Phase 2 · R8 cannot bypass CRITICAL safety verdict", () => {
  it("R2 CRITICAL + relevant experience → verdict remains REJECT", () => {
    const e = makeExperience();
    appendExperience(e);
    const req = baseRequest({
      relevant_experience_ids: [e.experience_id],
      requirement_details: {
        edge_cases_required: [], edge_cases_covered: [], security_requirements: [],
        security_violations_observed: ["XSS vector observed in output"],
      },
    });
    const resp = review(req);
    expect(resp.verdict).toBe("REJECT");
  });
});

// ─── Auditability ────────────────────────────────────────────────

describe("Phase 2 · auditability · skills_used + experiences_used recorded on response", () => {
  it("consulted skill always appears in skills_used", () => {
    const s = makeSkill({ description: "observation-only skill", verification_recipe: "" });
    appendSkill(s);
    const req = baseRequest({ relevant_skill_ids: [s.skill_id] });
    const resp = review(req);
    expect(resp.skills_used).toContain(s.skill_id);
  });

  it("consulted experience always appears in experiences_used", () => {
    const e = makeExperience({ lessons: ["observation-only lesson without required pattern"] });
    appendExperience(e);
    const req = baseRequest({ relevant_experience_ids: [e.experience_id] });
    const resp = review(req);
    expect(resp.experiences_used).toContain(e.experience_id);
  });
});
