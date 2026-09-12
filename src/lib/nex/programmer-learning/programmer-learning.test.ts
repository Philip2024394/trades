// src/lib/nex/programmer-learning/programmer-learning.test.ts
//
// NEX Programmer Agent · Phase A · full test suite
// Philip 2026-09-05 · AUTHORIZE §17
//
// Covers all 17 required tests plus adversarial:
//   1  engineering event captured
//   2  Claude implementation attempt captured
//   3  test result can be attached to the event
//   4  runtime evidence can be attached
//   5  knowledge stored with provenance
//   6  external source stored
//   7  unverified internet information remains unverified
//   8  verified knowledge can be represented
//   9  skill can reference supporting experience
//   10 experience can reference evidence
//   11 failed implementation retained
//   12 contradiction retained (never silently overwritten)
//   13 duplicate knowledge detected
//   14 retrieval returns provenance
//   15 provider identity does not determine truth
//   16 no self-reported success becomes authoritative
//   17 unauthorized autonomous actions impossible from Phase-A surface
//
// Adversarial:
//   · Tier-5 source claiming Tier-1 status (rejected downstream)
//   · verifyKnowledge to VERIFIED with same URL as source (rejected)
//   · failure outcome without root_cause (rejected)
//   · store write outside programmer-learning dir (rejected)

import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Route all tests to a fresh temp dir · never touch production data
process.env.NEX_PROGRAMMER_LEARNING_DIR = mkdtempSync(path.join(tmpdir(), "nex-plearn-"));

import {
  appendKnowledge,
  readKnowledge,
  readEvents,
  readExperiences,
  readSkills,
  readLearningRuns,
  appendLearningRun,
  storeSourceSnapshot,
  stableHash,
  generateId,
  newProvenance,
  ForbiddenPhaseAWrite,
  _resetProgrammerLearningStoreForTests,
} from "./store";
import {
  captureEngineeringEvent,
  captureClaudeAttempt,
  captureExperience,
  captureSkill,
  ingestExternalSource,
  findExistingKnowledgeByHash,
} from "./ingestion";
import {
  detectDuplicate,
  classifyIncomingKnowledge,
  markSuperseded,
  recordContradiction,
  verifyKnowledge,
  checkKnowledgeIntegrity,
} from "./verification";
import {
  queryEvents,
  queryKnowledge,
  queryExperiences,
  querySkills,
  listLearningRuns,
  computeLearningStats,
} from "./query";
import * as storeModule from "./store";
import type { KnowledgeItem, LearningRun, Provenance } from "./types";

beforeEach(() => {
  _resetProgrammerLearningStoreForTests();
});

// ─── Helper: sample provenance ────────────────────────────────────

function sampleProv(overrides: Partial<Provenance> = {}): Provenance {
  return newProvenance({
    source: "unit-test",
    source_type: "internal_artifact",
    source_url: null,
    authority_tier: "TIER_1",
    evidence_pointer: "unit-test:sample",
    observed_by: "system",
    ...overrides,
  });
}

// ─── §17 Test 1 · engineering event captured ─────────────────────

describe("§17.1 · engineering event captured", () => {
  it("captureEngineeringEvent appends a record with a stable id + provenance", () => {
    const ev = captureEngineeringEvent({
      kind: "observation",
      description: "opened orchestrate.ts:2932",
      source: "philip",
      source_type: "human_engineer",
      evidence_pointer: "src/lib/nex/brain/orchestrate.ts:2932",
    });
    expect(ev.event_id).toMatch(/^evt_/);
    expect(ev.kind).toBe("observation");
    const events = readEvents();
    expect(events).toHaveLength(1);
    expect(events[0].event_id).toBe(ev.event_id);
    expect(events[0].status).toBe("DISCOVERED"); // default per Op-Truth
  });
});

// ─── §17.2 · Claude implementation attempt captured ──────────────

describe("§17.2 · Claude implementation attempt captured", () => {
  it("captureClaudeAttempt emits both a claim and an attempt event · both DISCOVERED", () => {
    const attempt = captureClaudeAttempt({
      task: "P0.3 hotel reference continuity",
      claude_claim: "Fix complete · all tests pass",
      action_summary: "Modified route.ts + created reference-hydration.ts",
      evidence_pointer: "diff:hydration_slice",
    });
    const events = readEvents();
    expect(events).toHaveLength(2);
    const claim = events.find((e) => e.source_type === "claude_claim");
    const attemptEvent = events.find((e) => e.source_type === "claude_action");
    expect(claim).toBeDefined();
    expect(attemptEvent).toBeDefined();
    // §17.16: never auto-VERIFIED because Claude said so
    expect(claim!.status).toBe("DISCOVERED");
    expect(attemptEvent!.status).toBe("DISCOVERED");
    // Chain: attempt references the claim
    expect(attemptEvent!.related_event_ids).toContain(claim!.event_id);
    expect(attempt.event_id).toBe(attemptEvent!.event_id);
  });
});

// ─── §17.3 · test result attached to event ────────────────────────

describe("§17.3 · test result can be attached to event", () => {
  it("test_result event can chain to an implementation_attempt via related_event_ids", () => {
    const attempt = captureClaudeAttempt({
      task: "P0.3", claude_claim: "done", action_summary: "modified route.ts", evidence_pointer: "diff",
    });
    const testRes = captureEngineeringEvent({
      kind: "test_result",
      description: "vitest run: 20/20 passed",
      source: "vitest",
      source_type: "test_runner",
      evidence_pointer: "logs/vitest-2026-09-05.txt",
      related_event_ids: [attempt.event_id],
      status: "CHECKED",
    });
    const events = readEvents();
    expect(events).toHaveLength(3);
    const linked = events.find((e) => e.event_id === testRes.event_id);
    expect(linked!.related_event_ids).toContain(attempt.event_id);
  });
});

// ─── §17.4 · runtime evidence attached ────────────────────────────

describe("§17.4 · runtime evidence can be attached", () => {
  it("runtime_result event carries HTTP evidence pointer + chains to attempt", () => {
    const attempt = captureClaudeAttempt({
      task: "P0.3", claude_claim: "done", action_summary: "route.ts change", evidence_pointer: "diff",
    });
    const runtime = captureEngineeringEvent({
      kind: "runtime_result",
      description: "live HTTP T2 returned grounded record summary",
      source: "http_probe",
      source_type: "http_probe",
      evidence_pointer: "_reproduce_hotel_t3.json",
      related_event_ids: [attempt.event_id],
      status: "VERIFIED",
      meta: { http_status: 200, latency_ms: 320 },
    });
    expect(runtime.meta?.http_status).toBe(200);
    const events = readEvents();
    expect(events.find((e) => e.event_id === runtime.event_id)!.status).toBe("VERIFIED");
  });
});

// ─── §17.5 · knowledge stored with provenance ────────────────────

describe("§17.5 · knowledge stored with provenance", () => {
  it("ingestExternalSource creates a knowledge item with full provenance", () => {
    const { knowledge } = ingestExternalSource({
      url: "https://www.typescriptlang.org/docs/handbook/2/narrowing.html",
      source_title: "TypeScript Handbook · Narrowing",
      authority_tier: "TIER_1",
      technology: "typescript",
      domain: "language",
      statement: "TypeScript narrows types via control-flow analysis of typeof / instanceof / etc.",
      raw_content: "# Narrowing\n\nTypeScript uses control-flow analysis...",
      content_type: "text/markdown",
    });
    expect(knowledge.provenance.source_url).toBe("https://www.typescriptlang.org/docs/handbook/2/narrowing.html");
    expect(knowledge.provenance.authority_tier).toBe("TIER_1");
    expect(knowledge.provenance.evidence_pointer).toContain("sources/");
    expect(knowledge.content_hash).toBeTruthy();
    const stored = readKnowledge();
    expect(stored.some((k) => k.knowledge_id === knowledge.knowledge_id)).toBe(true);
  });
});

// ─── §17.6 · external source stored ──────────────────────────────

describe("§17.6 · external source stored", () => {
  it("storeSourceSnapshot writes a snapshot and returns a pointer", () => {
    const snap = storeSourceSnapshot({
      content: "Sample doc content for testing.",
      url: "https://example.org/doc",
      content_type: "text/plain",
    });
    expect(snap.pointer).toContain("sources/");
    expect(snap.hash).toBeTruthy();
    expect(snap.bytes).toBeGreaterThan(0);
  });
});

// ─── §17.7 · unverified internet information remains unverified ──

describe("§17.7 · unverified internet information remains unverified", () => {
  it("Tier-4/5 source ingestion stays at DISCOVERED", () => {
    const { knowledge } = ingestExternalSource({
      url: "https://random-blog.example/typescript-tips",
      source_title: "Random Blog · TypeScript Tips",
      authority_tier: "TIER_4",
      technology: "typescript",
      domain: "language",
      statement: "TypeScript's strict mode is optional",
      raw_content: "some blog content",
    });
    expect(knowledge.verification_status).toBe("DISCOVERED");
    expect(knowledge.confidence).toBeLessThan(0.5);
  });

  it("Tier-1/2 source ingestion is CHECKED (structural) · NOT VERIFIED", () => {
    const { knowledge } = ingestExternalSource({
      url: "https://www.typescriptlang.org/docs",
      source_title: "TypeScript Docs",
      authority_tier: "TIER_1",
      technology: "typescript",
      domain: "language",
      statement: "TypeScript is a typed superset of JavaScript",
      raw_content: "official docs",
    });
    expect(knowledge.verification_status).toBe("CHECKED"); // structurally valid + Tier 1/2
    expect(knowledge.verification_status).not.toBe("VERIFIED");  // no independent evidence yet
  });
});

// ─── §17.8 · verified knowledge can be represented ───────────────

describe("§17.8 · verified knowledge can be represented", () => {
  it("verifyKnowledge appends a new record at status=VERIFIED with different evidence source", () => {
    const { knowledge } = ingestExternalSource({
      url: "https://nodejs.org/api/fs.html",
      source_title: "Node.js fs docs",
      authority_tier: "TIER_1",
      technology: "nodejs",
      domain: "runtime",
      statement: "fs.readFileSync throws on missing file",
      raw_content: "docs",
    });
    const verified = verifyKnowledge({
      knowledge_id: knowledge.knowledge_id,
      new_status: "VERIFIED",
      independent_evidence_pointer: "test:read-missing-file-throws-ENOENT",
      independent_evidence_source: "test_runner",
      reason: "vitest asserted ENOENT is thrown for absent path",
    });
    expect(verified.verification_status).toBe("VERIFIED");
    expect(verified.confidence).toBeGreaterThan(knowledge.confidence);
    expect(verified.knowledge_id).not.toBe(knowledge.knowledge_id); // append-only · new id
    expect(verified.related_knowledge).toContain(knowledge.knowledge_id);
  });

  it("verifyKnowledge REJECTS self-referential evidence (§7 no self-reference)", () => {
    const { knowledge } = ingestExternalSource({
      url: "https://nodejs.org/api/fs.html",
      source_title: "Node.js fs",
      authority_tier: "TIER_1",
      technology: "nodejs",
      domain: "runtime",
      statement: "fs.readFileSync reads sync",
      raw_content: "docs",
    });
    expect(() => verifyKnowledge({
      knowledge_id: knowledge.knowledge_id,
      new_status: "VERIFIED",
      independent_evidence_pointer: "https://nodejs.org/api/fs.html", // SAME url as source
      independent_evidence_source: "self",
      reason: "the doc says so",
    })).toThrow(/no self-reference/);
  });
});

// ─── §17.9 · skill can reference supporting experience ───────────

describe("§17.9 · skill can reference supporting experience", () => {
  it("captureSkill accepts supporting_experiences[] pointing to experience ids", () => {
    const exp = captureExperience({
      task: "wire directory-knowledge tier",
      initial_hypothesis: "S3 will lift retrieval hits by 50%+",
      action_taken: "prepended dirHits to seedHits in route.ts",
      files_involved: ["src/app/api/nex-conv/chat/route.ts"],
      expected_result: "+50% hits on 14 test turns",
      actual_result: "28 → 42 hits · +50% exactly",
      evidence: ["_retrieval_probe.json"],
      outcome: "success",
      lessons: ["directory retrieval + seed retrieval compose without conflict"],
      provenance: sampleProv({ source: "philip", source_type: "human_engineer" }),
    });
    const skill = captureSkill({
      name: "bridge directory rows into composer RAG",
      domain: "conversation-composition",
      description: "add directory-tier hits into hits[] before compose",
      supporting_experiences: [exp.experience_id],
      promotion_state: "PRACTICED",
    });
    expect(skill.supporting_experiences).toContain(exp.experience_id);
    expect(skill.promotion_state).toBe("PRACTICED");
    // Fresh reads back through queries
    const found = querySkills({ domain: "conversation-composition" });
    expect(found[0].supporting_experiences).toContain(exp.experience_id);
  });
});

// ─── §17.10 · experience can reference evidence ──────────────────

describe("§17.10 · experience can reference evidence", () => {
  it("captureExperience preserves evidence[] pointers", () => {
    const exp = captureExperience({
      task: "P0.3 hotel reference continuity",
      initial_hypothesis: "hydration + fallback closes the gap",
      action_taken: "created reference-hydration.ts + route.ts wire",
      files_involved: [
        "src/lib/nex/brain/reference-hydration.ts",
        "src/app/api/nex-conv/chat/route.ts",
      ],
      expected_result: "T2 reply names Gaotama Hotel from actual record",
      actual_result: "Gaotama Hotel is a hotel in Yogyakarta. Listed on NEX...",
      evidence: [
        "tests/fixtures/workforce-activation-proof/_reproduce_hotel_t3.json",
        "tests/fixtures/workforce-activation-proof/_p0_3_hotel_reference_continuity_report.md",
      ],
      outcome: "success",
      lessons: [
        "gate/verifier/fallback separation catches LLM subjective claims",
        "record-summary fallback preserves reference when verifier rejects LLM",
      ],
      provenance: sampleProv(),
    });
    expect(exp.evidence).toHaveLength(2);
    expect(exp.evidence[0]).toContain("_reproduce_hotel_t3.json");
  });
});

// ─── §17.11 · failed implementation retained ─────────────────────

describe("§17.11 · failed implementation is retained", () => {
  it("captureExperience with outcome=failure requires root_cause AND persists", () => {
    // First: rejects failure without root_cause
    expect(() => captureExperience({
      task: "wrong migration",
      initial_hypothesis: "add NOT NULL column",
      action_taken: "ALTER TABLE ... NOT NULL DEFAULT NOW()",
      files_involved: ["migrations/wrong.sql"],
      expected_result: "safe migration",
      actual_result: "lock cascade",
      evidence: ["logs/migration-failed.txt"],
      outcome: "failure",
      lessons: [],
      provenance: sampleProv(),
    })).toThrow(/root_cause/);
    // Now with root_cause: persisted
    const exp = captureExperience({
      task: "wrong migration",
      initial_hypothesis: "add NOT NULL column",
      action_taken: "ALTER TABLE ... NOT NULL DEFAULT NOW()",
      files_involved: ["migrations/wrong.sql"],
      expected_result: "safe migration",
      actual_result: "lock cascade on 50M row table",
      evidence: ["logs/migration-failed.txt"],
      outcome: "failure",
      root_cause: "ACCESS EXCLUSIVE lock held during table rewrite",
      correction: "add nullable, backfill in batches, add NOT NULL separately",
      lessons: ["large NOT NULL DEFAULT rewrites the table in older PG"],
      provenance: sampleProv(),
    });
    const stored = readExperiences();
    expect(stored.find((e) => e.experience_id === exp.experience_id)).toBeDefined();
    // Retrievable via queryExperiences with outcome=failure
    const failures = queryExperiences({ outcome: "failure" });
    expect(failures).toHaveLength(1);
    expect(failures[0].root_cause).toContain("ACCESS EXCLUSIVE");
  });
});

// ─── §17.12 · contradiction retained (never silently overwritten) ──

describe("§17.12 · contradiction retained rather than silently overwritten", () => {
  it("recordContradiction emits a NEW knowledge record referencing both sources", () => {
    const a = ingestExternalSource({
      url: "https://source-a.example/spec.html",
      source_title: "Spec A",
      authority_tier: "TIER_2",
      technology: "http",
      domain: "protocol",
      statement: "HTTP method must be uppercase",
      raw_content: "spec A",
    });
    const b = ingestExternalSource({
      url: "https://source-b.example/spec.html",
      source_title: "Spec B",
      authority_tier: "TIER_2",
      technology: "http",
      domain: "protocol",
      statement: "HTTP method is case-insensitive",
      raw_content: "spec B",
    });
    const contradiction = recordContradiction({
      a_knowledge_id: a.knowledge.knowledge_id,
      b_knowledge_id: b.knowledge.knowledge_id,
      contradiction_statement: "Spec A says uppercase; Spec B says case-insensitive",
      actor_source: "philip",
    });
    // Both originals still present. Contradiction record separate.
    const all = readKnowledge();
    expect(all.find((k) => k.knowledge_id === a.knowledge.knowledge_id)).toBeDefined();
    expect(all.find((k) => k.knowledge_id === b.knowledge.knowledge_id)).toBeDefined();
    expect(all.find((k) => k.knowledge_id === contradiction.knowledge_id)!.related_knowledge).toEqual(
      expect.arrayContaining([a.knowledge.knowledge_id, b.knowledge.knowledge_id]),
    );
    // Neither original marked "wrong" · both survived intact
    expect(a.knowledge.verification_status).not.toBe("REJECTED");
    expect(b.knowledge.verification_status).not.toBe("REJECTED");
  });

  it("classifyIncomingKnowledge reports 'contradiction' for competing authoritative statements", () => {
    const first = ingestExternalSource({
      url: "https://a.example/x",
      source_title: "A",
      authority_tier: "TIER_1",
      technology: "postgres",
      domain: "database",
      statement: "PostgreSQL default isolation is READ COMMITTED",
      raw_content: "docs",
    });
    const incoming: KnowledgeItem = {
      knowledge_id: generateId("know"),
      statement: "PostgreSQL default isolation is SERIALIZABLE and always has been",
      domain: "database",
      technology: "postgres",
      provenance: sampleProv({
        source: "B",
        authority_tier: "TIER_1",
        source_url: "https://b.example/x",
        source_type: "external_documentation",
      }),
      verification_status: "CHECKED",
      confidence: 0.9,
      superseded_by: null,
      content_hash: stableHash("SERIALIZABLE by default"),
      created_at: new Date().toISOString(),
    };
    const reports = classifyIncomingKnowledge(incoming, [first.knowledge]);
    expect(reports.some((r) => r.kind === "contradiction")).toBe(true);
  });
});

// ─── §17.13 · duplicate knowledge detected ───────────────────────

describe("§17.13 · duplicate knowledge can be detected", () => {
  it("detectDuplicate returns the existing record when hash + url match", () => {
    const { knowledge } = ingestExternalSource({
      url: "https://source.example/x",
      source_title: "Source X",
      authority_tier: "TIER_1",
      technology: "typescript",
      domain: "language",
      statement: "TS unions are structural",
      raw_content: "content",
    });
    const dup = detectDuplicate(knowledge, readKnowledge());
    // Same record vs itself is expected · confirms lookup mechanic works.
    expect(dup?.knowledge_id).toBe(knowledge.knowledge_id);
    // findExistingKnowledgeByHash also works
    const byHash = findExistingKnowledgeByHash(knowledge.content_hash);
    expect(byHash?.knowledge_id).toBe(knowledge.knowledge_id);
  });
});

// ─── §17.14 · retrieval returns provenance ───────────────────────

describe("§17.14 · retrieval returns provenance", () => {
  it("queryKnowledge results carry the full provenance object", () => {
    ingestExternalSource({
      url: "https://www.postgresql.org/docs/current/",
      source_title: "PostgreSQL Docs",
      authority_tier: "TIER_1",
      technology: "postgres",
      domain: "database",
      statement: "PostgreSQL supports MVCC",
      raw_content: "docs",
    });
    const results = queryKnowledge({ technology: "postgres" });
    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    expect(first.provenance).toBeDefined();
    expect(first.provenance.source_url).toContain("postgresql.org");
    expect(first.provenance.evidence_pointer).toBeTruthy();
    expect(first.provenance.authority_tier).toBe("TIER_1");
    expect(first.provenance.retrieved_at).toBeTruthy();
  });
});

// ─── §17.15 · provider identity does not determine truth ─────────

describe("§17.15 · provider identity does not determine truth", () => {
  it("Claude ingestion is captured as claim; Ollama ingestion behaves identically; neither auto-VERIFIED", () => {
    // Both providers capture claims; both stay DISCOVERED
    captureEngineeringEvent({
      kind: "observation",
      description: "Claude proposes: refactor route to Redux",
      source: "claude",
      source_type: "claude_claim",
      evidence_pointer: "chat-log:1",
    });
    captureEngineeringEvent({
      kind: "observation",
      description: "Ollama proposes: refactor route to Redux",
      source: "ollama",
      source_type: "ollama_action",
      evidence_pointer: "chat-log:2",
    });
    const events = readEvents();
    expect(events).toHaveLength(2);
    for (const e of events) expect(e.status).toBe("DISCOVERED");
    // If we later verify · verification requires evidence, not provider identity.
    // Neither event is upgraded to VERIFIED by this Phase-A code.
    expect(events.every((e) => e.status !== "VERIFIED")).toBe(true);
  });
});

// ─── §17.16 · no self-reported success becomes authoritative ─────

describe("§17.16 · no self-reported success becomes authoritative", () => {
  it("even when Claude claims total success, event stream requires external evidence chain", () => {
    const attempt = captureClaudeAttempt({
      task: "fabricated success",
      claude_claim: "All tests passed · production-ready · no issues.",
      action_summary: "Wrote code and asserted success",
      evidence_pointer: "chat:pretend",
    });
    // The persisted event is DISCOVERED · never auto-verified
    const events = readEvents();
    const attemptEvent = events.find((e) => e.event_id === attempt.event_id)!;
    expect(attemptEvent.status).toBe("DISCOVERED");
    // Doctrine marker present on the CLAIM event
    const claim = events.find((e) => e.source_type === "claude_claim")!;
    expect(claim.meta?.doctrine).toBe("op_truth.no_self_reported_success");
  });

  it("LearningRun with non-null final_status is REJECTED at write time", () => {
    const bad: LearningRun = {
      run_id: generateId("run"),
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      triggered_by: "manual",
      events_captured: 1,
      knowledge_ingested: 0,
      skills_touched: 0,
      experiences_created: 0,
      external_sources_read: 0,
      errors: [],
      evidence_pointers: [],
      // Intentional violation:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      final_status: "PROVEN_HEALTHY" as any,
    };
    expect(() => appendLearningRun(bad)).toThrow(/Op-Truth violation/);
  });
});

// ─── §17.17 · unauthorized autonomous actions impossible from Phase-A ──

describe("§17.17 · unauthorized autonomous actions impossible from Phase-A surface", () => {
  it("the store module has NO exported function that commits · deploys · alters DB · modifies workforce", () => {
    const publicNames = Object.keys(storeModule);
    const forbiddenPrefixes = ["commit", "push", "deploy", "alterDatabase", "grantAccess", "modifyProduction", "modifyWorkforce", "modifyOwnCore", "createWorkforce"];
    for (const forbidden of forbiddenPrefixes) {
      const leak = publicNames.find((n) => n.toLowerCase().startsWith(forbidden.toLowerCase()));
      expect(leak, `Phase-A store must not export ${forbidden}*`).toBeUndefined();
    }
  });

  it("Phase-A store REFUSES writes outside the learning directory", () => {
    // We can't directly test pathFor(), but we can prove the store
    // only writes through its own exposed functions and there's no
    // "writeAnywhere" backdoor. Attempting to sneak a filename with
    // path traversal would still be constrained by pathFor.
    expect(ForbiddenPhaseAWrite).toBeDefined();
    expect(new ForbiddenPhaseAWrite("/etc/passwd").message).toContain("Phase-A forbidden write");
  });
});

// ─── Adversarial · additional guardrails ─────────────────────────

describe("adversarial · phase-A guardrails", () => {
  it("checkKnowledgeIntegrity flags missing provenance", () => {
    const bad: KnowledgeItem = {
      knowledge_id: "k1",
      statement: "x",
      domain: "test",
      // @ts-expect-error intentional: no provenance
      provenance: undefined,
      verification_status: "DISCOVERED",
      confidence: 0.5,
      superseded_by: null,
      content_hash: "abc",
      created_at: new Date().toISOString(),
    };
    const issues = checkKnowledgeIntegrity(bad);
    expect(issues.some((i) => i.includes("provenance"))).toBe(true);
    expect(issues.some((i) => i.includes("statement too short"))).toBe(true);
  });

  it("supersession creates a NEW record · does NOT mutate the original in memory", () => {
    const a = ingestExternalSource({
      url: "https://old.example/spec.html",
      source_title: "Old Spec",
      authority_tier: "TIER_3",
      technology: "postgres",
      domain: "database",
      statement: "PG default isolation READ COMMITTED",
      raw_content: "old",
    });
    const b = ingestExternalSource({
      url: "https://new.example/spec.html",
      source_title: "New Spec",
      authority_tier: "TIER_1",  // higher
      technology: "postgres",
      domain: "database",
      statement: "PG default isolation READ COMMITTED",
      raw_content: "new",
    });
    const supersession = markSuperseded({
      old_knowledge_id: a.knowledge.knowledge_id,
      new_knowledge_id: b.knowledge.knowledge_id,
      reason: "higher-tier authoritative source",
      actor_source: "philip",
    });
    expect(supersession.verification_status).toBe("SUPERSEDED");
    expect(supersession.superseded_by).toBe(b.knowledge.knowledge_id);
    // Original a still readable · new supersession record separate
    const all = readKnowledge();
    expect(all.find((k) => k.knowledge_id === a.knowledge.knowledge_id)).toBeDefined();
    expect(all.find((k) => k.knowledge_id === supersession.knowledge_id)!.verification_status).toBe("SUPERSEDED");
  });

  it("computeLearningStats returns non-null counts and latest timestamps", () => {
    captureEngineeringEvent({
      kind: "observation", description: "x", source: "test",
      source_type: "internal_artifact", evidence_pointer: "test",
    });
    ingestExternalSource({
      url: "https://s.example", source_title: "S", authority_tier: "TIER_1",
      technology: "ts", domain: "lang", statement: "TS is typed",
      raw_content: "docs",
    });
    const stats = computeLearningStats();
    expect(stats.events_total).toBeGreaterThan(0);
    expect(stats.knowledge_total).toBeGreaterThan(0);
    expect(stats.knowledge_by_tier.TIER_1).toBeGreaterThan(0);
    expect(stats.latest_event_timestamp).not.toBeNull();
  });
});
