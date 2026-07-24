// Voice — Nex unification (no agent names, no em dashes).

import { describe, it, expect } from "vitest";
import { composeNexReply, normaliseContribution, stripAgentLabel, stripEmDash } from "./voice";
import type { AgentResult } from "./types";

const ev = { source: "t", tables: [], computed_at: "x" };
const mk = (id: string, headline: string, speak: string): AgentResult => ({
  agent_id: id as AgentResult["agent_id"], headline, speak, confidence: "medium", evidence: ev
});

describe("stripAgentLabel", () => {
  it("strips 'Estimating agent:' prefix", () => {
    expect(stripAgentLabel("Estimating agent: total £5,000")).toBe("total £5,000");
  });
  it("strips 'Regulations Agent found:' prefix", () => {
    expect(stripAgentLabel("Regulations Agent found: Part L applies")).toBe("Part L applies");
  });
  it("leaves un-labelled lines alone", () => {
    expect(stripAgentLabel("Part L applies")).toBe("Part L applies");
  });
});

describe("stripEmDash", () => {
  it("kills em dashes", () => {
    expect(stripEmDash("Yes — but check")).toBe("Yes. but check");
    expect(stripEmDash("Beam—size 152x89")).toBe("Beam.size 152x89");
  });
});

describe("normaliseContribution", () => {
  it("splits + strips labels + kills em dashes", () => {
    const r = mk("estimating", "hi", "Estimating agent: total £5,000\nMaterials — £2,000");
    const lines = normaliseContribution(r);
    expect(lines).toContain("total £5,000");
    expect(lines.some((l) => l.includes("£2,000") && !l.includes("—"))).toBe(true);
  });
});

describe("composeNexReply", () => {
  it("never shows agent names in the merchant-facing text", () => {
    const contribs = [
      mk("estimating",  "£5,000", "Estimating agent: total £5,000"),
      mk("regulations", "Part L", "Regulations agent found: Part L applies")
    ];
    const reply = composeNexReply({
      contributions: contribs, conflicts: [],
      overall_confidence: "medium", official_cited: true
    });
    expect(reply.toLowerCase()).not.toContain("estimating agent");
    expect(reply.toLowerCase()).not.toContain("regulations agent");
    expect(reply).toContain("£5,000");
    expect(reply).toContain("Part L applies");
    expect(reply).toContain("Confidence: medium");
    expect(reply).toContain("official");
  });

  it("adds 'sources disagree' note when conflicts present", () => {
    const contribs = [
      mk("planning", "Yes", "Yes"),
      mk("building_control", "No", "No")
    ];
    const conflict = { a: contribs[0]!, b: contribs[1]!, reason: "t" };
    const reply = composeNexReply({
      contributions: contribs, conflicts: [conflict],
      overall_confidence: "low", official_cited: false
    });
    expect(reply.toLowerCase()).toContain("sources disagree");
  });

  it("empty contributions → graceful fallback", () => {
    const reply = composeNexReply({
      contributions: [], conflicts: [], overall_confidence: "low", official_cited: false
    });
    expect(reply.toLowerCase()).toContain("couldn't get a clear answer");
  });

  it("never contains em dashes", () => {
    const contribs = [mk("timber", "Beam sized", "Beam — sized 152x89.")];
    const reply = composeNexReply({
      contributions: contribs, conflicts: [], overall_confidence: "medium", official_cited: false
    });
    expect(reply).not.toContain("—");
  });
});
