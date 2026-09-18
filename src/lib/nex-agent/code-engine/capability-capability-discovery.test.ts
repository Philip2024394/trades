// Fix 35 · Capability Discovery · unit tests.
import { describe, it, expect } from "vitest";
import {
  induceRules,
  predictFromRules,
  CAPABILITY_DISCOVERY_VERSION,
  _INTERNAL,
} from "./capability-capability-discovery";
import type { InvestigationConclusionEntry } from "./investigation-conclusion-store";

function e(overrides: Partial<InvestigationConclusionEntry>): InvestigationConclusionEntry {
  return {
    entry_id: overrides.entry_id ?? "e-" + Math.random().toString(36).slice(2, 8),
    timestamp: overrides.timestamp ?? "2026-09-18T00:00:00Z",
    investigation_id: null,
    trace_id: null,
    source_file: overrides.source_file ?? "src/lib/x/y.ts",
    selection_state: overrides.selection_state ?? "SELECTED",
    selected_candidate: overrides.selected_candidate ?? null,
    candidates_considered: [],
    rankings_reference: { policy_id: "NEX1_RANKING_POLICY", policy_version: "V1", source_file: overrides.source_file ?? "src/lib/x/y.ts" },
    supporting_evidence_ids: [],
    contradicting_evidence_ids: [],
    insufficient_evidence_ids: [],
    unresolved_evidence_ids: [],
    decision_reason: "test",
    confidence: 0.35,
    provenance: [],
    policy_id: "NEX1_Q8_SELECTION_POLICY",
    policy_version: "V1",
    uncertainty: null,
    recommended_next_action: "n/a",
    evidence_kind: "INFERRED",
    ...overrides,
  };
}

describe("Fix 35 · induceRules", () => {
  it("returns no rules when store is empty", () => {
    expect(induceRules([], 2)).toEqual([]);
  });

  it("returns no rules when only one entry is present (below min_support)", () => {
    const rules = induceRules([e({ source_file: "src/lib/a.ts", selected_candidate: "src/lib/a.ts::1" })], 2);
    expect(rules).toEqual([]);
  });

  it("discovers `::` separator + prefix-equals-source-file + numeric-suffix invariants from 3 numeric-SELECTED entries", () => {
    const entries = [
      e({ source_file: "src/lib/one/a.ts", selected_candidate: "src/lib/one/a.ts::11" }),
      e({ source_file: "src/lib/two/b.ts", selected_candidate: "src/lib/two/b.ts::22" }),
      e({ source_file: "src/lib/three/c.ts", selected_candidate: "src/lib/three/c.ts::33" }),
    ];
    const rules = induceRules(entries, 2);
    expect(rules).toHaveLength(1);
    const r = rules[0];
    expect(r.support_count).toBe(3);
    const kinds = r.invariants.map((i) => i.kind);
    expect(kinds).toContain("selected_candidate_has_double_colon_separator");
    expect(kinds).toContain("selected_candidate_prefix_equals_source_file");
    expect(kinds).toContain("selected_candidate_suffix_is_numeric");
    expect(kinds).toContain("all_entries_share_path_prefix");
    // The path prefix invariant should record the shared prefix
    const shared = r.invariants.find((i) => i.kind === "all_entries_share_path_prefix");
    expect(shared?.extra?.path_prefix).toBe("src/lib");
  });

  it("distinguishes numeric from string-quoted suffix invariants", () => {
    // Note: Fix 34's path_dir_second is the SECOND path segment. Using
    // `docs/pages/*` here so both entries share path_dir_second="pages".
    const entries = [
      e({ source_file: "docs/pages/a.md", selected_candidate: 'docs/pages/a.md::"hi"' }),
      e({ source_file: "docs/pages/b.md", selected_candidate: 'docs/pages/b.md::"bye"' }),
    ];
    const rules = induceRules(entries, 2);
    expect(rules).toHaveLength(1);
    const kinds = rules[0].invariants.map((i) => i.kind);
    expect(kinds).toContain("selected_candidate_suffix_is_quoted_string");
    expect(kinds).not.toContain("selected_candidate_suffix_is_numeric");
  });

  it("does NOT emit a shape-signature-based rule when no invariant fires", () => {
    // Two entries that agree on Fix 34 shape features (has_signature_format=false ·
    // value_type=empty · path_dir_root=src · selection_state=SELECTED) so they group
    // together, but no INDUCTION_PROBES invariants hold. Result: no rule emitted.
    const entries = [
      e({ source_file: "src/foo.ts", selected_candidate: null }),
      e({ source_file: "src/bar.ts", selected_candidate: null }),
    ];
    const rules = induceRules(entries, 2);
    expect(rules).toEqual([]);
  });

  it("different seeds produce different rule_ids", () => {
    const numericSeed = [
      e({ source_file: "src/lib/a.ts", selected_candidate: "src/lib/a.ts::1" }),
      e({ source_file: "src/lib/b.ts", selected_candidate: "src/lib/b.ts::2" }),
    ];
    const stringSeed = [
      e({ source_file: "src/lib/a.ts", selected_candidate: 'src/lib/a.ts::"x"' }),
      e({ source_file: "src/lib/b.ts", selected_candidate: 'src/lib/b.ts::"y"' }),
    ];
    const r1 = induceRules(numericSeed, 2);
    const r2 = induceRules(stringSeed, 2);
    expect(r1[0].rule_id).not.toBe(r2[0].rule_id);
  });

  it("is deterministic — identical seeds produce identical rule_ids", () => {
    const seed = [
      e({ source_file: "src/lib/a.ts", selected_candidate: "src/lib/a.ts::7" }),
      e({ source_file: "src/lib/b.ts", selected_candidate: "src/lib/b.ts::8" }),
    ];
    const r1 = induceRules(seed, 2);
    const r2 = induceRules(seed, 2);
    expect(r1[0].rule_id).toBe(r2[0].rule_id);
  });

  it("universal quantification: invariant fires only when it holds across ALL supporting entries", () => {
    // If any single entry violates the numeric-suffix invariant, it must NOT be reported.
    // Wait — Fix 34 groups by exact features, and value_type would be different, so the
    // violating entry lands in a different group. Assert grouping keeps invariants pure.
    const mixed = [
      e({ source_file: "src/lib/a.ts", selected_candidate: "src/lib/a.ts::1" }),          // numeric
      e({ source_file: "src/lib/b.ts", selected_candidate: "src/lib/b.ts::2" }),          // numeric
      e({ source_file: "src/lib/c.ts", selected_candidate: 'src/lib/c.ts::"hi"' }),       // string
    ];
    const rules = induceRules(mixed, 2);
    // Only the numeric group has support 2; the string group has support 1.
    expect(rules).toHaveLength(1);
    const kinds = rules[0].invariants.map((i) => i.kind);
    expect(kinds).toContain("selected_candidate_suffix_is_numeric");
    expect(kinds).not.toContain("selected_candidate_suffix_is_quoted_string");
  });

  it("all invariants carry evidence_entry_ids pointing to the supporting group", () => {
    const entries = [
      e({ entry_id: "id-A", source_file: "src/lib/a.ts", selected_candidate: "src/lib/a.ts::1" }),
      e({ entry_id: "id-B", source_file: "src/lib/b.ts", selected_candidate: "src/lib/b.ts::2" }),
    ];
    const rules = induceRules(entries, 2);
    for (const inv of rules[0].invariants) {
      expect(inv.evidence_entry_ids.sort()).toEqual(["id-A", "id-B"]);
    }
  });

  it("carries the R11-B marker on every rule", () => {
    const entries = [
      e({ source_file: "src/lib/a.ts", selected_candidate: "src/lib/a.ts::1" }),
      e({ source_file: "src/lib/b.ts", selected_candidate: "src/lib/b.ts::2" }),
    ];
    const rules = induceRules(entries, 2);
    expect(rules[0].r11b_marker).toBe("DISCOVERED_RULE_MUST_NOT_ENTER_R4_SUPPORTING_COUNT");
    expect(rules[0].evidence_kind).toBe("INFERRED");
  });
});

describe("Fix 35 · predictFromRules · application to novel input", () => {
  const trainedRules = induceRules(
    [
      e({ source_file: "src/lib/a.ts", selected_candidate: "src/lib/a.ts::11" }),
      e({ source_file: "src/lib/b.ts", selected_candidate: "src/lib/b.ts::22" }),
      e({ source_file: "src/lib/c.ts", selected_candidate: "src/lib/c.ts::33" }),
    ],
    2,
  );

  it("predicts numeric value from suffix for a novel same-family input", () => {
    const p = predictFromRules(trainedRules, {
      source_file: "src/lib/never-seen.ts",
      selected_candidate: "src/lib/never-seen.ts::99",
      selection_state: "SELECTED",
    });
    expect(p.kind).toBe("value_from_selected_candidate_suffix");
    expect(p.predicted_value_type).toBe("number");
    expect(p.predicted_value).toBe(99);
    expect(p.rule_id).not.toBeNull();
  });

  it("refuses when input shape does not match any rule", () => {
    const p = predictFromRules(trainedRules, {
      source_file: "docs/never-seen.md",
      selected_candidate: 'docs/never-seen.md::"hi"',
      selection_state: "SELECTED",
    });
    expect(p.kind).toBe("no_applicable_rule");
    expect(p.predicted_value).toBeNull();
    expect(p.predicted_value_type).toBeNull();
  });

  it("refuses when input has no `::` separator even if shape features would otherwise match", () => {
    const p = predictFromRules(trainedRules, {
      source_file: "src/lib/whatever.ts",
      selected_candidate: null,
      selection_state: "SELECTED",
    });
    expect(p.kind).toBe("no_applicable_rule");
  });

  it("carries the R11-B marker on every prediction", () => {
    const p = predictFromRules(trainedRules, {
      source_file: "src/lib/x.ts",
      selected_candidate: "src/lib/x.ts::5",
      selection_state: "SELECTED",
    });
    expect(p.r11b_marker).toBe("DISCOVERED_PREDICTION_MUST_NOT_ENTER_R4_SUPPORTING_COUNT");
    expect(p.evidence_kind).toBe("INFERRED");
  });

  it("is deterministic — same input twice yields identical output", () => {
    const inp = { source_file: "src/lib/z.ts", selected_candidate: "src/lib/z.ts::7", selection_state: "SELECTED" as const };
    expect(predictFromRules(trainedRules, inp)).toEqual(predictFromRules(trainedRules, inp));
  });
});

describe("Fix 35 · exports + integrity", () => {
  it("exports the version tag", () => {
    expect(CAPABILITY_DISCOVERY_VERSION).toBe("fix35.v1");
  });
  it("exposes the induction probes internally (audit surface)", () => {
    expect(_INTERNAL.INDUCTION_PROBES.length).toBeGreaterThan(0);
  });
});
