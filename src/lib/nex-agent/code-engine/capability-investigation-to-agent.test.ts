// Unit tests for Batch 2C · Investigation → Agent selection.
import { describe, it, expect } from "vitest";
import { selectAgentForInvestigation } from "./capability-investigation-to-agent";

function pkt(over: Record<string, unknown> = {}): any {
  return {
    verdict: "SUFFICIENT_EVIDENCE",
    candidate_files: [{ path: "src/lib/x.ts" }],
    evidence_for: [],
    evidence_against: [],
    confidence: "MEDIUM",
    confidence_numeric: 0.5,
    unknown_facts: [],
    capability_gaps: [],
    hypotheses: [],
    ...over,
  };
}

describe("selectAgentForInvestigation", () => {
  it("R1 · class 2 bridge + Q8 selected → debugger", () => {
    const r = selectAgentForInvestigation({
      packet: pkt(),
      class2_bridge_available: true,
      q8_selected: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.selected_agent).toBe("debugger");
    expect(r.rule_id).toBe("R1_fix_bridge_available");
  });

  it("R2 · REQUIRE_MORE_INVESTIGATION → forensics", () => {
    const r = selectAgentForInvestigation({
      packet: pkt({ verdict: "REQUIRE_MORE_INVESTIGATION" }),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.selected_agent).toBe("forensics");
    expect(r.rule_id).toBe("R2_investigation_more_needed");
  });

  it("R3 · INSUFFICIENT_EVIDENCE + zero candidates → forensics", () => {
    const r = selectAgentForInvestigation({
      packet: pkt({ verdict: "INSUFFICIENT_EVIDENCE", candidate_files: [] }),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.selected_agent).toBe("forensics");
    expect(r.rule_id).toBe("R3_insufficient_evidence");
  });

  it("R4 · conflicting evidence → reviewer", () => {
    const r = selectAgentForInvestigation({
      packet: pkt({ evidence_for: ["e1"], evidence_against: ["e2"] }),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.selected_agent).toBe("reviewer");
    expect(r.rule_id).toBe("R4_conflict_detected");
  });

  it("R5 · candidates but no sibling test → tester", () => {
    const r = selectAgentForInvestigation({
      packet: pkt(),
      target_has_any_sibling_test: false,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.selected_agent).toBe("tester");
    expect(r.rule_id).toBe("R5_test_gap");
  });

  it("R6 · default fallback → pm", () => {
    const r = selectAgentForInvestigation({ packet: pkt() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.selected_agent).toBe("pm");
    expect(r.rule_id).toBe("R6_default_pm");
  });

  it("empty packet · refuses", () => {
    const r = selectAgentForInvestigation({ packet: null });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal_kind).toBe("empty_packet");
  });

  it("determinism · two identical inputs produce byte-identical output", () => {
    const a = selectAgentForInvestigation({
      packet: pkt({ verdict: "REQUIRE_MORE_INVESTIGATION" }),
    });
    const b = selectAgentForInvestigation({
      packet: pkt({ verdict: "REQUIRE_MORE_INVESTIGATION" }),
    });
    expect(a).toEqual(b);
  });

  it("rule ordering · R1 takes precedence over R2 when both would fire", () => {
    const r = selectAgentForInvestigation({
      packet: pkt({ verdict: "REQUIRE_MORE_INVESTIGATION" }),
      class2_bridge_available: true,
      q8_selected: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.selected_agent).toBe("debugger");
    expect(r.rule_id).toBe("R1_fix_bridge_available");
  });
});
