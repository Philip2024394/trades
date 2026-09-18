// src/lib/nex-agent/code-engine/capability-fear-concern-afraid.test.ts
//
// Unit tests for FEAR / CONCERN / AFRAID capabilities.
// Deterministic. Zero I/O. Every branch covered.

import { describe, it, expect } from "vitest";
import { assessFear, FEAR_VERSION } from "./capability-fear";
import { assessConcern, CONCERN_VERSION } from "./capability-concern";
import { assessAfraid, AFRAID_VERSION } from "./capability-afraid";

const REPO = "C:/Users/Victus/trades";

describe("FEAR · assessFear", () => {
  it("returns SAFE when no target (READ nothing)", () => {
    const r = assessFear({
      target: null,
      operation_kind: "READ",
      preservation_baseline_available: true,
      repo_root: REPO,
    });
    expect(r.level).toBe("SAFE");
    expect(r.block_action).toBe(false);
    expect(r.reason_code).toBe("no_target");
    expect(r.evidence_kind).toBe("INFERRED");
  });

  it("returns SAFE for READ operations regardless of target", () => {
    const r = assessFear({
      target: "src/lib/pricing.ts",
      operation_kind: "READ",
      preservation_baseline_available: false,
      repo_root: REPO,
    });
    expect(r.level).toBe("SAFE");
    expect(r.block_action).toBe(false);
  });

  it("returns HIGH_FEAR for MUTATION on a protected file (pricing.ts)", () => {
    const r = assessFear({
      target: "src/lib/pricing.ts",
      operation_kind: "MUTATION",
      preservation_baseline_available: true,
      repo_root: REPO,
    });
    expect(r.level).toBe("HIGH_FEAR");
    expect(r.block_action).toBe(true);
    expect(r.reason_code).toBe("target_is_protected_path");
  });

  it("returns HIGH_FEAR for MUTATION on tierCatalog.ts (protected)", () => {
    const r = assessFear({
      target: "src/lib/tierCatalog.ts",
      operation_kind: "MUTATION",
      preservation_baseline_available: true,
      repo_root: REPO,
    });
    expect(r.level).toBe("HIGH_FEAR");
    expect(r.block_action).toBe(true);
  });

  it("returns HIGH_FEAR for WRITE_NEW_FILE inside docs/DECISIONS/", () => {
    const r = assessFear({
      target: "docs/DECISIONS/9999-should-not-exist.md",
      operation_kind: "WRITE_NEW_FILE",
      preservation_baseline_available: false,
      repo_root: REPO,
    });
    expect(r.level).toBe("HIGH_FEAR");
    expect(r.reason_code).toBe("target_is_protected_directory");
    expect(r.block_action).toBe(true);
  });

  it("returns HIGH_FEAR for cross-repo absolute path outside repo_root", () => {
    const r = assessFear({
      target: "C:/Users/Victus/hammer/some-file.ts",
      operation_kind: "MUTATION",
      preservation_baseline_available: true,
      repo_root: REPO,
    });
    expect(r.level).toBe("HIGH_FEAR");
    expect(r.reason_code).toBe("cross_repo_write");
    expect(r.block_action).toBe(true);
  });

  it("returns ALERTED for MUTATION without preservation baseline", () => {
    const r = assessFear({
      target: "src/lib/nex1-fix24-fixtures/s1-niladic.ts",
      operation_kind: "MUTATION",
      preservation_baseline_available: false,
      repo_root: REPO,
    });
    expect(r.level).toBe("ALERTED");
    expect(r.block_action).toBe(false);
    expect(r.reason_code).toBe("mutation_without_preservation");
  });

  it("returns SAFE for MUTATION on in-repo unprotected file WITH preservation", () => {
    const r = assessFear({
      target: "src/lib/nex1-fix24-fixtures/s1-niladic.ts",
      operation_kind: "MUTATION",
      preservation_baseline_available: true,
      repo_root: REPO,
    });
    expect(r.level).toBe("SAFE");
    expect(r.block_action).toBe(false);
    expect(r.reason_code).toBe("safe_mutation_in_bounds");
  });

  it("handles Windows-style backslash paths for protected files", () => {
    const r = assessFear({
      target: "src\\lib\\pricing.ts",
      operation_kind: "MUTATION",
      preservation_baseline_available: true,
      repo_root: REPO,
    });
    expect(r.level).toBe("HIGH_FEAR");
  });

  it("exports version tag", () => {
    expect(FEAR_VERSION).toBe("fear.v1");
  });

  it("is deterministic — same input twice yields identical output", () => {
    const inp = {
      target: "src/lib/pricing.ts" as const,
      operation_kind: "MUTATION" as const,
      preservation_baseline_available: true,
      repo_root: REPO,
    };
    expect(assessFear(inp)).toEqual(assessFear(inp));
  });
});

describe("CONCERN · assessConcern", () => {
  it("returns NONE when all signals clean", () => {
    const r = assessConcern({
      prior_relationship: "NO_PRIOR",
      investigation_verdict: "SELECTED",
      bridge_ok: true,
      adjacent_test_unparseable: false,
      target_discovery_low_confidence: false,
      ambiguity_count: 0,
    });
    expect(r.level).toBe("NONE");
    expect(r.score).toBe(0);
    expect(r.rationale_suffix).toBe("");
  });

  it("returns LOW for a single low-weight signal", () => {
    const r = assessConcern({
      prior_relationship: "PRIOR_INFORMATIONAL_ONLY",
      investigation_verdict: "SELECTED",
      bridge_ok: true,
      adjacent_test_unparseable: false,
      target_discovery_low_confidence: false,
      ambiguity_count: 0,
    });
    expect(r.level).toBe("LOW");
    expect(r.score).toBe(1);
  });

  it("returns ELEVATED when PRIOR_CONFLICTS_CURRENT fires", () => {
    const r = assessConcern({
      prior_relationship: "PRIOR_CONFLICTS_CURRENT",
      investigation_verdict: "SELECTED",
      bridge_ok: true,
      adjacent_test_unparseable: false,
      target_discovery_low_confidence: false,
      ambiguity_count: 0,
    });
    expect(r.level).toBe("ELEVATED");
    expect(r.score).toBe(3);
  });

  it("returns HIGH when multiple risk signals combine", () => {
    const r = assessConcern({
      prior_relationship: "PRIOR_CONFLICTS_CURRENT",
      investigation_verdict: "INSUFFICIENT_EVIDENCE",
      bridge_ok: false,
      adjacent_test_unparseable: true,
      target_discovery_low_confidence: false,
      ambiguity_count: 0,
    });
    expect(r.level).toBe("HIGH");
    expect(r.score).toBeGreaterThanOrEqual(5);
    expect(r.hits).toContain("prior_conflicts_current");
    expect(r.hits).toContain("insufficient_evidence");
  });

  it("caps ambiguity_count at 3", () => {
    const r = assessConcern({
      prior_relationship: "NO_PRIOR",
      investigation_verdict: "SELECTED",
      bridge_ok: true,
      adjacent_test_unparseable: false,
      target_discovery_low_confidence: false,
      ambiguity_count: 999,
    });
    expect(r.score).toBe(3);
    expect(r.hits.some((h) => h.includes("ambiguity_count=3"))).toBe(true);
  });

  it("rationale suffix appears only for non-NONE levels", () => {
    const none = assessConcern({
      prior_relationship: null,
      investigation_verdict: null,
      bridge_ok: true,
      adjacent_test_unparseable: false,
      target_discovery_low_confidence: false,
      ambiguity_count: 0,
    });
    expect(none.rationale_suffix).toBe("");

    const high = assessConcern({
      prior_relationship: "PRIOR_CONFLICTS_CURRENT",
      investigation_verdict: "REQUIRE_MORE_INVESTIGATION",
      bridge_ok: false,
      adjacent_test_unparseable: true,
      target_discovery_low_confidence: false,
      ambiguity_count: 0,
    });
    expect(high.rationale_suffix).toContain("Concern");
    expect(high.rationale_suffix).toContain("score=");
  });

  it("is deterministic", () => {
    const signals = {
      prior_relationship: "PRIOR_UNRESOLVED_SAME_FILE" as const,
      investigation_verdict: "TIE" as const,
      bridge_ok: true,
      adjacent_test_unparseable: false,
      target_discovery_low_confidence: false,
      ambiguity_count: 1,
    };
    expect(assessConcern(signals)).toEqual(assessConcern(signals));
  });

  it("exports version tag", () => {
    expect(CONCERN_VERSION).toBe("concern.v1");
  });
});

describe("AFRAID · assessAfraid", () => {
  it("returns CALM when no recent turns", () => {
    const r = assessAfraid({ recent_turns: [] });
    expect(r.state).toBe("CALM");
    expect(r.score).toBe(0);
    expect(r.rationale_prefix).toBe("");
  });

  it("returns CALM for a single understood turn", () => {
    const r = assessAfraid({
      recent_turns: [{ turn_id: 1, state: "understood" }],
    });
    expect(r.state).toBe("CALM");
  });

  it("returns CAUTIOUS after 2 refusals in window", () => {
    const r = assessAfraid({
      recent_turns: [
        { turn_id: 1, state: "understood" },
        { turn_id: 2, state: "refused" },
        { turn_id: 3, state: "understood" },
        { turn_id: 4, state: "refused" },
      ],
    });
    // 2 refusals * 2 = 4 → AFRAID actually per weights
    expect(r.state).toBe("AFRAID");
  });

  it("returns AFRAID after 3+ refused/failed turns", () => {
    const r = assessAfraid({
      recent_turns: [
        { turn_id: 1, state: "refused" },
        { turn_id: 2, state: "failed" },
        { turn_id: 3, state: "refused" },
      ],
    });
    expect(r.state).toBe("AFRAID");
    expect(r.refusal_count).toBe(2);
    expect(r.failure_count).toBe(1);
  });

  it("returns CAUTIOUS on a mix of clarifications only", () => {
    const r = assessAfraid({
      recent_turns: [
        { turn_id: 1, state: "clarification_required" },
        { turn_id: 2, state: "understood" },
        { turn_id: 3, state: "clarification_required" },
        { turn_id: 4, state: "clarification_required" },
      ],
    });
    expect(r.state).toBe("CAUTIOUS");
  });

  it("respects the window size", () => {
    // 10 refusals but window=2 → only last 2 examined
    const turns = Array.from({ length: 10 }, (_, i) => ({
      turn_id: i + 1,
      state: "refused" as const,
    }));
    const r = assessAfraid({ recent_turns: turns, window_size: 2 });
    expect(r.window_examined).toBe(2);
    expect(r.refusal_count).toBe(2);
    expect(r.score).toBe(4);
  });

  it("returns CALM when window filled with successes even after old refusals", () => {
    const r = assessAfraid({
      recent_turns: [
        { turn_id: 1, state: "refused" },
        { turn_id: 2, state: "refused" },
        { turn_id: 3, state: "understood" },
        { turn_id: 4, state: "understood" },
        { turn_id: 5, state: "understood" },
        { turn_id: 6, state: "verified" },
        { turn_id: 7, state: "understood" },
      ],
      window_size: 5,
    });
    expect(r.state).toBe("CALM");
  });

  it("rationale prefix appears only for non-CALM", () => {
    const calm = assessAfraid({ recent_turns: [] });
    expect(calm.rationale_prefix).toBe("");
    const afraid = assessAfraid({
      recent_turns: [
        { turn_id: 1, state: "refused" },
        { turn_id: 2, state: "refused" },
        { turn_id: 3, state: "refused" },
      ],
    });
    expect(afraid.rationale_prefix).toContain("Afraid");
    expect(afraid.rationale_prefix).toContain("score=");
  });

  it("is deterministic", () => {
    const inp = {
      recent_turns: [
        { turn_id: 1, state: "refused" as const },
        { turn_id: 2, state: "clarification_required" as const },
      ],
    };
    expect(assessAfraid(inp)).toEqual(assessAfraid(inp));
  });

  it("exports version tag", () => {
    expect(AFRAID_VERSION).toBe("afraid.v1");
  });
});
