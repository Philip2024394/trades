// Learning Loop · tests.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

import { describe, it, expect, beforeEach } from "vitest";
import { capture, query, insights, count, clear } from "./index";
import type { LearningRecord } from "./index";

function rec(overrides?: Partial<LearningRecord>): LearningRecord {
  return {
    record_id: `rec_${Math.random().toString(36).slice(2, 10)}`,
    captured_at: new Date().toISOString(),
    project_id: "proj_001",
    theme_pack: "luxury_burgundy",
    layout_family: "premium_trade_banner_v1",
    personality: "luxury",
    materials: ["oak", "brass"],
    signals: ["accepted"],
    critic_score: 88,
    ...overrides,
  };
}

beforeEach(() => clear());

describe("Learning Loop", () => {
  it("captures + counts", () => {
    capture(rec());
    capture(rec());
    expect(count()).toBe(2);
  });

  it("query filters by project + min_critic_score", () => {
    capture(rec({ project_id: "a", critic_score: 90 }));
    capture(rec({ project_id: "a", critic_score: 55 }));
    capture(rec({ project_id: "b", critic_score: 95 }));
    const results = query({ project_id: "a", min_critic_score: 80 });
    expect(results).toHaveLength(1);
    expect(results[0].critic_score).toBe(90);
  });

  it("query filters by signal_any", () => {
    capture(rec({ signals: ["accepted"] }));
    capture(rec({ signals: ["rejected"] }));
    capture(rec({ signals: ["shared", "downloaded"] }));
    expect(query({ signal_any: ["shared"] })).toHaveLength(1);
    expect(query({ signal_any: ["accepted", "shared"] })).toHaveLength(2);
  });

  it("insights by theme_pack returns aggregated mean critic score + acceptance rate", () => {
    capture(rec({ theme_pack: "luxury_burgundy", critic_score: 90, signals: ["accepted"] }));
    capture(rec({ theme_pack: "luxury_burgundy", critic_score: 80, signals: ["accepted"] }));
    capture(rec({ theme_pack: "aqua_teal", critic_score: 60, signals: ["rejected"] }));
    const themeInsights = insights("theme_pack");
    const luxury = themeInsights.find((i) => i.key === "luxury_burgundy");
    expect(luxury?.sample_size).toBe(2);
    expect(luxury?.mean_critic_score).toBe(85);
    expect(luxury?.acceptance_rate).toBe(1);
    const teal = themeInsights.find((i) => i.key === "aqua_teal");
    expect(teal?.acceptance_rate).toBe(0);
  });

  it("insights by materials flattens each material into its own bucket", () => {
    capture(rec({ materials: ["oak"], critic_score: 90, signals: ["accepted"] }));
    capture(rec({ materials: ["oak", "brass"], critic_score: 80, signals: ["accepted"] }));
    const materialInsights = insights("materials");
    const oak = materialInsights.find((i) => i.key === "oak");
    expect(oak?.sample_size).toBe(2);
  });
});
