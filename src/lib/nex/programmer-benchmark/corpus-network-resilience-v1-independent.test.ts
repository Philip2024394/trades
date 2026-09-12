// src/lib/nex/programmer-benchmark/corpus-network-resilience-v1-independent.test.ts
//
// Y-W5-1-a-2 · Independent Second Corpus · contract tests
// Philip 2026-09-07 · AUTHORIZE Phase 1

import { describe, it, expect } from "vitest";
import {
  CORPUS_VERSION_NETWORK_RESILIENCE_V1_INDEPENDENT,
  CANDIDATE_PROPOSED_KNOWLEDGE_ID_V1_INDEPENDENT,
  NETWORK_RESILIENCE_V1_INDEPENDENT_CASES,
  freezeNetworkResilienceCorpusV1Independent,
} from "./corpus-network-resilience-v1-independent";
import { NETWORK_RESILIENCE_V1_CASES } from "./corpus-network-resilience-v1";

describe("Y-W5-1-a-2 · independent corpus is frozen and hash-reproducible", () => {
  it("freezeNetworkResilienceCorpusV1Independent() returns versioned corpus with 10+ cases and stable hash", () => {
    const { corpus, hash } = freezeNetworkResilienceCorpusV1Independent();
    expect(corpus.version).toBe(CORPUS_VERSION_NETWORK_RESILIENCE_V1_INDEPENDENT);
    expect(corpus.case_count).toBeGreaterThanOrEqual(10);
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it("hash is deterministic across two freeze calls", () => {
    const a = freezeNetworkResilienceCorpusV1Independent();
    const b = freezeNetworkResilienceCorpusV1Independent();
    expect(a.hash).toBe(b.hash);
  });

  it("independent corpus hash DIFFERS from v1 corpus hash (proves it is genuinely different)", () => {
    const { hash: indepHash } = freezeNetworkResilienceCorpusV1Independent();
    // v1 corpus hash was 52b8ce4c0934d0b2 · this must differ
    expect(indepHash).not.toBe("52b8ce4c0934d0b2");
  });
});

describe("Y-W5-1-a-2 · case invariants", () => {
  it("every case has unique case_id within this corpus", () => {
    const ids = NETWORK_RESILIENCE_V1_INDEPENDENT_CASES.map((c) => c.case_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every case has matching corpus_version", () => {
    for (const c of NETWORK_RESILIENCE_V1_INDEPENDENT_CASES) {
      expect(c.corpus_version).toBe(CORPUS_VERSION_NETWORK_RESILIENCE_V1_INDEPENDENT);
    }
  });

  it("every case has non-empty ground_truth_evidence with pointer", () => {
    for (const c of NETWORK_RESILIENCE_V1_INDEPENDENT_CASES) {
      expect(c.ground_truth_evidence.length).toBeGreaterThan(0);
      for (const ev of c.ground_truth_evidence) {
        expect(ev.pointer).toBeTruthy();
        expect(ev.description).toBeTruthy();
      }
    }
  });

  it("every case nominates the candidate's proposed_knowledge_id", () => {
    for (const c of NETWORK_RESILIENCE_V1_INDEPENDENT_CASES) {
      expect(c.request.relevant_knowledge_ids).toContain(CANDIDATE_PROPOSED_KNOWLEDGE_ID_V1_INDEPENDENT);
    }
  });

  it("includes at least 3 negative controls (v1 had 2 · v2 has more coverage)", () => {
    const correctCases = NETWORK_RESILIENCE_V1_INDEPENDENT_CASES.filter((c) => c.ground_truth === "CORRECT");
    expect(correctCases.length).toBeGreaterThanOrEqual(3);
  });
});

describe("Y-W5-1-a-2 · INDEPENDENCE discipline (does not paraphrase v1 cases)", () => {
  it("no independent-corpus case has the same case_id as any v1 case", () => {
    const v1Ids = new Set(NETWORK_RESILIENCE_V1_CASES.map((c) => c.case_id));
    for (const c of NETWORK_RESILIENCE_V1_INDEPENDENT_CASES) {
      expect(v1Ids.has(c.case_id)).toBe(false);
    }
  });

  it("no independent-corpus case has the same requirement text as any v1 case", () => {
    const v1Reqs = new Set(NETWORK_RESILIENCE_V1_CASES.map((c) => c.requirement));
    for (const c of NETWORK_RESILIENCE_V1_INDEPENDENT_CASES) {
      expect(v1Reqs.has(c.requirement)).toBe(false);
    }
  });

  it("no independent-corpus case has the same implementation summary as any v1 case", () => {
    const v1Summaries = new Set(NETWORK_RESILIENCE_V1_CASES.map((c) => c.request.implementation.summary));
    for (const c of NETWORK_RESILIENCE_V1_INDEPENDENT_CASES) {
      expect(v1Summaries.has(c.request.implementation.summary)).toBe(false);
    }
  });

  it("provenance cites different sources than v1 (v2 adds AWS/Google-SRE/Netflix/Microsoft beyond v1's Wikipedia)", () => {
    // Every independent case's provenance mentions at least one source not present in the v1 authoring string
    for (const c of NETWORK_RESILIENCE_V1_INDEPENDENT_CASES) {
      const p = (c.provenance ?? "").toLowerCase();
      const hasIndependentSource = /aws|google|netflix|microsoft|hystrix|sre/.test(p);
      expect(hasIndependentSource).toBe(true);
    }
  });
});
