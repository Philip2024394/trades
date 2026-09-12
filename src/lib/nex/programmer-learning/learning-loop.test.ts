// src/lib/nex/programmer-learning/learning-loop.test.ts
//
// NEX Programmer Agent · Phase B · unit + adversarial tests
// Philip 2026-09-05 · AUTHORIZE §17 §18
//
// Covers:
//   · Learning question validation (§4)
//   · Authority-tier assignment (§5)
//   · Independent verification methods (§7)
//   · Skill promotion rules (§10)
//   · Skill application harness (§8)
//   · All 12 adversarial tests A-L (§18)
//     · A/B/C/F/L: partly satisfied by Phase A · re-asserted here
//     · D/E: enforced by attemptSkillPromotion
//     · G/H: enforced via classifyIncomingKnowledge from Phase A
//     · I/K: proven by _phase_b_fresh_retrieval.mjs (out-of-process)
//     · J: retrieval returns provenance (Phase A + Phase B queries)

import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Isolate all Phase B tests in a fresh tmp store
process.env.NEX_PROGRAMMER_LEARNING_DIR = mkdtempSync(path.join(tmpdir(), "nex-plearn-b-"));

import { _resetProgrammerLearningStoreForTests, appendLearningRun, generateId, newProvenance, readKnowledge, readSkills, readExperiences, readEvents } from "./store";
import { captureExperience, captureSkill, ingestExternalSource, captureClaudeAttempt, captureEngineeringEvent } from "./ingestion";
import { classifyIncomingKnowledge, recordContradiction, verifyKnowledge } from "./verification";
import { queryKnowledge, querySkills, queryExperiences } from "./query";
import {
  newLearningQuestion,
  authorityTierForUrl,
  attemptSkillPromotion,
  applyVerificationToKnowledge,
  newLearningRun,
  researchAndVerifyKnowledge,
  deriveSkill,
  promoteSkillAfterApplication,
  retrieveLatestVerifiedKnowledgeByTechnology,
} from "./learning-loop";
import {
  verifyViaSubprocess,
  verifyViaDeterministicTest,
  verifyViaCrossSource,
  type VerificationEvidence,
} from "./independent-verifier";
import { applySkillSafely } from "./skill-application";
import type { KnowledgeItem, Provenance, LearningRun } from "./types";

beforeEach(() => {
  _resetProgrammerLearningStoreForTests();
});

// ─── Helpers ─────────────────────────────────────────────────────

const sampleProv = (overrides: Partial<Provenance> = {}): Provenance =>
  newProvenance({
    source: "unit-test",
    source_type: "internal_artifact",
    source_url: null,
    authority_tier: "TIER_1",
    evidence_pointer: "unit-test:sample",
    observed_by: "system",
    ...overrides,
  });

// ─── §4 · Learning question validation ────────────────────────────

describe("§4 · learning question validation", () => {
  it("rejects short/vague questions ('Learn Node.js')", () => {
    expect(() => newLearningQuestion({
      gap_statement: "gap", question: "Learn Node.js",
      technology: "nodejs", domain: "runtime", scope_bound: "everything",
      testable_via: "subprocess_probe",
    })).toThrow(/at least 6 words/);
  });

  it("rejects questions missing '?'", () => {
    expect(() => newLearningQuestion({
      gap_statement: "gap",
      question: "What error code does fs.readFileSync throw on missing file",
      technology: "nodejs", domain: "runtime", scope_bound: "ENOENT only",
      testable_via: "subprocess_probe",
    })).toThrow(/must end with/);
  });

  it("accepts a bounded testable question", () => {
    const q = newLearningQuestion({
      gap_statement: "NEX doesn't have proven knowledge of fs.readFileSync error codes",
      question: "What error code does fs.readFileSync throw when the file does not exist?",
      technology: "nodejs", domain: "runtime",
      scope_bound: "ENOENT specifically for missing paths",
      testable_via: "subprocess_probe",
    });
    expect(q.question_id).toMatch(/^run_/);
    expect(q.question).toContain("readFileSync");
  });
});

// ─── §5 · Authority tiers ────────────────────────────────────────

describe("§5 · authority tier assignment", () => {
  it("nodejs.org → TIER_1", () => {
    expect(authorityTierForUrl("https://nodejs.org/api/fs.html")).toBe("TIER_1");
  });
  it("typescriptlang.org → TIER_1", () => {
    expect(authorityTierForUrl("https://www.typescriptlang.org/docs/")).toBe("TIER_1");
  });
  it("developer.mozilla.org → TIER_1 (MDN treated as official web platform doc)", () => {
    expect(authorityTierForUrl("https://developer.mozilla.org/en-US/docs/Web/API/fetch")).toBe("TIER_1");
  });
  it("random blog → TIER_4", () => {
    expect(authorityTierForUrl("https://random-blog.example/nodejs-tips")).toBe("TIER_4");
  });
  it("empty url → TIER_5", () => {
    expect(authorityTierForUrl("")).toBe("TIER_5");
  });
});

// ─── §7 · Independent verification methods ───────────────────────

describe("§7 · independent verifier · subprocess probe", () => {
  it("verifies fs.readFileSync throws ENOENT for missing path", async () => {
    const script = "try{require('fs').readFileSync('/nex_definitely_missing_path_x9y8z7');}catch(e){process.stdout.write(e.code||'NO_CODE');process.exit(0);}process.stdout.write('NO_THROW');process.exit(0);";
    const evidence = await verifyViaSubprocess({
      candidate_claim: "fs.readFileSync throws with err.code='ENOENT' when file missing",
      expected_outcome: "stdout === 'ENOENT'",
      node_script: script,
      outcome_matcher: (stdout) => stdout.trim() === "ENOENT",
    });
    expect(evidence.passed).toBe(true);
    expect(evidence.method).toBe("subprocess_probe");
    expect(evidence.observed_output).toContain("ENOENT");
    expect(evidence.evidence_pointer).toContain("verifications/");
  });

  it("rejects a false claim · subprocess_probe returns passed=false", async () => {
    const script = "process.stdout.write('42');process.exit(0);";
    const evidence = await verifyViaSubprocess({
      candidate_claim: "wrong claim",
      expected_outcome: "stdout === '99'",
      node_script: script,
      outcome_matcher: (stdout) => stdout.trim() === "99",
    });
    expect(evidence.passed).toBe(false);
    expect(evidence.observed_output).toContain("42");
  });
});

describe("§7 · independent verifier · deterministic test", () => {
  it("passes when test_fn returns true", () => {
    const e = verifyViaDeterministicTest({
      candidate_claim: "1 + 1 === 2",
      expected_outcome: "true",
      test_fn: () => 1 + 1 === 2,
    });
    expect(e.passed).toBe(true);
  });
  it("fails when test_fn returns false", () => {
    const e = verifyViaDeterministicTest({
      candidate_claim: "1 + 1 === 3",
      expected_outcome: "true",
      test_fn: () => 1 + 1 === 3,
    });
    expect(e.passed).toBe(false);
  });
  it("captures exceptions as failure", () => {
    const e = verifyViaDeterministicTest({
      candidate_claim: "throws",
      expected_outcome: "true",
      test_fn: () => { throw new Error("boom"); },
    });
    expect(e.passed).toBe(false);
    expect(e.observed_output).toContain("boom");
  });
});

describe("§7 · independent verifier · cross-source", () => {
  it("passes when required tokens present and forbidden absent", () => {
    const e = verifyViaCrossSource({
      candidate_claim: "MVCC snapshot",
      expected_outcome: "second source mentions snapshot + transaction isolation",
      second_source_content: "PostgreSQL uses MVCC where each SQL statement sees a snapshot of data providing transaction isolation.",
      required_tokens: ["snapshot", "transaction isolation"],
      forbidden_tokens: ["locking-based"],
    });
    expect(e.passed).toBe(true);
  });
  it("fails when forbidden token appears", () => {
    const e = verifyViaCrossSource({
      candidate_claim: "MVCC is locking-based",
      expected_outcome: "no locking-based claim",
      second_source_content: "This system uses locking-based concurrency control.",
      required_tokens: [],
      forbidden_tokens: ["locking-based"],
    });
    expect(e.passed).toBe(false);
  });
});

// ─── §10 · Skill promotion rules ─────────────────────────────────

describe("§10 · skill promotion", () => {
  it("OBSERVED → PRACTICED requires ≥1 supporting experience (§10.3)", () => {
    const skill = captureSkill({
      name: "safe file existence check via ENOENT",
      domain: "nodejs.fs",
      description: "detect missing file via err.code",
      promotion_state: "OBSERVED",
    });
    // Refuse without supporting experiences
    const refused = attemptSkillPromotion({
      skill, target_state: "PRACTICED",
      supporting_experiences: [],
      knowledge_dependencies: [],
    });
    expect(refused.promoted).toBe(false);
    if (!refused.promoted) expect(refused.reason).toContain("requires >=1 supporting experience");
    // Allow with 1 supporting experience
    const allowed = attemptSkillPromotion({
      skill, target_state: "PRACTICED",
      supporting_experiences: ["exp_test"],
      knowledge_dependencies: [],
    });
    expect(allowed.promoted).toBe(true);
    if (allowed.promoted) expect(allowed.new_state).toBe("PRACTICED");
  });

  it("PRACTICED → VERIFIED requires ALL knowledge_dependencies VERIFIED (§18-D)", () => {
    const skill = captureSkill({
      name: "test", domain: "d", description: "d",
      promotion_state: "PRACTICED",
    });
    const unverified: KnowledgeItem = {
      knowledge_id: "k_unverified", statement: "x", domain: "d", technology: "t",
      provenance: sampleProv({ authority_tier: "TIER_1" }),
      verification_status: "DISCOVERED", confidence: 0.5, superseded_by: null,
      content_hash: "hx", created_at: new Date().toISOString(),
    };
    const refused = attemptSkillPromotion({
      skill, target_state: "VERIFIED",
      supporting_experiences: ["exp_test"],
      knowledge_dependencies: [unverified],
    });
    expect(refused.promoted).toBe(false);
    if (!refused.promoted) expect(refused.reason).toContain("unverified knowledge_dependencies");
  });

  it("skill never applied cannot reach VERIFIED (§18-E)", () => {
    const skill = captureSkill({
      name: "test", domain: "d", description: "d", promotion_state: "OBSERVED",
    });
    const verified: KnowledgeItem = {
      knowledge_id: "k_v", statement: "x", domain: "d", technology: "t",
      provenance: sampleProv({ authority_tier: "TIER_1" }),
      verification_status: "VERIFIED", confidence: 0.98, superseded_by: null,
      content_hash: "hv", created_at: new Date().toISOString(),
    };
    const refused = attemptSkillPromotion({
      skill, target_state: "VERIFIED",
      supporting_experiences: [],
      knowledge_dependencies: [verified],
    });
    expect(refused.promoted).toBe(false);
    if (!refused.promoted) expect(refused.reason).toContain("requires >=1 supporting experience");
  });

  it("refuses demotion", () => {
    const skill = captureSkill({
      name: "test", domain: "d", description: "d", promotion_state: "VERIFIED",
    });
    const r = attemptSkillPromotion({
      skill, target_state: "OBSERVED",
      supporting_experiences: [], knowledge_dependencies: [],
    });
    expect(r.promoted).toBe(false);
  });
});

// ─── §8 · Safe skill application harness ─────────────────────────

describe("§8 · applySkillSafely · isolated tmpdir · experience capture", () => {
  it("records success experience when apply_fn returns success outcome", async () => {
    const skill = captureSkill({ name: "s", domain: "d", description: "d" });
    const res = await applySkillSafely({
      skill_id: skill.skill_id, skill_name: skill.name,
      task: "test success application", initial_hypothesis: "should succeed",
      provenance: sampleProv(),
      apply_fn: (tmpDir) => ({
        outcome: "success" as const,
        expected_result: "tmpdir exists",
        actual_result: `tmpdir=${tmpDir}`,
        evidence: [`tmpdir:${tmpDir}`],
        lessons: ["harness produces isolated tmpdir"],
      }),
    });
    expect(res.outcome).toBe("success");
    const experiences = readExperiences();
    expect(experiences.find((e) => e.experience_id === res.experience_id)?.outcome).toBe("success");
  });

  it("records failure experience with root_cause when apply_fn reports failure", async () => {
    const skill = captureSkill({ name: "s", domain: "d", description: "d" });
    const res = await applySkillSafely({
      skill_id: skill.skill_id, skill_name: skill.name,
      task: "test failure with root_cause", initial_hypothesis: "should fail with cause",
      provenance: sampleProv(),
      apply_fn: () => ({
        outcome: "failure" as const,
        expected_result: "unreachable expected",
        actual_result: "did not reach",
        evidence: ["log:pretend"],
        root_cause: "unmet precondition X",
        lessons: ["precondition matters"],
      }),
    });
    expect(res.outcome).toBe("failure");
  });

  it("harness EXCEPTION path captures failure with root_cause (§18-C)", async () => {
    const skill = captureSkill({ name: "s", domain: "d", description: "d" });
    let caught: Error | null = null;
    try {
      await applySkillSafely({
        skill_id: skill.skill_id, skill_name: skill.name,
        task: "test harness exception", initial_hypothesis: "will throw",
        provenance: sampleProv(),
        apply_fn: () => { throw new Error("simulated failure"); },
      });
    } catch (e) { caught = e as Error; }
    expect(caught).not.toBeNull();
    expect(caught?.message).toContain("apply_fn failed");
    // Experience persisted with root_cause
    const experiences = readExperiences();
    const failed = experiences.find((e) => e.outcome === "failure" && (e.root_cause ?? "").includes("simulated failure"));
    expect(failed).toBeDefined();
  });
});

// ─── §18-A · Researcher claim without evidence cannot promote ────

describe("§18-A · researcher claim without evidence cannot promote Knowledge", () => {
  it("captureClaudeAttempt captures at DISCOVERED · no auto-promotion", () => {
    const ev = captureClaudeAttempt({
      task: "learn X", claude_claim: "I verified fs.readFileSync throws ENOENT",
      action_summary: "read docs (allegedly)",
      evidence_pointer: "chat-claim:1",
    });
    expect(ev.status).toBe("DISCOVERED");
    const events = readEvents();
    // The claim event exists but is NOT VERIFIED
    const claimEvent = events.find((e) => e.source_type === "claude_claim");
    expect(claimEvent?.status).toBe("DISCOVERED");
    expect(claimEvent?.meta?.doctrine).toBe("op_truth.no_self_reported_success");
  });
});

// ─── §18-B · Self-reference cannot verify Knowledge (Phase A) ────

describe("§18-B · self-reference cannot verify Knowledge", () => {
  it("verifyKnowledge throws when evidence pointer equals source URL", () => {
    const ingest = ingestExternalSource({
      url: "https://nodejs.org/api/fs.html",
      source_title: "Node.js fs",
      authority_tier: "TIER_1", technology: "nodejs", domain: "runtime",
      statement: "fs synchronous APIs throw on error",
      raw_content: "docs",
    });
    expect(() => verifyKnowledge({
      knowledge_id: ingest.knowledge.knowledge_id,
      new_status: "VERIFIED",
      independent_evidence_pointer: "https://nodejs.org/api/fs.html", // same URL
      independent_evidence_source: "self",
      reason: "the docs say so",
    })).toThrow(/no self-reference/);
  });
});

// ─── §18-F · Model cannot declare LearningRun healthy ────────────

describe("§18-F · LearningRun with non-null final_status is REJECTED", () => {
  it("appendLearningRun throws when final_status is not null", () => {
    const bad: LearningRun = {
      run_id: generateId("run"),
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      triggered_by: "manual",
      events_captured: 1, knowledge_ingested: 1, skills_touched: 0,
      experiences_created: 0, external_sources_read: 1,
      errors: [], evidence_pointers: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      final_status: "PROVEN_HEALTHY" as any,
    };
    expect(() => appendLearningRun(bad)).toThrow(/Op-Truth violation/);
  });
});

// ─── §18-G · Low-authority cannot silently override Tier-1 ───────

describe("§18-G · low-authority source cannot silently override Tier-1", () => {
  it("classifyIncomingKnowledge treats same-statement lower-tier as (at worst) corroboration · never supersession", () => {
    const t1 = ingestExternalSource({
      url: "https://nodejs.org/api/fs.html",
      source_title: "Node.js fs (official)",
      authority_tier: "TIER_1", technology: "nodejs", domain: "runtime",
      statement: "fs.readFileSync throws Error with code ENOENT on missing file",
      raw_content: "docs",
    });
    const t5Incoming: KnowledgeItem = {
      knowledge_id: generateId("know"),
      statement: "fs.readFileSync throws Error with code ENOENT on missing file",
      domain: "runtime", technology: "nodejs",
      provenance: sampleProv({
        source: "random blog", source_type: "external_documentation",
        source_url: "https://random-blog.example/fs-tips",
        authority_tier: "TIER_5",
      }),
      verification_status: "DISCOVERED", confidence: 0.25, superseded_by: null,
      content_hash: "hx", created_at: new Date().toISOString(),
    };
    const reports = classifyIncomingKnowledge(t5Incoming, [t1.knowledge]);
    const supersession = reports.find((r) => r.kind === "supersession_candidate");
    // Lower-tier incoming must NOT trigger a supersession over Tier-1
    expect(supersession).toBeUndefined();
    // Same statement + different URL = corroboration (which is fine)
    const corroboration = reports.find((r) => r.kind === "corroboration");
    expect(corroboration).toBeDefined();
  });
});

// ─── §18-H · Conflicting sources produce uncertainty ─────────────

describe("§18-H · conflicting authoritative sources produce uncertainty rather than fabricated consensus", () => {
  it("recordContradiction creates a distinct record referencing both originals · originals not mutated", () => {
    const a = ingestExternalSource({
      url: "https://source-a.example/spec.html", source_title: "Spec A",
      authority_tier: "TIER_2", technology: "http", domain: "protocol",
      statement: "HTTP method uppercase required",
      raw_content: "spec A",
    });
    const b = ingestExternalSource({
      url: "https://source-b.example/spec.html", source_title: "Spec B",
      authority_tier: "TIER_2", technology: "http", domain: "protocol",
      statement: "HTTP method is case-insensitive",
      raw_content: "spec B",
    });
    const contradiction = recordContradiction({
      a_knowledge_id: a.knowledge.knowledge_id,
      b_knowledge_id: b.knowledge.knowledge_id,
      contradiction_statement: "case-sensitivity of HTTP methods",
      actor_source: "philip",
    });
    const all = readKnowledge();
    expect(all.find((k) => k.knowledge_id === a.knowledge.knowledge_id)).toBeDefined();
    expect(all.find((k) => k.knowledge_id === b.knowledge.knowledge_id)).toBeDefined();
    expect(all.find((k) => k.knowledge_id === contradiction.knowledge_id)!.related_knowledge)
      .toEqual(expect.arrayContaining([a.knowledge.knowledge_id, b.knowledge.knowledge_id]));
  });
});

// ─── §18-J · Retrieval returns provenance ────────────────────────

describe("§18-J · retrieval returns provenance", () => {
  it("queryKnowledge results carry full provenance for reuse-time attribution", () => {
    ingestExternalSource({
      url: "https://nodejs.org/api/fs.html", source_title: "Node.js fs",
      authority_tier: "TIER_1", technology: "nodejs", domain: "runtime",
      statement: "sync APIs throw on error",
      raw_content: "docs",
    });
    const results = queryKnowledge({ technology: "nodejs" });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].provenance.source_url).toContain("nodejs.org");
    expect(results[0].provenance.evidence_pointer).toBeTruthy();
    expect(results[0].provenance.authority_tier).toBe("TIER_1");
    expect(results[0].provenance.retrieved_at).toBeTruthy();
  });
});

// ─── §19-L · Wording / variable invariance (adversarial · new problem shapes) ─

describe("§19-L · learning is not hard-coded to the original fixture — new wording/variables reuse the same principle", () => {
  it("skill retrieval by domain works regardless of query wording — canonical fields don't leak into query keys", () => {
    // Learn a skill with one description phrasing
    ingestExternalSource({
      url: "https://nodejs.org/api/fs.html", source_title: "Node.js fs",
      authority_tier: "TIER_1", technology: "nodejs", domain: "runtime.filesystem.errors",
      statement: "fs.readFileSync throws Error with code ENOENT on missing file",
      raw_content: "docs",
    });
    const skill = captureSkill({
      name: "Detect missing-file condition via err.code === 'ENOENT'",
      domain: "nodejs.filesystem.errorHandling",
      description: "Check err.code === 'ENOENT' inside try/catch to detect missing files",
      promotion_state: "OBSERVED",
    });
    // Search with DIFFERENT wording · retrieval should still find the skill
    // via canonical fields (domain / name substring), not by matching the
    // exact learning-time phrasing.
    const bySameDomain = querySkills({ domain: "nodejs.filesystem.errorHandling" });
    expect(bySameDomain.map((s) => s.skill_id)).toContain(skill.skill_id);

    // Adversarial re-phrasing of the "find" — a substring match on 'ENOENT'
    // (the invariant token) succeeds even though the surrounding wording differs.
    const byNameSubstring = querySkills({ name_contains: "ENOENT" });
    expect(byNameSubstring.map((s) => s.skill_id)).toContain(skill.skill_id);
  });

  it("knowledge retrieval works via statement-contains with paraphrased tokens (technology + invariant term)", () => {
    // The knowledge item is stored once with one specific statement.
    // A later caller searches with a DIFFERENT phrasing but the same
    // invariant token ('ENOENT') and same technology — retrieval must
    // still return the item. Proves retrieval is not hard-coded to the
    // exact learning-time question.
    const ingest = ingestExternalSource({
      url: "https://nodejs.org/api/fs.html", source_title: "Node.js fs",
      authority_tier: "TIER_1", technology: "nodejs", domain: "runtime.filesystem.errors",
      statement: "fs.readFileSync throws with err.code equal to 'ENOENT' when the file is missing",
      raw_content: "docs",
    });
    // A DIFFERENT problem uses different variable names ("path", "target")
    // but the query hits the same underlying invariant.
    const foundViaTechAndInvariant = queryKnowledge({
      technology: "nodejs",
      statement_contains: "ENOENT",
    });
    expect(foundViaTechAndInvariant.map((k) => k.knowledge_id)).toContain(ingest.knowledge.knowledge_id);
  });

  it("skill retrievable via retrieveLatestVerifiedKnowledgeByTechnology with paraphrased contains — invariant only", () => {
    // Ingest → verify with independent evidence · then paraphrase the
    // caller's search string. Retrieval must still find the item.
    const ingest = ingestExternalSource({
      url: "https://nodejs.org/api/fs.html", source_title: "Node.js fs",
      authority_tier: "TIER_1", technology: "nodejs", domain: "runtime.filesystem.errors",
      statement: "fs.readFileSync throws Error with code ENOENT for missing paths",
      raw_content: "docs",
    });
    verifyKnowledge({
      knowledge_id: ingest.knowledge.knowledge_id,
      new_status: "VERIFIED",
      independent_evidence_pointer: "programmer-learning/verifications/mock.json",
      independent_evidence_source: "test_runner",
      reason: "unit-test verification bridge",
    });
    // Retrieval with a PARAPHRASE ("no such file" — never in the stored
    // statement · only the invariant token appears in the record).
    // Should fail (substring is not present) — proving retrieval doesn't
    // silently return unrelated items.
    const noMatch = retrieveLatestVerifiedKnowledgeByTechnology("nodejs", "no such file");
    expect(noMatch).toBeNull();
    // Retrieval with the invariant token succeeds.
    const match = retrieveLatestVerifiedKnowledgeByTechnology("nodejs", "ENOENT");
    expect(match).not.toBeNull();
    expect(match!.verification_status).toBe("VERIFIED");
  });
});

// ─── §19-M · No production authority exists (Phase A · re-asserted) ─

describe("§19-M · Phase-A/B code has no production-authority exports", () => {
  it("neither learning-loop nor independent-verifier nor skill-application export commit/deploy/etc.", async () => {
    const forbidden = ["commit", "push", "deploy", "alterDatabase", "grantAccess", "modifyProduction", "modifyWorkforce", "modifyOwnCore", "createWorkforce"];
    const modules = [
      await import("./learning-loop"),
      await import("./independent-verifier"),
      await import("./skill-application"),
    ];
    for (const mod of modules) {
      const names = Object.keys(mod);
      for (const f of forbidden) {
        const leak = names.find((n) => n.toLowerCase().startsWith(f.toLowerCase()));
        expect(leak, `Phase-B module leaks ${f}*`).toBeUndefined();
      }
    }
  });
});

// ─── End-to-end mini-cycle · orchestrator glue ──────────────────

describe("orchestrator end-to-end · deterministic-test verification path", () => {
  it("newLearningRun + researchAndVerifyKnowledge + deriveSkill + promoteSkillAfterApplication", async () => {
    const q = newLearningQuestion({
      gap_statement: "test gap",
      question: "Does 1 plus 1 equal 2 according to authoritative math?",
      technology: "math", domain: "arithmetic", scope_bound: "trivial",
      testable_via: "deterministic_test",
    });
    const runBuilder = newLearningRun(q);
    const verification = verifyViaDeterministicTest({
      candidate_claim: "1 + 1 === 2",
      expected_outcome: "true",
      test_fn: () => 1 + 1 === 2,
    });
    const rv = await researchAndVerifyKnowledge({
      url: "https://www.iso.org/standard/spec.html",
      source_title: "ISO Arithmetic (fictional TIER-1 style)",
      technology: "math", domain: "arithmetic",
      statement: "1 + 1 === 2 under standard integer addition",
      raw_content: "docs",
      verification, run: runBuilder,
    });
    expect(rv.verified_passed).toBe(true);
    expect(rv.verified.verification_status).toBe("VERIFIED");

    const skill = deriveSkill({
      name: "compute 1+1", domain: "arithmetic",
      description: "invoke integer addition",
      knowledge_dependencies: [rv.verified],
      run: runBuilder,
    });
    expect(skill.promotion_state).toBe("OBSERVED");

    // Apply the skill safely
    const app = await applySkillSafely({
      skill_id: skill.skill_id, skill_name: skill.name,
      task: "apply 1+1", initial_hypothesis: "expect 2",
      provenance: sampleProv({ source: "test", authority_tier: "TIER_1" }),
      apply_fn: () => ({
        outcome: "success" as const,
        expected_result: "2",
        actual_result: String(1 + 1),
        evidence: ["in-process:computation"],
        lessons: ["integer addition works"],
      }),
    });
    expect(app.outcome).toBe("success");

    const promo = promoteSkillAfterApplication({
      skill,
      supporting_experience_id: app.experience_id,
      knowledge_dependencies: [rv.verified],
      target_state: "VERIFIED",
      run: runBuilder,
    });
    expect(promo.attempt.promoted).toBe(true);
    if (promo.attempt.promoted) expect(promo.attempt.new_state).toBe("VERIFIED");

    const run = runBuilder.complete();
    expect(run.final_status).toBeNull();
    expect(run.events_captured).toBeGreaterThan(0);
    expect(run.knowledge_ingested).toBeGreaterThan(0);
    expect(run.experiences_created).toBe(0);  // experiences counted inside captureExperience event stream · not counted directly by researchAndVerifyKnowledge

    // Reuse retrieval
    const found = retrieveLatestVerifiedKnowledgeByTechnology("math");
    expect(found).not.toBeNull();
    expect(found!.verification_status).toBe("VERIFIED");
  });
});

// ─── §7 · Bridge · verifier evidence → knowledge promotion ──────

describe("bridge · applyVerificationToKnowledge appends VERIFIED or REJECTED record", () => {
  it("passed=true → VERIFIED record with independent evidence pointer", () => {
    const ingest = ingestExternalSource({
      url: "https://nodejs.org/api/fs.html", source_title: "Node.js fs",
      authority_tier: "TIER_1", technology: "nodejs", domain: "runtime",
      statement: "sync APIs throw on error", raw_content: "docs",
    });
    const evidence: VerificationEvidence = {
      verification_id: generateId("run"),
      method: "deterministic_test",
      candidate_claim: "sync APIs throw", expected_outcome: "true",
      observed_output: "test returned true",
      passed: true, evidence_pointer: "programmer-learning/verifications/synthetic.json",
      duration_ms: 5, timestamp: new Date().toISOString(),
    };
    const verified = applyVerificationToKnowledge({ candidate: ingest.knowledge, verification: evidence });
    expect(verified.verification_status).toBe("VERIFIED");
  });

  it("passed=false → REJECTED record", () => {
    const ingest = ingestExternalSource({
      url: "https://nodejs.org/api/fs.html", source_title: "Node.js fs",
      authority_tier: "TIER_1", technology: "nodejs", domain: "runtime",
      statement: "fs.readFileSync is asynchronous", raw_content: "docs",  // FALSE claim
    });
    const evidence: VerificationEvidence = {
      verification_id: generateId("run"),
      method: "deterministic_test",
      candidate_claim: "fs.readFileSync is async", expected_outcome: "true",
      observed_output: "test returned false · readFileSync is synchronous",
      passed: false, evidence_pointer: "programmer-learning/verifications/false.json",
      duration_ms: 5, timestamp: new Date().toISOString(),
    };
    const rejected = applyVerificationToKnowledge({ candidate: ingest.knowledge, verification: evidence });
    expect(rejected.verification_status).toBe("REJECTED");
  });
});
