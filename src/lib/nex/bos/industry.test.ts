// Industry signals — filter noise, sort by magnitude.

import { describe, it, expect } from "vitest";
import { detectIndustrySignals, formatIndustrySignal } from "./industry";

describe("detectIndustrySignals", () => {
  it("empty → empty (evidence-or-silence)", () => {
    expect(detectIndustrySignals({})).toEqual([]);
  });

  it("small change < 10% filtered out as noise", () => {
    const s = detectIndustrySignals({
      observations: [{
        kind: "demand_shift", headline: "Kitchens up 5%", change_pct: 5,
        window_days: 30, source_table: "net.market", reason: "small"
      }]
    });
    expect(s).toEqual([]);
  });

  it("significant change ≥10% surfaces", () => {
    const s = detectIndustrySignals({
      observations: [{
        kind: "demand_shift", headline: "Roofing up 24%", change_pct: 24,
        window_days: 30, source_table: "net.market", reason: "real"
      }]
    });
    expect(s).toHaveLength(1);
    expect(s[0]!.change_pct).toBe(24);
    expect(s[0]!.evidence.tables).toContain("net.market");
  });

  it("sorts by magnitude descending", () => {
    const s = detectIndustrySignals({
      observations: [
        { kind: "demand_shift", headline: "A", change_pct: 12, window_days: 30, source_table: "t", reason: "x" },
        { kind: "demand_shift", headline: "B", change_pct: 30, window_days: 30, source_table: "t", reason: "x" },
        { kind: "demand_shift", headline: "C", change_pct: -25, window_days: 30, source_table: "t", reason: "x" }
      ]
    });
    expect(s.map((x) => x.headline)).toEqual(["B", "C", "A"]);
  });

  it("formatter surfaces arrow + pct", () => {
    const s = detectIndustrySignals({
      observations: [{ kind: "demand_shift", headline: "Bathrooms up", change_pct: 15, window_days: 30, source_table: "t", reason: "x" }]
    })[0]!;
    const line = formatIndustrySignal(s);
    expect(line).toContain("↑");
    expect(line).toContain("+15");
  });
});
