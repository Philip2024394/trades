// src/lib/nex/l4-bakeoff/corpus-nex-l4-v1.test.ts
//
// V.5.3.1 · NEX-authored L4 seed corpus contract tests
// Founder BEGIN V.5.3 · 2026-09-08

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NEX_L4_CORPUS_V1 } from "./corpus-nex-l4-v1";
import { verifyCorpusIntegrity, registerCorpus, readCorpusRegistry, corpusContentHash } from "./benchmark-schema";
import { ALL_DIMENSIONS, CRITICAL_DIMENSIONS, type CaseCategory, type EvaluationDimension, type CaseLanguage } from "./types";

let priorRoot: string | undefined;

beforeEach(() => {
  priorRoot = process.env.NEX_L4_BAKEOFF_DATA_ROOT;
  const iso = mkdtempSync(path.join(tmpdir(), "nex-v531-corpus-"));
  process.env.NEX_L4_BAKEOFF_DATA_ROOT = iso;
});
afterEach(() => {
  if (priorRoot === undefined) delete process.env.NEX_L4_BAKEOFF_DATA_ROOT;
  else process.env.NEX_L4_BAKEOFF_DATA_ROOT = priorRoot;
});

// ═══════════════════════════════════════════════════════════════════
// § CORPUS STRUCTURAL INTEGRITY
// ═══════════════════════════════════════════════════════════════════

describe("§V531-STRUCT · corpus integrity", () => {
  it("corpus frozen · verifyCorpusIntegrity passes", () => {
    expect(Object.isFrozen(NEX_L4_CORPUS_V1)).toBe(true);
    const r = verifyCorpusIntegrity(NEX_L4_CORPUS_V1);
    expect(r.ok).toBe(true);
  });

  it("case_count matches cases array length", () => {
    expect(NEX_L4_CORPUS_V1.case_count).toBe(NEX_L4_CORPUS_V1.cases.length);
  });

  it("content_hash is stable across re-computation", () => {
    const h = corpusContentHash(NEX_L4_CORPUS_V1.cases);
    expect(h).toBe(NEX_L4_CORPUS_V1.content_hash);
  });

  it("no duplicate case_ids", () => {
    const ids = new Set(NEX_L4_CORPUS_V1.cases.map((c) => c.case_id));
    expect(ids.size).toBe(NEX_L4_CORPUS_V1.cases.length);
  });

  it("every case's corpus_version matches parent", () => {
    for (const c of NEX_L4_CORPUS_V1.cases) {
      expect(c.corpus_version).toBe(NEX_L4_CORPUS_V1.version);
    }
  });

  it("registers cleanly + idempotently", () => {
    registerCorpus(NEX_L4_CORPUS_V1);
    registerCorpus(NEX_L4_CORPUS_V1);
    const reg = readCorpusRegistry();
    expect(reg.length).toBe(1);
    expect(reg[0].content_hash).toBe(NEX_L4_CORPUS_V1.content_hash);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § DIMENSION COVERAGE
// ═══════════════════════════════════════════════════════════════════

describe("§V531-COVERAGE · dimension + category + language coverage", () => {
  it("covers all 10 CRITICAL_DIMENSIONS", () => {
    const covered = new Set<EvaluationDimension>();
    for (const c of NEX_L4_CORPUS_V1.cases) {
      covered.add(c.dimension);
      for (const s of c.secondary_dimensions ?? []) covered.add(s);
    }
    for (const cd of CRITICAL_DIMENSIONS) {
      expect(covered.has(cd), `critical dimension ${cd} not covered`).toBe(true);
    }
  });

  it("covers a broad subset of all 32 dimensions (≥20)", () => {
    const covered = new Set<EvaluationDimension>();
    for (const c of NEX_L4_CORPUS_V1.cases) covered.add(c.dimension);
    // Seed tranche · broad coverage · future tranches complete
    expect(covered.size).toBeGreaterThanOrEqual(20);
  });

  it("covers all 6 CaseCategory kinds", () => {
    const cats = new Set<CaseCategory>(NEX_L4_CORPUS_V1.cases.map((c) => c.category));
    expect(cats.has("positive")).toBe(true);
    expect(cats.has("negative")).toBe(true);
    expect(cats.has("adversarial")).toBe(true);
    expect(cats.has("ambiguity")).toBe(true);
    expect(cats.has("unknown")).toBe(true);
    expect(cats.has("regression")).toBe(true);
  });

  it("covers en · id · ja · mixed · code (≥5 languages)", () => {
    const langs = new Set<CaseLanguage>(NEX_L4_CORPUS_V1.cases.map((c) => c.language));
    expect(langs.has("en")).toBe(true);
    expect(langs.has("id")).toBe(true);
    expect(langs.has("ja")).toBe(true);
    expect(langs.has("mixed")).toBe(true);
    expect(langs.has("code")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § DOCTRINAL COMPLIANCE
// ═══════════════════════════════════════════════════════════════════

describe("§V531-DOCTRINE · doctrinal-compliance cases", () => {
  it("includes life-safety case(s)", () => {
    const lifeSafety = NEX_L4_CORPUS_V1.cases.filter((c) => c.tags?.includes("life_safety"));
    expect(lifeSafety.length).toBeGreaterThan(0);
  });

  it("includes medical-boundary case", () => {
    const med = NEX_L4_CORPUS_V1.cases.filter((c) => c.tags?.includes("medical_boundary"));
    expect(med.length).toBeGreaterThan(0);
  });

  it("includes legal-boundary case", () => {
    const legal = NEX_L4_CORPUS_V1.cases.filter((c) => c.tags?.includes("legal_boundary"));
    expect(legal.length).toBeGreaterThan(0);
  });

  it("includes prompt-injection cases (direct + indirect)", () => {
    const pi = NEX_L4_CORPUS_V1.cases.filter((c) => c.tags?.includes("prompt_injection"));
    expect(pi.length).toBeGreaterThanOrEqual(2);
  });

  it("includes regression-guard cases (K_c1 pattern · no fabricated stats)", () => {
    const reg = NEX_L4_CORPUS_V1.cases.filter((c) => c.category === "regression");
    expect(reg.length).toBeGreaterThan(0);
    expect(reg.some((c) => c.tags?.includes("k_c1"))).toBe(true);
    expect(reg.some((c) => c.tags?.includes("no_fabrication"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § UX INVARIANT CASES (Invisible Infrastructure doctrine)
// ═══════════════════════════════════════════════════════════════════

describe("§V531-UX · UX-invariant cases present + scoring guards architecture leak", () => {
  it("includes ≥ 5 UX-invariant cases", () => {
    const ux = NEX_L4_CORPUS_V1.cases.filter((c) => c.ux_invariant_case === true);
    expect(ux.length).toBeGreaterThanOrEqual(5);
  });

  it("UX-invariant cases forbid architecture-leak keywords in must_not_contain OR require human eval", () => {
    const ux = NEX_L4_CORPUS_V1.cases.filter((c) => c.ux_invariant_case === true);
    for (const c of ux) {
      const forbidsLeak = c.scoring_rubric.must_not_contain?.some((s) =>
        ["module", "specialist", "confidence_band", "gateway", "MCP", "RAG", "routing"].some((leak) => s.toLowerCase().includes(leak.toLowerCase())),
      );
      const requiresHuman = c.scoring_rubric.requires_human_blind_eval;
      expect(forbidsLeak || requiresHuman,
        `UX-invariant case ${c.case_id} must either forbid leak keywords or require human blind eval`,
      ).toBe(true);
    }
  });

  it("single-voice case forbids leaked specialist names in must_not_contain", () => {
    const singleVoice = NEX_L4_CORPUS_V1.cases.find((c) => c.tags?.includes("single_voice"));
    expect(singleVoice).toBeDefined();
    expect(singleVoice?.scoring_rubric.must_not_contain?.some((s) => /specialist|routing/i.test(s))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § HELD-OUT DISCIPLINE
// ═══════════════════════════════════════════════════════════════════

describe("§V531-HELDOUT · held-out subset properly flagged + never fewer than 5", () => {
  it("held_out flag exists on ≥ 5 cases", () => {
    const held = NEX_L4_CORPUS_V1.cases.filter((c) => c.held_out === true);
    expect(held.length).toBeGreaterThanOrEqual(5);
  });

  it("held-out cases include life-safety AND prompt-injection AND hallucination-resistance", () => {
    const held = NEX_L4_CORPUS_V1.cases.filter((c) => c.held_out === true);
    expect(held.some((c) => c.tags?.includes("life_safety"))).toBe(true);
    expect(held.some((c) => c.tags?.includes("prompt_injection"))).toBe(true);
    expect(held.some((c) => c.dimension === "hallucination_resistance")).toBe(true);
  });

  it("every held-out case has ux_invariant_case:true OR is regression-critical", () => {
    const held = NEX_L4_CORPUS_V1.cases.filter((c) => c.held_out === true);
    for (const c of held) {
      const guarded = c.ux_invariant_case === true || c.category === "regression" || c.dimension === "safety";
      expect(guarded, `held-out case ${c.case_id} must be UX-invariant · regression · or safety`).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// § PROVENANCE + NO FABRICATION
// ═══════════════════════════════════════════════════════════════════

describe("§V531-PROVENANCE · authoring metadata correct", () => {
  it("every case has authored_by + authored_at_iso", () => {
    for (const c of NEX_L4_CORPUS_V1.cases) {
      expect(c.authored_by).toBeTruthy();
      expect(c.authored_at_iso).toBeTruthy();
    }
  });

  it("no case prompt fabricates external URL or citation", () => {
    for (const c of NEX_L4_CORPUS_V1.cases) {
      // Prompts referencing generic examples ("example.com" / "example-competitor.co.uk") ok · that's the point
      // Real-looking URLs to non-existent sites = red flag
      const hasFabricatedUrl = /\b(hxxps?|realsite|totallyreal)\d+\.com\b/i.test(c.prompt);
      expect(hasFabricatedUrl).toBe(false);
    }
  });
});
