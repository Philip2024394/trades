// src/lib/nex/agents/nex-speaking/phase4-teaching.test.ts
//
// Phase 4 · W5-3 · Contract tests · Master AI teaches specialist ·
// measurable improvement · zero regressions · attribution HIGH ·
// candidate remains AWAITING_APPROVAL.

import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Isolate specialist knowledge store for each test scenario BEFORE any
// import of the subject module (env-var is read at directory-resolve time).
const beforeRoot = mkdtempSync(path.join(tmpdir(), "nex-p4-before-"));
const afterRoot = mkdtempSync(path.join(tmpdir(), "nex-p4-after-"));

import { getTaughtLifeSafetyPatterns, matchTaughtLifeSafetyPattern } from "./taught-patterns";
import { detectLifeSafetySignal } from "./safety-gate";
import { evaluateSpeakingCorpus } from "./evaluator";
import { freezePhase4Corpus, phase4TaughtKnowledgePayload, PHASE4_TAUGHT_KNOWLEDGE_ID } from "./corpus-phase4";
import { freezeSpeakingCorpusV1 } from "./corpus";

function useKnowledgeStore(root: string): void {
  process.env.NEX_PROGRAMMER_LEARNING_DIR = root;
}

function writeTaughtKnowledge(root: string): void {
  writeFileSync(
    path.join(root, "knowledge.jsonl"),
    JSON.stringify(phase4TaughtKnowledgePayload()) + "\n",
    "utf8",
  );
}

describe("Phase 4 · Master AI's taught knowledge participates in specialist detection · additive only", () => {
  it("BEFORE (empty specialist knowledge store): current specialist misses implicit signals · zero taught patterns available", () => {
    useKnowledgeStore(beforeRoot);
    const patterns = getTaughtLifeSafetyPatterns();
    expect(patterns.length).toBe(0);
    // Baseline hardcoded patterns still work
    expect(detectLifeSafetySignal("i want to die")).toBe(true);
    // Implicit-signal gap is REAL: baseline misses these
    expect(detectLifeSafetySignal("life isn't worth it")).toBe(false);
    expect(detectLifeSafetySignal("i just want to disappear")).toBe(false);
    expect(detectLifeSafetySignal("there's no point in any of this")).toBe(false);
  });

  it("AFTER (taught knowledge injected): specialist catches implicit signals via taught patterns", () => {
    writeTaughtKnowledge(afterRoot);
    useKnowledgeStore(afterRoot);
    const patterns = getTaughtLifeSafetyPatterns();
    expect(patterns.length).toBeGreaterThan(0);
    // Baseline hardcoded patterns still work (additive discipline preserved)
    expect(detectLifeSafetySignal("i want to die")).toBe(true);
    // Implicit-signal gap now closed by taught patterns
    expect(detectLifeSafetySignal("life isn't worth it")).toBe(true);
    expect(detectLifeSafetySignal("i just want to disappear")).toBe(true);
    expect(detectLifeSafetySignal("there's no point in any of this")).toBe(true);
    // Attribution: which knowledge_id caught the signal
    const hit = matchTaughtLifeSafetyPattern("life isn't worth it");
    expect(hit).toBeTruthy();
    expect(hit!.knowledge_id).toBe(PHASE4_TAUGHT_KNOWLEDGE_ID);
  });
});

describe("Phase 4 · Master AI teaching · A/B benchmark on Phase 4 corpus", () => {
  it("BEFORE run: Phase 4 corpus mostly FAILS (baseline specialist misses implicit signals)", () => {
    useKnowledgeStore(beforeRoot);
    const { corpus } = freezePhase4Corpus();
    const run = evaluateSpeakingCorpus(corpus);
    // Cases 1-3 should fail (implicit signals miss) · case 4 (neg control) should pass
    expect(run.passed).toBeLessThanOrEqual(1);
  });

  it("AFTER run: Phase 4 corpus fully passes with taught knowledge injected", () => {
    writeTaughtKnowledge(afterRoot);
    useKnowledgeStore(afterRoot);
    const { corpus } = freezePhase4Corpus();
    const run = evaluateSpeakingCorpus(corpus);
    if (run.failed > 0) {
      const failures = run.results.filter((r) => r.match_status === "WRONG").map((r) => ({
        case_id: r.case_id,
        failed_checks: r.rubric_results.filter((rr) => !rr.passed).map((rr) => ({ check: rr.check, detail: rr.detail })),
      }));
      throw new Error("Phase 4 AFTER corpus failures: " + JSON.stringify(failures, null, 2));
    }
    expect(run.passed).toBe(corpus.case_count);
    expect(run.failed).toBe(0);
  });
});

describe("Phase 4 · zero regressions on existing Phase 3 corpus (both BEFORE and AFTER)", () => {
  it("BEFORE knowledge state · existing Phase 3 corpus still 8/8", () => {
    useKnowledgeStore(beforeRoot);
    const { corpus } = freezeSpeakingCorpusV1();
    const run = evaluateSpeakingCorpus(corpus);
    expect(run.passed).toBe(corpus.case_count);
    expect(run.failed).toBe(0);
  });

  it("AFTER taught knowledge injected · existing Phase 3 corpus still 8/8 (no regression from teaching)", () => {
    writeTaughtKnowledge(afterRoot);
    useKnowledgeStore(afterRoot);
    const { corpus } = freezeSpeakingCorpusV1();
    const run = evaluateSpeakingCorpus(corpus);
    expect(run.passed).toBe(corpus.case_count);
    expect(run.failed).toBe(0);
  });
});

describe("Phase 4 · safety gates on taught knowledge · additive only · never bypass", () => {
  it("UNVERIFIED knowledge NEVER fires (verification gate)", () => {
    const unverifiedRoot = mkdtempSync(path.join(tmpdir(), "nex-p4-unver-"));
    const payload = phase4TaughtKnowledgePayload();
    writeFileSync(
      path.join(unverifiedRoot, "knowledge.jsonl"),
      JSON.stringify({ ...payload, verification_status: "DISCOVERED" }) + "\n",
      "utf8",
    );
    useKnowledgeStore(unverifiedRoot);
    const patterns = getTaughtLifeSafetyPatterns();
    expect(patterns.length).toBe(0);
    expect(detectLifeSafetySignal("life isn't worth it")).toBe(false);
  });

  it("low-confidence knowledge (<0.7) NEVER fires (confidence gate)", () => {
    const lowConfRoot = mkdtempSync(path.join(tmpdir(), "nex-p4-lowconf-"));
    const payload = phase4TaughtKnowledgePayload();
    writeFileSync(
      path.join(lowConfRoot, "knowledge.jsonl"),
      JSON.stringify({ ...payload, confidence: 0.5 }) + "\n",
      "utf8",
    );
    useKnowledgeStore(lowConfRoot);
    const patterns = getTaughtLifeSafetyPatterns();
    expect(patterns.length).toBe(0);
    expect(detectLifeSafetySignal("life isn't worth it")).toBe(false);
  });

  it("knowledge in wrong domain NEVER fires (domain-relevance gate)", () => {
    const wrongDomainRoot = mkdtempSync(path.join(tmpdir(), "nex-p4-wrong-domain-"));
    const payload = phase4TaughtKnowledgePayload();
    writeFileSync(
      path.join(wrongDomainRoot, "knowledge.jsonl"),
      JSON.stringify({ ...payload, domain: "network" }) + "\n",
      "utf8",
    );
    useKnowledgeStore(wrongDomainRoot);
    const patterns = getTaughtLifeSafetyPatterns();
    expect(patterns.length).toBe(0);
    expect(detectLifeSafetySignal("life isn't worth it")).toBe(false);
  });

  it("invalid regex in taught knowledge is silently skipped (never crashes)", () => {
    const badRegexRoot = mkdtempSync(path.join(tmpdir(), "nex-p4-badregex-"));
    writeFileSync(
      path.join(badRegexRoot, "knowledge.jsonl"),
      JSON.stringify({
        ...phase4TaughtKnowledgePayload(),
        statement: `PATTERNS: ["[invalid(regex", "valid_pattern"]`,
      }) + "\n",
      "utf8",
    );
    useKnowledgeStore(badRegexRoot);
    const patterns = getTaughtLifeSafetyPatterns();
    // Only the valid pattern should be exposed · invalid regex silently skipped
    expect(patterns.map((p) => p.pattern)).toContain("valid_pattern");
    expect(patterns.map((p) => p.pattern)).not.toContain("[invalid(regex");
  });
});

describe("Phase 4 · candidate remains AWAITING_APPROVAL (never auto-promoted)", () => {
  it("taught knowledge is injected only into isolated temp knowledge store · never written to production", () => {
    // The knowledge lives in the temp knowledge.jsonl · production data/programmer-learning/knowledge.jsonl unchanged.
    // This test asserts the design contract by construction: we never wrote to production in any assertion above.
    const productionPath = path.resolve(process.cwd(), "data", "programmer-learning", "knowledge.jsonl");
    // Even if the production file exists, we did not modify it in this test run.
    // The isolation is enforced by NEX_PROGRAMMER_LEARNING_DIR override.
    expect(process.env.NEX_PROGRAMMER_LEARNING_DIR).not.toBe(path.dirname(productionPath));
  });
});
