// Explain — internal trace surface.

import { describe, it, expect } from "vitest";
import { explain } from "./explain";
import type { AgentResult } from "./types";

const ev = (tables: string[] = []) => ({ source: "t", tables, computed_at: "x" });
const mk = (id: string, confidence: AgentResult["confidence"], is_official = false, error?: string, tables: string[] = []): AgentResult => ({
  agent_id: id as AgentResult["agent_id"], headline: "h", speak: "s",
  confidence, is_official, evidence: ev(tables), error
});

describe("explain", () => {
  it("names every contributing specialist + confidence + evidence tables", () => {
    const out = explain({
      ask: "load-bearing wall",
      contributions: [
        mk("structural", "high", true, undefined, ["hammerex_knowledge_entries"]),
        mk("estimating", "medium", false)
      ],
      conflicts: [],
      overall_confidence: "high"
    });
    expect(out).toContain("structural");
    expect(out).toContain("estimating");
    expect(out).toContain("high");
    expect(out).toContain("medium");
    expect(out).toContain("official");
    expect(out).toContain("hammerex_knowledge_entries");
  });

  it("reports conflict count when > 0", () => {
    const a = mk("planning", "medium");
    const b = mk("building_control", "medium");
    const out = explain({
      ask: "loft",
      contributions: [a, b],
      conflicts: [{ a, b, reason: "t" }],
      overall_confidence: "medium"
    });
    expect(out).toContain("1 conflict");
  });

  it("surfaces specialists that couldn't respond (errored)", () => {
    const out = explain({
      ask: "x",
      contributions: [mk("structural", "high"), mk("procurement", "low", false, "supabase down")],
      conflicts: [],
      overall_confidence: "medium"
    });
    expect(out.toLowerCase()).toContain("couldn't respond");
    expect(out).toContain("supabase down");
  });
});
