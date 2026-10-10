// Unit tests · Stage 1.6 Containment · capability-selection-kind.
// Locks the `decl@` scope-identifier contract so future code cannot silently
// treat scoped identifiers as filesystem paths.

import { describe, it, expect } from "vitest";
import {
  DECLARATION_SCOPE_PREFIX,
  isDeclarationScope,
  stripDeclarationScope,
  scopeKind,
  realSourceFile,
  scopeKindOfRanking,
  scopeKindOfRankingRecord,
  interpretSelection,
} from "./capability-selection-kind";
import type { CandidateSelection } from "./capability-candidate-selector";
import type { CandidateRanking, RankingScope } from "./capability-candidate-ranker";

function makeSel(overrides: Partial<CandidateSelection>): CandidateSelection {
  return {
    investigation_id: null,
    trace_id: null,
    source_file: "src/lib/foo.ts",
    selection_state: "SELECTED",
    selected_candidate: "src/lib/foo.ts::candidate::10:10:sym",
    rankings_reference: {
      policy_id: "NEX1_RANKING_POLICY",
      policy_version: "V1",
      source_file: "src/lib/foo.ts",
    },
    candidates_considered: [],
    supporting_evidence_ids: [],
    contradicting_evidence_ids: [],
    insufficient_evidence_ids: [],
    unresolved_evidence_ids: [],
    decision_reason: "",
    confidence: 0.35,
    provenance: [{ source_file: "src/lib/foo.ts", start_line: 10, end_line: 10 }],
    policy_id: "NEX1_Q8_SELECTION_POLICY",
    policy_version: "V1",
    uncertainty: null,
    recommended_next_action: "",
    evidence_kind: "INFERRED",
    ...overrides,
  };
}

describe("capability-selection-kind · contract lock", () => {
  it("DECLARATION_SCOPE_PREFIX is exactly the string 'decl@'", () => {
    // Locks the prefix literal. Any change to this constant is a breaking
    // change to every downstream consumer and must be an explicit doctrine
    // update.
    expect(DECLARATION_SCOPE_PREFIX).toBe("decl@");
  });

  it("isDeclarationScope · recognises prefix", () => {
    expect(isDeclarationScope("decl@src/lib/foo.ts")).toBe(true);
    expect(isDeclarationScope("src/lib/foo.ts")).toBe(false);
    expect(isDeclarationScope("")).toBe(false);
    expect(isDeclarationScope("dec@src/lib/foo.ts")).toBe(false);
    expect(isDeclarationScope("DECL@src/lib/foo.ts")).toBe(false);  // case-sensitive
  });

  it("stripDeclarationScope · removes exactly one prefix instance", () => {
    expect(stripDeclarationScope("decl@src/lib/foo.ts")).toBe("src/lib/foo.ts");
    // Only ONE prefix removed even when nested; if a future code path emits
    // `decl@decl@foo` the strip returns `decl@foo`, still a scope key.
    expect(stripDeclarationScope("decl@decl@src/lib/foo.ts")).toBe("decl@src/lib/foo.ts");
    // No prefix → unchanged.
    expect(stripDeclarationScope("src/lib/foo.ts")).toBe("src/lib/foo.ts");
    expect(stripDeclarationScope("")).toBe("");
  });

  it("scopeKind · declaration vs root_cause", () => {
    expect(scopeKind("decl@src/lib/foo.ts")).toBe("declaration");
    expect(scopeKind("src/lib/foo.ts")).toBe("root_cause");
  });

  it("realSourceFile · uses provenance when non-empty and unprefixed", () => {
    const sel = makeSel({
      source_file: "decl@src/lib/foo.ts",
      provenance: [{ source_file: "src/lib/foo.ts", start_line: 10, end_line: 10 }],
    });
    expect(realSourceFile(sel)).toBe("src/lib/foo.ts");
  });

  it("realSourceFile · strips prefix when provenance is empty", () => {
    const sel = makeSel({
      source_file: "decl@src/lib/foo.ts",
      provenance: [],
    });
    expect(realSourceFile(sel)).toBe("src/lib/foo.ts");
  });

  it("realSourceFile · never returns a string starting with the prefix", () => {
    const sel = makeSel({
      source_file: "decl@src/lib/foo.ts",
      provenance: [{ source_file: "decl@corrupted", start_line: 1, end_line: 1 }],
    });
    // Even if provenance is corrupted with the prefix, the accessor falls
    // through to the source_file strip path and returns a clean value.
    expect(realSourceFile(sel).startsWith(DECLARATION_SCOPE_PREFIX)).toBe(false);
  });

  it("realSourceFile · empty string when nothing is known", () => {
    const sel = makeSel({ source_file: "", provenance: [] });
    expect(realSourceFile(sel)).toBe("");
  });

  it("interpretSelection · declaration scope produces full interpretation", () => {
    const sel = makeSel({
      source_file: "decl@src/lib/foo.ts",
      selected_candidate: "decl@src/lib/foo.ts::candidate::10:10:sym",
      provenance: [{ source_file: "src/lib/foo.ts", start_line: 10, end_line: 10 }],
    });
    const interp = interpretSelection(sel);
    expect(interp.kind).toBe("declaration");
    expect(interp.scope_key).toBe("decl@src/lib/foo.ts");
    expect(interp.real_source_file).toBe("src/lib/foo.ts");
    expect(interp.selected_candidate).toBe("decl@src/lib/foo.ts::candidate::10:10:sym");
    expect(interp.stripped_selected_candidate).toBe(
      "src/lib/foo.ts::candidate::10:10:sym",
    );
  });

  it("interpretSelection · root_cause scope leaves candidate_id untouched", () => {
    const sel = makeSel({
      source_file: "src/lib/foo.ts",
      selected_candidate: "src/lib/foo.ts::candidate::10:10:sym",
    });
    const interp = interpretSelection(sel);
    expect(interp.kind).toBe("root_cause");
    expect(interp.stripped_selected_candidate).toBe(
      "src/lib/foo.ts::candidate::10:10:sym",
    );
  });

  it("scopeKindOfRanking · classifies Q7 scope objects", () => {
    const scope: RankingScope = {
      source_file: "decl@src/lib/foo.ts",
      scope_state: "SINGLETON",
      rankings: [],
      rule_trace: [],
    };
    expect(scopeKindOfRanking(scope)).toBe("declaration");
  });

  it("scopeKindOfRankingRecord · classifies Q7 record objects", () => {
    const record: CandidateRanking = {
      candidate_id: "decl@src/lib/foo.ts::candidate::10:10:sym",
      source_file: "decl@src/lib/foo.ts",
      rank_position: 1,
      ranking_state: "RANKED",
      differentiating_rule: null,
      supporting_count: 1,
      contradicting_count: 0,
      insufficient_count: 0,
      unresolved_count: 0,
      deduplicated_relationship_ids: [],
      evidence_kind: "INFERRED",
      confidence: 0.35,
      policy_id: "NEX1_RANKING_POLICY",
      policy_version: "V1",
    };
    expect(scopeKindOfRankingRecord(record)).toBe("declaration");
  });

  it("determinism · repeated calls return identical results", () => {
    const sel = makeSel({
      source_file: "decl@src/lib/foo.ts",
      selected_candidate: "decl@src/lib/foo.ts::candidate::10:10:sym",
    });
    const a = interpretSelection(sel);
    const b = interpretSelection(sel);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
