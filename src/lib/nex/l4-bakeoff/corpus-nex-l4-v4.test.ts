// src/lib/nex/l4-bakeoff/corpus-nex-l4-v4.test.ts
//
// V.5.3.4 · Corpus V4 contract tests · finish ALL 10 CRITICAL dims at ≥3
// Founder BEGIN V.5.3 · 2026-09-08 · tranche 4

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NEX_L4_CORPUS_V4, V4_ADDITION_COUNT } from "./corpus-nex-l4-v4";
import { NEX_L4_CORPUS_V3 } from "./corpus-nex-l4-v3";
import { NEX_L4_CORPUS_V2 } from "./corpus-nex-l4-v2";
import { NEX_L4_CORPUS_V1 } from "./corpus-nex-l4-v1";
import { verifyCorpusIntegrity, registerCorpus, readCorpusRegistry } from "./benchmark-schema";
import { CRITICAL_DIMENSIONS, type EvaluationDimension } from "./types";

let priorRoot: string | undefined;

beforeEach(() => {
  priorRoot = process.env.NEX_L4_BAKEOFF_DATA_ROOT;
  const iso = mkdtempSync(path.join(tmpdir(), "nex-v534-corpus-"));
  process.env.NEX_L4_BAKEOFF_DATA_ROOT = iso;
});
afterEach(() => {
  if (priorRoot === undefined) delete process.env.NEX_L4_BAKEOFF_DATA_ROOT;
  else process.env.NEX_L4_BAKEOFF_DATA_ROOT = priorRoot;
});

// ═══════════════════════════════════════════════════════════════════
// § SUPERSESSION · V1+V2+V3 immutable · V4 preferred
// ═══════════════════════════════════════════════════════════════════

describe("§V534-SUPER · V4 supersedes V3 · V1/V2/V3 immutable", () => {
  it("V4 case_count = V3 case_count + V4 additions", () => {
    expect(NEX_L4_CORPUS_V4.case_count).toBe(NEX_L4_CORPUS_V3.case_count + V4_ADDITION_COUNT);
  });

  it("V1/V2/V3 integrity holds", () => {
    expect(verifyCorpusIntegrity(NEX_L4_CORPUS_V1).ok).toBe(true);
    expect(verifyCorpusIntegrity(NEX_L4_CORPUS_V2).ok).toBe(true);
    expect(verifyCorpusIntegrity(NEX_L4_CORPUS_V3).ok).toBe(true);
  });

  it("V4 frozen + integrity holds", () => {
    expect(Object.isFrozen(NEX_L4_CORPUS_V4)).toBe(true);
    expect(verifyCorpusIntegrity(NEX_L4_CORPUS_V4).ok).toBe(true);
  });

  it("all four versions register alongside each other", () => {
    registerCorpus(NEX_L4_CORPUS_V1);
    registerCorpus(NEX_L4_CORPUS_V2);
    registerCorpus(NEX_L4_CORPUS_V3);
    registerCorpus(NEX_L4_CORPUS_V4);
    const reg = readCorpusRegistry();
    expect(reg.length).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § CRITICAL DIMENSION COMPLETENESS
// ═══════════════════════════════════════════════════════════════════

describe("§V534-CRITICAL · ALL 10 CRITICAL_DIMENSIONS now ≥3 cases", () => {
  for (const cd of CRITICAL_DIMENSIONS) {
    it(`CRITICAL '${cd}' has ≥3 cases`, () => {
      const c = NEX_L4_CORPUS_V4.cases.filter((x) => x.dimension === cd);
      expect(c.length, `${cd} needs ≥3 · got ${c.length}`).toBeGreaterThanOrEqual(3);
    });
  }

  it("nex_specific_knowledge specifically 4 cases (from V3's 2)", () => {
    const c = NEX_L4_CORPUS_V4.cases.filter((x) => x.dimension === "nex_specific_knowledge");
    expect(c.length).toBeGreaterThanOrEqual(4);
  });

  it("nex_workflow_completion specifically 4 cases (from V3's 2)", () => {
    const c = NEX_L4_CORPUS_V4.cases.filter((x) => x.dimension === "nex_workflow_completion");
    expect(c.length).toBeGreaterThanOrEqual(4);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § LANGUAGE + MEMORY + CLARIFICATION DEPTH
// ═══════════════════════════════════════════════════════════════════

describe("§V534-DEPTH · language + memory + clarification promoted", () => {
  const promoted: [EvaluationDimension, number][] = [
    ["english", 3],
    ["indonesian", 3],
    ["long_context_reasoning", 3],
    ["personalization", 3],
    ["memory_integration", 3],
    ["clarification_quality", 3],
  ];
  for (const [dim, minN] of promoted) {
    it(`dimension '${dim}' now has ≥${minN} cases`, () => {
      const c = NEX_L4_CORPUS_V4.cases.filter((x) => x.dimension === dim);
      expect(c.length, `${dim} needs ≥${minN} · got ${c.length}`).toBeGreaterThanOrEqual(minN);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// § UX INVARIANT GROWTH
// ═══════════════════════════════════════════════════════════════════

describe("§V534-UX · UX-invariant grows monotonically", () => {
  it("V4 UX-invariant count > V3", () => {
    const v3 = NEX_L4_CORPUS_V3.cases.filter((c) => c.ux_invariant_case === true).length;
    const v4 = NEX_L4_CORPUS_V4.cases.filter((c) => c.ux_invariant_case === true).length;
    expect(v4).toBeGreaterThan(v3);
  });

  it("single-voice + personalization-correction cases present in V4", () => {
    const singleVoice = NEX_L4_CORPUS_V4.cases.find((c) => c.tags?.includes("single_voice"));
    expect(singleVoice).toBeDefined();
    const perCorrection = NEX_L4_CORPUS_V4.cases.find((c) => c.case_id === "per3_correction_learning");
    expect(perCorrection).toBeDefined();
  });
});
