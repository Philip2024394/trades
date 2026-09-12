// src/lib/nex/l4-bakeoff/corpus-nex-l4-v2.test.ts
//
// V.5.3.2 · Corpus V2 contract tests (supersedes V1 · adds coverage)
// Founder BEGIN V.5.3 · 2026-09-08 · tranche 2

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NEX_L4_CORPUS_V2, V2_ADDITION_COUNT } from "./corpus-nex-l4-v2";
import { NEX_L4_CORPUS_V1 } from "./corpus-nex-l4-v1";
import { verifyCorpusIntegrity, registerCorpus, readCorpusRegistry } from "./benchmark-schema";
import { CRITICAL_DIMENSIONS, type EvaluationDimension } from "./types";

let priorRoot: string | undefined;

beforeEach(() => {
  priorRoot = process.env.NEX_L4_BAKEOFF_DATA_ROOT;
  const iso = mkdtempSync(path.join(tmpdir(), "nex-v532-corpus-"));
  process.env.NEX_L4_BAKEOFF_DATA_ROOT = iso;
});
afterEach(() => {
  if (priorRoot === undefined) delete process.env.NEX_L4_BAKEOFF_DATA_ROOT;
  else process.env.NEX_L4_BAKEOFF_DATA_ROOT = priorRoot;
});

// ═══════════════════════════════════════════════════════════════════
// § SUPERSESSION
// ═══════════════════════════════════════════════════════════════════

describe("§V532-SUPER · V2 supersedes V1 · V1 remains immutable", () => {
  it("V2 case_count = V1 case_count + V2 additions", () => {
    expect(NEX_L4_CORPUS_V2.case_count).toBe(NEX_L4_CORPUS_V1.case_count + V2_ADDITION_COUNT);
  });

  it("V1 stays frozen + unchanged", () => {
    expect(Object.isFrozen(NEX_L4_CORPUS_V1)).toBe(true);
    expect(verifyCorpusIntegrity(NEX_L4_CORPUS_V1).ok).toBe(true);
    // V1 hash should still verify · no mutation
    const v1Check = verifyCorpusIntegrity(NEX_L4_CORPUS_V1);
    expect(v1Check.ok).toBe(true);
  });

  it("V2 is frozen + integrity holds", () => {
    expect(Object.isFrozen(NEX_L4_CORPUS_V2)).toBe(true);
    expect(verifyCorpusIntegrity(NEX_L4_CORPUS_V2).ok).toBe(true);
  });

  it("V1 and V2 have distinct version + hash", () => {
    expect(NEX_L4_CORPUS_V1.version).not.toBe(NEX_L4_CORPUS_V2.version);
    expect(NEX_L4_CORPUS_V1.content_hash).not.toBe(NEX_L4_CORPUS_V2.content_hash);
  });

  it("V2 includes every V1 case (semantically · re-versioned)", () => {
    const v1Ids = new Set(NEX_L4_CORPUS_V1.cases.map((c) => c.case_id));
    const v2Ids = new Set(NEX_L4_CORPUS_V2.cases.map((c) => c.case_id));
    for (const id of v1Ids) expect(v2Ids.has(id)).toBe(true);
  });

  it("registers both V1 and V2 side-by-side in registry", () => {
    registerCorpus(NEX_L4_CORPUS_V1);
    registerCorpus(NEX_L4_CORPUS_V2);
    const reg = readCorpusRegistry();
    expect(reg.length).toBe(2);
    expect(reg.some((e) => e.version === "nex-l4-corpus-v1")).toBe(true);
    expect(reg.some((e) => e.version === "nex-l4-corpus-v2")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § GAP-FILL COVERAGE
// ═══════════════════════════════════════════════════════════════════

describe("§V532-COVERAGE · gap-fill dimensions now have ≥ 3 cases each", () => {
  const gapDimensions: EvaluationDimension[] = [
    "voice_readiness", "vision_readiness", "latency", "throughput", "cost", "reliability", "offline_local_capability",
  ];

  for (const dim of gapDimensions) {
    it(`dimension '${dim}' now has ≥ 3 cases`, () => {
      const cases = NEX_L4_CORPUS_V2.cases.filter((c) => c.dimension === dim);
      expect(cases.length, `${dim} needs ≥3 cases · got ${cases.length}`).toBeGreaterThanOrEqual(3);
    });
  }

  it("memory_integration now has ≥ 2 cases (was 0 in V1)", () => {
    const cases = NEX_L4_CORPUS_V2.cases.filter((c) => c.dimension === "memory_integration");
    expect(cases.length).toBeGreaterThanOrEqual(2);
  });

  it("all 10 CRITICAL_DIMENSIONS still covered", () => {
    const covered = new Set<EvaluationDimension>();
    for (const c of NEX_L4_CORPUS_V2.cases) covered.add(c.dimension);
    for (const cd of CRITICAL_DIMENSIONS) {
      expect(covered.has(cd), `critical dim ${cd} not covered in V2`).toBe(true);
    }
  });

  it("V2 covers ≥ 22 of 32 dimensions (up from 20 in V1)", () => {
    const covered = new Set<EvaluationDimension>();
    for (const c of NEX_L4_CORPUS_V2.cases) covered.add(c.dimension);
    expect(covered.size).toBeGreaterThanOrEqual(22);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § HELD-OUT DISCIPLINE (grows with tranches)
// ═══════════════════════════════════════════════════════════════════

describe("§V532-HELDOUT · held-out set expanded", () => {
  it("V2 has more held-out cases than V1", () => {
    const v1Held = NEX_L4_CORPUS_V1.cases.filter((c) => c.held_out === true).length;
    const v2Held = NEX_L4_CORPUS_V2.cases.filter((c) => c.held_out === true).length;
    expect(v2Held).toBeGreaterThan(v1Held);
  });

  it("V2 held-out includes vision-adversarial + authority-forge injection + confidence-leak", () => {
    const held = NEX_L4_CORPUS_V2.cases.filter((c) => c.held_out === true);
    expect(held.some((c) => c.tags?.includes("vision") && c.tags?.includes("adversarial"))).toBe(true);
    expect(held.some((c) => c.tags?.includes("authority_forge"))).toBe(true);
    expect(held.some((c) => c.tags?.includes("no_confidence_leak"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § UX INVARIANT DEPTH
// ═══════════════════════════════════════════════════════════════════

describe("§V532-UX · UX-invariant depth increased", () => {
  it("V2 has more UX-invariant cases than V1", () => {
    const v1UX = NEX_L4_CORPUS_V1.cases.filter((c) => c.ux_invariant_case === true).length;
    const v2UX = NEX_L4_CORPUS_V2.cases.filter((c) => c.ux_invariant_case === true).length;
    expect(v2UX).toBeGreaterThan(v1UX);
  });

  it("no_confidence_score_leak case exists · forbids 'confidence' / '0.' / 'flag_human' etc", () => {
    const c = NEX_L4_CORPUS_V2.cases.find((x) => x.case_id === "ux4_no_confidence_score_leak");
    expect(c).toBeDefined();
    expect(c?.scoring_rubric.must_not_contain?.some((s) => /confidence|flag_human/i.test(s))).toBe(true);
  });

  it("indonesian-plain-language-uncertainty UX case present", () => {
    const c = NEX_L4_CORPUS_V2.cases.find((x) => x.case_id === "ux5_indonesian_uncertainty_plain_language");
    expect(c).toBeDefined();
    expect(c?.language).toBe("id");
    expect(c?.scoring_rubric.must_express_uncertainty).toBe(true);
  });
});
