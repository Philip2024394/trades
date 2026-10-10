// Unit tests · Stage 1.6 Declaration Bridge · zero LLM · deterministic.

import { describe, it, expect } from "vitest";
import { buildDeclarationEvaluations } from "./capability-declaration-bridge";
import { discoverRepositoryCandidates } from "./capability-repository-discovery";
import { rankCandidates } from "./capability-candidate-ranker";
import { selectCandidates } from "./capability-candidate-selector";

const REPO_ROOT = process.cwd();

function stripDeclScopePrefix(scope: string): string {
  return scope.startsWith("decl@") ? scope.slice("decl@".length) : scope;
}

function runFor(concepts: string[]) {
  const disc = discoverRepositoryCandidates({
    concepts,
    repo_root: REPO_ROOT,
    allowed_root_prefixes: ["src", "docs/doctrine"],
    priority_prefixes: ["src/lib/nex-agent"],
    definition_intent: true,
    max_files_scanned: 500,
    max_candidates: 50,
  });
  const bridge = buildDeclarationEvaluations({
    candidates: disc.candidates,
    concept_tokens: concepts,
    repo_root: REPO_ROOT,
  });
  const rank = rankCandidates({
    evaluations: bridge.evaluations,
    evidence_records: bridge.evidence_records,
  });
  const sel = selectCandidates({
    evaluations: bridge.evaluations,
    evidence_records: bridge.evidence_records,
    rankings: rank.scopes,
  });
  return { disc, bridge, rank, sel };
}

describe("capability-declaration-bridge · F1 formula", () => {
  it("Q1 · assessFear · selects capability-fear.ts", () => {
    const { sel } = runFor(["assessFear"]);
    const selected = sel.selections
      .filter((s) => s.selection_state === "SELECTED")
      .map((s) => stripDeclScopePrefix(s.source_file));
    expect(selected).toContain("src/lib/nex-agent/code-engine/capability-fear.ts");
    expect(selected.length).toBe(1);
  });

  it("Q2 · runNativeInvestigation · selects native-investigation-mode.ts", () => {
    const { sel } = runFor(["runNativeInvestigation"]);
    const selected = sel.selections
      .filter((s) => s.selection_state === "SELECTED")
      .map((s) => stripDeclScopePrefix(s.source_file));
    expect(selected).toContain("src/lib/nex-agent/code-engine/native-investigation-mode.ts");
    expect(selected.length).toBe(1);
  });

  it("Q3 · InvestigationConclusionEntry · selects investigation-conclusion-store.ts", () => {
    const { sel } = runFor(["InvestigationConclusionEntry"]);
    const selected = sel.selections
      .filter((s) => s.selection_state === "SELECTED")
      .map((s) => stripDeclScopePrefix(s.source_file));
    expect(selected).toContain("src/lib/nex-agent/code-engine/investigation-conclusion-store.ts");
  });

  it("Q4 · patternIdOf · selects both legitimate declarations", () => {
    const { sel } = runFor(["patternIdOf"]);
    const selected = sel.selections
      .filter((s) => s.selection_state === "SELECTED")
      .map((s) => stripDeclScopePrefix(s.source_file));
    expect(selected).toContain("src/lib/nex-agent/code-engine/capability-experience-abstraction.ts");
    expect(selected).toContain("src/lib/nex-agent/code-engine/capability-outcome-experience.ts");
    expect(selected.length).toBe(2);
  });

  it("A1 · toForwardSlash · preserves all 3 legitimate private declarations", () => {
    const { sel } = runFor(["toForwardSlash"]);
    const selected = sel.selections
      .filter((s) => s.selection_state === "SELECTED")
      .map((s) => stripDeclScopePrefix(s.source_file));
    expect(selected).toContain("src/lib/nex-agent/code-engine/capability-specification-driven-loop.ts");
    expect(selected).toContain("src/lib/nex-agent/code-engine/capability-verification-case-generator.ts");
    expect(selected).toContain("src/lib/nex-agent/code-engine/capability-m-file-memory/seed-from-content.ts");
    expect(selected.length).toBe(3);
  });

  it("A2 · recordEvidence · preserves function + method declarations", () => {
    const { sel } = runFor(["recordEvidence"]);
    const selected = sel.selections
      .filter((s) => s.selection_state === "SELECTED")
      .map((s) => stripDeclScopePrefix(s.source_file));
    expect(selected).toContain("src/lib/nex-agent/adversarial-corpus.ts");
    expect(selected).toContain("src/lib/nex-agent/code-engine/nex1-decision-trail.ts");
    expect(selected.length).toBe(2);
  });

  it("N1 · negative control · refuses to fabricate a selection", () => {
    const { sel } = runFor(["someSymbolThatDoesNotExistAnywhereInRepo"]);
    const selected = sel.selections.filter((s) => s.selection_state === "SELECTED");
    expect(selected.length).toBe(0);
  });

  it("N2 · usage-only file never wins · walker recognises it as non-declaration", () => {
    // capability-fear.ts is the only declaration site for assessFear.
    // Files that only reference the token but do not declare it must not
    // appear in the SELECTED set. Verified by counting SELECTED = 1.
    const { sel } = runFor(["assessFear"]);
    const selected = sel.selections
      .filter((s) => s.selection_state === "SELECTED")
      .map((s) => stripDeclScopePrefix(s.source_file));
    expect(selected).toEqual(["src/lib/nex-agent/code-engine/capability-fear.ts"]);
  });

  it("determinism · two runs produce identical evaluations + evidence records", () => {
    const a = runFor(["assessFear"]);
    const b = runFor(["assessFear"]);
    expect(JSON.stringify(a.bridge.evaluations)).toBe(JSON.stringify(b.bridge.evaluations));
    expect(JSON.stringify(a.bridge.evidence_records)).toBe(JSON.stringify(b.bridge.evidence_records));
  });

  it("evidence_kind is INFERRED across all emissions · never PROVEN · never OBSERVED", () => {
    const { bridge } = runFor(["assessFear"]);
    for (const e of bridge.evaluations) expect(e.evidence_kind).toBe("INFERRED");
    for (const r of bridge.evidence_records) expect(r.evidence_kind).toBe("INFERRED");
  });

  it("Q4 · candidate_id format is deterministic and includes discovered line number", () => {
    const { bridge } = runFor(["patternIdOf"]);
    for (const e of bridge.evaluations) {
      expect(e.candidate_id).toMatch(/^decl@src\/lib\/nex-agent\/.+::candidate::\d+:\d+:patternIdOf$/);
      expect(e.provenance.length).toBe(1);
      expect(e.provenance[0].source_file).toMatch(/^src\/lib\/nex-agent\//);
      expect(e.provenance[0].start_line).toBeGreaterThan(0);
      expect(e.provenance[0].start_line).toBe(e.provenance[0].end_line);
    }
  });

  it("no evaluation trips Q8 forbidden-causal-vocabulary defence", () => {
    const { sel } = runFor(["assessFear"]);
    const forbidden = ["causes", "caused by", "therefore", "root cause is",
      "responsible for", "leads to", "results in", "because"];
    for (const s of sel.selections) {
      const text = `${s.decision_reason} ${s.uncertainty ?? ""} ${s.recommended_next_action}`.toLowerCase();
      for (const f of forbidden) expect(text.includes(f)).toBe(false);
    }
  });

  it("empty concepts → empty output", () => {
    const b = buildDeclarationEvaluations({
      candidates: [],
      concept_tokens: [],
      repo_root: REPO_ROOT,
    });
    expect(b.evaluations.length).toBe(0);
    expect(b.evidence_records.length).toBe(0);
    expect(b.stats.zero_llm).toBe(true);
  });

  it("walker candidate with is_declaration_site=false is IGNORED", () => {
    const b = buildDeclarationEvaluations({
      candidates: [
        {
          repo_relative_path: "src/somefile.ts",
          matched_concept_tokens: ["foo"],
          match_score: 5,
          filename_matches: 0,
          content_matches: 5,
          evidence_lines: [],
          declaration_matches: 0,
          private_declaration_matches: 0,
          method_declaration_matches: 0,
          is_declaration_site: false,
        },
      ],
      concept_tokens: ["foo"],
      repo_root: REPO_ROOT,
    });
    expect(b.evaluations.length).toBe(0);
    expect(b.stats.declaration_sites_found).toBe(0);
  });
});
