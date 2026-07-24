// Aggregate — k-anonymity + distributional stats.

import { describe, it, expect } from "vitest";
import { buildBenchmark } from "./aggregate";
import type { ProjectFingerprint } from "./types";
import { K_MIN } from "./types";

function fp(overrides: Partial<ProjectFingerprint> = {}): ProjectFingerprint {
  return {
    anon_id: "anon_x", trade: "carpenter", project_type: "kitchen",
    property_type: "domestic", region: "M",
    duration_days: 10, labour_hours: 40, materials_spend_pence: 100_000,
    labour_spend_pence: 50_000, crew_size: 2, completed_at: "2026-07-01",
    ...overrides
  };
}

describe("buildBenchmark", () => {
  it("returns insufficient + null stats below K_MIN", () => {
    const b = buildBenchmark({ fingerprints: [fp(), fp({ anon_id: "y" })] });
    expect(b.sample_size).toBe(2);
    expect(b.warnings[0]).toContain(`k=${K_MIN}`);
    for (const s of b.stats) {
      expect(s.median).toBeNull();
      expect(s.confidence).toBe("insufficient");
    }
  });

  it("returns median + percentiles at K_MIN or above", () => {
    const list = [10, 12, 14].map((d) => fp({ anon_id: `a${d}`, duration_days: d }));
    const b = buildBenchmark({ fingerprints: list });
    const stat = b.stats.find((s) => s.metric === "duration_days")!;
    expect(stat.median).toBe(12);
    expect(stat.count).toBe(3);
    expect(stat.confidence).toBe("low");
  });

  it("confidence bands: <10 = low, 10..24 = medium, ≥25 = high", () => {
    const many = Array.from({ length: 25 }, (_, i) => fp({ anon_id: `a${i}`, duration_days: 10 + i }));
    const b = buildBenchmark({ fingerprints: many });
    const stat = b.stats.find((s) => s.metric === "duration_days")!;
    expect(stat.confidence).toBe("high");
    const mid = many.slice(0, 12);
    const b2 = buildBenchmark({ fingerprints: mid });
    expect(b2.stats.find((s) => s.metric === "duration_days")!.confidence).toBe("medium");
  });

  it("filters by trade / project_type / region", () => {
    const set = [
      fp({ anon_id: "1", trade: "carpenter", project_type: "kitchen", region: "M", duration_days: 5  }),
      fp({ anon_id: "2", trade: "carpenter", project_type: "kitchen", region: "M", duration_days: 10 }),
      fp({ anon_id: "3", trade: "carpenter", project_type: "kitchen", region: "M", duration_days: 15 }),
      fp({ anon_id: "4", trade: "carpenter", project_type: "loft_conversion", region: "M", duration_days: 30 })
    ];
    const b = buildBenchmark({ fingerprints: set, filters: { project_type: "kitchen" } });
    expect(b.sample_size).toBe(3);
    expect(b.stats.find((s) => s.metric === "duration_days")!.median).toBe(10);
  });

  it("silently drops values below K_MIN even when overall sample_size exceeds it", () => {
    // 3 fingerprints but only 2 have labour_hours
    const list = [
      fp({ anon_id: "1", labour_hours: 40 }),
      fp({ anon_id: "2", labour_hours: 60 }),
      fp({ anon_id: "3", labour_hours: null })
    ];
    const b = buildBenchmark({ fingerprints: list });
    const dur = b.stats.find((s) => s.metric === "duration_days")!;
    expect(dur.median).not.toBeNull();   // all 3 have duration
    const lab = b.stats.find((s) => s.metric === "labour_hours")!;
    expect(lab.median).toBeNull();       // only 2 values — below k
    expect(lab.confidence).toBe("insufficient");
  });
});
