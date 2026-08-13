// Construction Intelligence Platform · tests.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { CONSTRUCTION_RULES, rulesForDomain, check, getRule } from "./index";

describe("Construction Intelligence Platform", () => {
  it("catalogs at least 10 rules across staircase + kitchen + structural", () => {
    expect(CONSTRUCTION_RULES.length).toBeGreaterThanOrEqual(10);
  });

  it("every rule carries Rule-c provenance", () => {
    for (const r of CONSTRUCTION_RULES) {
      expect(r.provenance.named_expert).toBe("Philip O'Farrell");
      expect(r.provenance.authored).toBe("2026-08-04");
    }
  });

  it("rulesForDomain('staircase') returns staircase-only rules", () => {
    const stair = rulesForDomain("staircase");
    for (const r of stair) expect(r.domain).toBe("staircase");
    expect(stair.length).toBeGreaterThanOrEqual(4);
  });

  it("Part K rise-max rule cites Building Regs", () => {
    const rule = getRule("stair.rise_max_mm.domestic_primary");
    expect(rule?.citation).toContain("Building Regs");
    expect(rule?.max).toBe(220);
  });

  it("compliance check PASSES a compliant staircase", () => {
    const r = check({
      domain: "staircase",
      measurements: {
        riser_height_mm: { value: 190, unit: "mm" },
        going_mm: { value: 250, unit: "mm" },
        pitch_deg: { value: 38, unit: "deg" },
        headroom_mm: { value: 2100, unit: "mm" },
        handrail_height_mm: { value: 950, unit: "mm" },
        baluster_gap_mm: { value: 95, unit: "mm" },
      },
    });
    expect(r.passes).toBeGreaterThanOrEqual(6);
    expect(r.failures).toBe(0);
  });

  it("compliance check FAILS a non-compliant staircase", () => {
    const r = check({
      domain: "staircase",
      measurements: {
        riser_height_mm: { value: 240, unit: "mm" },        // too tall · fails max 220
        going_mm: { value: 200, unit: "mm" },               // too shallow · fails min 220
        pitch_deg: { value: 46, unit: "deg" },              // too steep · fails max 42
        baluster_gap_mm: { value: 120, unit: "mm" },        // sphere rule · fails max 100
      },
    });
    expect(r.failures).toBeGreaterThanOrEqual(4);
    for (const c of r.checks.filter((c) => !c.passed)) expect(c.message).toContain("FAIL");
  });

  it("advisory clearance emits an advisory · not a failure", () => {
    const r = check({
      domain: "kitchen",
      measurements: { island_clearance_mm: { value: 850, unit: "mm" } },  // below advisory 1000
    });
    expect(r.advisories).toBeGreaterThanOrEqual(1);
    expect(r.failures).toBe(0);
  });
});
