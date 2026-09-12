// src/lib/nex/l4-bakeoff/corpus-nex-l4-v3.test.ts
//
// V.5.3.3 · Corpus V3 contract tests (supersedes V2 · CRITICAL depth)
// Founder BEGIN V.5.3 · 2026-09-08 · tranche 3

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NEX_L4_CORPUS_V3, V3_ADDITION_COUNT } from "./corpus-nex-l4-v3";
import { NEX_L4_CORPUS_V2 } from "./corpus-nex-l4-v2";
import { NEX_L4_CORPUS_V1 } from "./corpus-nex-l4-v1";
import { verifyCorpusIntegrity, registerCorpus, readCorpusRegistry } from "./benchmark-schema";
import { CRITICAL_DIMENSIONS, type EvaluationDimension } from "./types";

let priorRoot: string | undefined;

beforeEach(() => {
  priorRoot = process.env.NEX_L4_BAKEOFF_DATA_ROOT;
  const iso = mkdtempSync(path.join(tmpdir(), "nex-v533-corpus-"));
  process.env.NEX_L4_BAKEOFF_DATA_ROOT = iso;
});
afterEach(() => {
  if (priorRoot === undefined) delete process.env.NEX_L4_BAKEOFF_DATA_ROOT;
  else process.env.NEX_L4_BAKEOFF_DATA_ROOT = priorRoot;
});

// ═══════════════════════════════════════════════════════════════════
// § SUPERSESSION · V1 + V2 immutable · V3 preferred
// ═══════════════════════════════════════════════════════════════════

describe("§V533-SUPER · V3 supersedes V2 · V1 + V2 remain immutable", () => {
  it("V3 case_count = V2 case_count + V3 additions", () => {
    expect(NEX_L4_CORPUS_V3.case_count).toBe(NEX_L4_CORPUS_V2.case_count + V3_ADDITION_COUNT);
  });

  it("V1 + V2 stay frozen + integrity holds", () => {
    expect(verifyCorpusIntegrity(NEX_L4_CORPUS_V1).ok).toBe(true);
    expect(verifyCorpusIntegrity(NEX_L4_CORPUS_V2).ok).toBe(true);
  });

  it("V3 is frozen + integrity holds", () => {
    expect(Object.isFrozen(NEX_L4_CORPUS_V3)).toBe(true);
    expect(verifyCorpusIntegrity(NEX_L4_CORPUS_V3).ok).toBe(true);
  });

  it("V3 includes every V2 case (semantically · re-versioned)", () => {
    const v2Ids = new Set(NEX_L4_CORPUS_V2.cases.map((c) => c.case_id));
    const v3Ids = new Set(NEX_L4_CORPUS_V3.cases.map((c) => c.case_id));
    for (const id of v2Ids) expect(v3Ids.has(id)).toBe(true);
  });

  it("all three corpus versions register side-by-side", () => {
    registerCorpus(NEX_L4_CORPUS_V1);
    registerCorpus(NEX_L4_CORPUS_V2);
    registerCorpus(NEX_L4_CORPUS_V3);
    const reg = readCorpusRegistry();
    expect(reg.length).toBe(3);
    const versions = new Set(reg.map((e) => e.version));
    expect(versions.has("nex-l4-corpus-v1")).toBe(true);
    expect(versions.has("nex-l4-corpus-v2")).toBe(true);
    expect(versions.has("nex-l4-corpus-v3")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § CRITICAL DIMENSION DEPTH
// ═══════════════════════════════════════════════════════════════════

describe("§V533-CRITICAL · CRITICAL_DIMENSIONS with ≥3 cases each", () => {
  it("multi_step_reasoning has ≥3 cases", () => {
    const c = NEX_L4_CORPUS_V3.cases.filter((x) => x.dimension === "multi_step_reasoning");
    expect(c.length).toBeGreaterThanOrEqual(3);
  });

  it("factuality has ≥3 cases", () => {
    const c = NEX_L4_CORPUS_V3.cases.filter((x) => x.dimension === "factuality");
    expect(c.length).toBeGreaterThanOrEqual(3);
  });

  it("adversarial_robustness has ≥3 cases", () => {
    const c = NEX_L4_CORPUS_V3.cases.filter((x) => x.dimension === "adversarial_robustness");
    expect(c.length).toBeGreaterThanOrEqual(3);
  });

  it("every CRITICAL_DIMENSION has ≥1 case (unchanged invariant)", () => {
    const covered = new Set<EvaluationDimension>();
    for (const c of NEX_L4_CORPUS_V3.cases) covered.add(c.dimension);
    for (const cd of CRITICAL_DIMENSIONS) {
      expect(covered.has(cd)).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// § WEAK-SINGLETON GAP-FILL
// ═══════════════════════════════════════════════════════════════════

describe("§V533-GAPS · weak singleton dimensions promoted", () => {
  const promoted: EvaluationDimension[] = [
    "current_information_handling", "translation", "ambiguity_handling",
    "tool_use", "research",
  ];
  for (const d of promoted) {
    it(`dimension '${d}' has ≥3 cases`, () => {
      const c = NEX_L4_CORPUS_V3.cases.filter((x) => x.dimension === d);
      expect(c.length).toBeGreaterThanOrEqual(3);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// § HELD-OUT + UX growth
// ═══════════════════════════════════════════════════════════════════

describe("§V533-HELDOUT · held-out grows monotonically", () => {
  it("V3 held-out count > V2", () => {
    const v2 = NEX_L4_CORPUS_V2.cases.filter((c) => c.held_out === true).length;
    const v3 = NEX_L4_CORPUS_V3.cases.filter((c) => c.held_out === true).length;
    expect(v3).toBeGreaterThan(v2);
  });

  it("V3 includes role-play-bypass + context-smuggling + citation-discipline held-out", () => {
    const held = NEX_L4_CORPUS_V3.cases.filter((c) => c.held_out === true);
    expect(held.some((c) => c.tags?.includes("role_play"))).toBe(true);
    expect(held.some((c) => c.tags?.includes("context_smuggling"))).toBe(true);
    expect(held.some((c) => c.tags?.includes("citation_discipline"))).toBe(true);
  });

  it("V3 UX-invariant count ≥ V2", () => {
    const v2 = NEX_L4_CORPUS_V2.cases.filter((c) => c.ux_invariant_case === true).length;
    const v3 = NEX_L4_CORPUS_V3.cases.filter((c) => c.ux_invariant_case === true).length;
    expect(v3).toBeGreaterThanOrEqual(v2);
  });
});
